import { ObjectId } from "mongodb";

const VISIBILITY_VALUES = new Set(["private", "public"]);

function cleanString(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultilineText(value) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function resolveAuthorName(profile) {
  return cleanString(profile?.name) || "Anonymous";
}

function normalizeId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value.toString();
  return typeof value === "string" ? value : null;
}

function toClientDoc(doc) {
  if (!doc) return null;

  return {
    ...doc,
    _id: doc._id?.toString?.() || doc._id,
    id: doc._id?.toString?.() || doc.id || doc._id,
  };
}

export class ScriptVisibilityService {
  constructor({ db }) {
    this.db = db;
  }

  validateCreatePayload(payload = {}) {
    const title = cleanString(payload.title);
    const logline = cleanString(payload.logline);
    const scriptContent = cleanMultilineText(payload.scriptContent);
    const visibility = this.normalizeVisibility(payload.visibility);
    const sourceStoryId = cleanString(payload.sourceStoryId);

    if (!title) throw new Error("Title is required");
    if (!logline) throw new Error("Logline is required");
    if (logline.length > 200) throw new Error("Logline must be 200 characters or fewer");
    if (!scriptContent) throw new Error("Script content is required");

    return {
      title,
      logline,
      scriptContent,
      visibility,
      sourceStoryId: sourceStoryId || null,
    };
  }

  normalizeVisibility(value) {
    const visibility = cleanString(value || "private").toLowerCase();
    if (!VISIBILITY_VALUES.has(visibility)) {
      throw new Error("Visibility must be either private or public");
    }
    return visibility;
  }

  async createScript({ userId, payload }) {
    const validated = this.validateCreatePayload(payload);
    const now = new Date();
    const nowIso = now.toISOString();

    const doc = {
      userId,
      writer_id: userId,
      title: validated.title,
      logline: validated.logline,
      scriptContent: validated.scriptContent,
      full_script_text: validated.scriptContent,
      sourceStoryId: validated.sourceStoryId,
      visibility: validated.visibility,
      createdAt: now,
      updatedAt: now,
      created_at: nowIso,
      updated_at: nowIso,
      metrics: {
        likes: 0,
        views: 0,
      },
      views: 0,
      status: validated.visibility === "public" ? "published" : "draft",
    };

    const result = await this.db.collection("scripts").insertOne(doc);
    return this.db.collection("scripts").findOne({ _id: result.insertedId });
  }

  async getScriptById(scriptId) {
    if (!ObjectId.isValid(scriptId)) {
      throw new Error("Invalid script id");
    }

    return this.db.collection("scripts").findOne({ _id: new ObjectId(scriptId) });
  }

  async getMyScripts(userId) {
    return this.db.collection("scripts")
      .find({ $or: [{ userId }, { writer_id: userId }] })
      .sort({ createdAt: -1, created_at: -1 })
      .toArray();
  }

  async getPublicScripts() {
    return this.db.collection("scripts")
      .find({ visibility: "public" })
      .sort({ createdAt: -1, created_at: -1 })
      .toArray();
  }

  async hasApprovedAccess({ script, userId }) {
    const scriptId = normalizeId(script?._id) || normalizeId(script?.id);
    if (!scriptId || !userId) return false;

    const grant = await this.db.collection("script_access_grants").findOne({
      script_id: scriptId,
      producer_id: userId,
      status: "approved",
    });

    return Boolean(grant);
  }

  async updateVisibility({ scriptId, userId, visibility }) {
    const normalizedVisibility = this.normalizeVisibility(visibility);
    const now = new Date();

    const result = await this.db.collection("scripts").findOneAndUpdate(
      {
        _id: new ObjectId(scriptId),
        $or: [{ userId }, { writer_id: userId }],
      },
      {
        $set: {
          visibility: normalizedVisibility,
          status: normalizedVisibility === "public" ? "published" : "draft",
          updatedAt: now,
          updated_at: now.toISOString(),
        },
      },
      { returnDocument: "after" },
    );

    return result;
  }

  async deleteScript({ scriptId, userId }) {
    return this.db.collection("scripts").findOneAndDelete({
      _id: new ObjectId(scriptId),
      $or: [{ userId }, { writer_id: userId }],
    });
  }

  async getProfileMap(userIds = []) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();

    const profiles = await this.db.collection("profiles")
      .find({ id: { $in: ids } }, { projection: { id: 1, name: 1 } })
      .toArray();

    return new Map(profiles.map((profile) => [profile.id, resolveAuthorName(profile)]));
  }

  shapePublicScript(script, authorName) {
    const normalized = toClientDoc(script);
    const ownerId = normalizeId(script.userId) || normalizeId(script.writer_id);

    return {
      _id: normalized._id,
      id: normalized.id,
      userId: ownerId,
      writer_id: ownerId,
      title: cleanString(script.title),
      logline: cleanString(script.logline),
      author: {
        id: ownerId,
        name: authorName || "Anonymous",
      },
      createdAt: script.createdAt || script.created_at || null,
      created_at: script.created_at || (script.createdAt instanceof Date ? script.createdAt.toISOString() : script.createdAt) || null,
      visibility: "public",
    };
  }

  shapeOwnerScript(script, authorName) {
    const normalized = toClientDoc(script);
    const ownerId = normalizeId(script.userId) || normalizeId(script.writer_id);

    return {
      ...normalized,
      userId: ownerId,
      writer_id: ownerId,
      sourceStoryId: cleanString(script.sourceStoryId) || null,
      author: {
        id: ownerId,
        name: authorName || "Anonymous",
      },
      title: cleanString(script.title),
      logline: cleanString(script.logline),
      scriptContent: cleanMultilineText(script.scriptContent || script.full_script_text),
      visibility: script.visibility === "public" ? "public" : "private",
      createdAt: script.createdAt || script.created_at || null,
      created_at: script.created_at || (script.createdAt instanceof Date ? script.createdAt.toISOString() : script.createdAt) || null,
    };
  }

  async canViewFullScript(script, userId) {
    const ownerId = normalizeId(script.userId) || normalizeId(script.writer_id);
    if (Boolean(userId && ownerId && ownerId === userId)) {
      return true;
    }

    return this.hasApprovedAccess({ script, userId });
  }
}

export function ensureScriptRateLimit({ windowMs = 60_000, max = 120 } = {}) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || "unknown"}:${req.user?.id || "anon"}`;
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }

    bucket.count += 1;
    next();
  };
}
