import { ObjectId } from "mongodb";
import { normalizeDoc } from "../utils/normalizers.js";
import { EmbeddingService } from "./embedding.service.js";

const TAG_RULES = {
  thriller: ["murder", "crime", "suspense", "investigation", "chase"],
  romance: ["love", "relationship", "heart", "wedding", "breakup"],
  comedy: ["funny", "humor", "awkward", "satire", "joke"],
  sci_fi: ["future", "space", "alien", "technology", "dystopia"],
  drama: ["family", "conflict", "loss", "identity", "redemption"],
  action: ["war", "fight", "heist", "battle", "mission"],
};

function cleanString(value) {
  return String(value || "").trim();
}

function summarizeDescription(description) {
  const content = cleanString(description);
  if (!content) return "";
  if (content.length <= 220) return content;

  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const picked = [];

  for (const sentence of sentences) {
    if (picked.join(" ").length + sentence.length > 220 && picked.length) break;
    picked.push(sentence);
    if (picked.length === 2) break;
  }

  const summary = picked.join(" ").trim();
  if (summary) return summary;
  return `${content.slice(0, 217)}...`;
}

function inferAutoTags({ title, description, genre }) {
  const lower = [title, description, genre].map((value) => cleanString(value).toLowerCase()).join(" ");
  const discovered = [];

  for (const [tag, keywords] of Object.entries(TAG_RULES)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      discovered.push(tag);
    }
  }

  if (cleanString(genre)) {
    discovered.push(cleanString(genre).toLowerCase());
  }

  return discovered;
}

function normalizeTags(tags) {
  const cleaned = Array.isArray(tags) ? tags : [];
  return [...new Set(cleaned.map((tag) => cleanString(tag).toLowerCase()).filter(Boolean))];
}

function validateScriptPayload(payload) {
  const title = cleanString(payload.title);
  const description = cleanString(payload.description);
  const genre = cleanString(payload.genre);
  const authorId = cleanString(payload.authorId);

  if (!title) throw new Error("title is required");
  if (!description) throw new Error("description is required");
  if (!genre) throw new Error("genre is required");
  if (!authorId) throw new Error("authorId is required");

  return {
    title,
    description,
    genre,
    authorId,
    tags: normalizeTags(payload.tags),
  };
}

export class ScriptService {
  constructor({ db, embeddingService }) {
    this.db = db;
    this.embeddingService = embeddingService;
  }

  static create({ db, openAiApiKey, embeddingModel }) {
    return new ScriptService({
      db,
      embeddingService: new EmbeddingService({
        db,
        apiKey: openAiApiKey,
        model: embeddingModel,
      }),
    });
  }

  async createScript(payload) {
    const validated = validateScriptPayload(payload);

    const autoTags = inferAutoTags(validated);
    const tags = [...new Set([...validated.tags, ...autoTags])];
    const summary = summarizeDescription(validated.description);

    const embeddingInput = EmbeddingService.buildScriptEmbeddingInput({
      title: validated.title,
      description: validated.description,
      tags,
    });

    const embedding = await this.embeddingService.embedText(embeddingInput);

    const now = new Date();
    const doc = {
      title: validated.title,
      description: validated.description,
      genre: validated.genre,
      tags,
      summary,
      authorId: validated.authorId,
      writer_id: validated.authorId,
      createdAt: now,
      updatedAt: now,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      embedding,
      metrics: {
        likes: 0,
        views: 0,
      },
    };

    const result = await this.db.collection("scripts").insertOne(doc);
    const inserted = await this.db.collection("scripts").findOne({ _id: result.insertedId });
    return normalizeDoc(inserted);
  }

  async trackInteraction({ userId, scriptId, type }) {
    const normalizedType = cleanString(type).toLowerCase();
    if (!["liked", "viewed"].includes(normalizedType)) {
      throw new Error("type must be one of: liked, viewed");
    }

    if (!ObjectId.isValid(scriptId)) {
      throw new Error("Invalid scriptId");
    }

    const scriptObjectId = new ObjectId(scriptId);
    const scriptsCollection = this.db.collection("scripts");
    const existingScript = await scriptsCollection.findOne({ _id: scriptObjectId });
    if (!existingScript) {
      throw new Error("Script not found");
    }

    const interactions = this.db.collection("script_interactions");
    const existingInteraction = await interactions.findOne({ userId, scriptId, type: normalizedType });

    const now = new Date();
    await interactions.updateOne(
      { userId, scriptId, type: normalizedType },
      {
        $set: {
          userId,
          scriptId,
          type: normalizedType,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    if (!existingInteraction) {
      const metricField = normalizedType === "liked" ? "metrics.likes" : "metrics.views";
      await scriptsCollection.updateOne(
        { _id: scriptObjectId },
        {
          $inc: { [metricField]: 1 },
          $set: { updatedAt: now, updated_at: now.toISOString() },
        },
      );
    }

    return {
      userId,
      scriptId,
      type: normalizedType,
      tracked: true,
    };
  }
}
