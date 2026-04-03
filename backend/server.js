import { loadEnvFile } from "./load-env.js";
import cors from "cors";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { fileURLToPath, pathToFileURL } from "url";
import { GridFSBucket, MongoClient, ObjectId } from "mongodb";
import { registerPitchRoomRoutes } from "./pitchroom/register.js";
import { ScriptVisibilityService, ensureScriptRateLimit } from "./scripts/script-visibility.service.js";
import { AnalyticsService } from "./analytics/service.js";

loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4002);
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGODB_DB || "pitchroom";
const jwtSecret = process.env.JWT_SECRET || "pitchroom-dev-secret";
const appBaseUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5173";
const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
const verificationTtlMs = 24 * 60 * 60 * 1000;
const emailFrom = process.env.EMAIL_FROM || "PitchRoom <no-reply@pitchroom.local>";
const resendApiKey = process.env.RESEND_API_KEY || "";
const functionsRoot = path.join(__dirname, "..", "mongodbse", "functions");
const uploadsRoot = path.join(__dirname, "uploads");
const maxUploadSize = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 25 * 1024 * 1024);
const blockedExtensions = new Set([".exe", ".bat", ".cmd", ".com", ".msi", ".sh", ".ps1", ".js"]);

fs.mkdirSync(uploadsRoot, { recursive: true });

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsRoot));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadSize },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (blockedExtensions.has(extension)) {
      cb(new Error(`Files of type ${extension} are not allowed`));
      return;
    }
    cb(null, true);
  },
});
const client = new MongoClient(mongoUri);
let db;
let uploadsBucket;
let scriptVisibilityService;
let analyticsService;

const sanitizeBucket = (bucket) => (bucket || "misc").replace(/[^a-zA-Z0-9_-]/g, "") || "misc";
const sanitizeFileName = (fileName) => {
  const cleaned = path.basename(fileName || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "upload.bin";
};
const buildStoragePath = (bucket, fileId, fileName) => `${bucket}/${fileId}/${fileName}`;
const buildFileUrl = (req, bucket, fileId) => `${req.protocol}://${req.get("host")}/api/storage/${bucket}/file/${fileId}`;
const getStoredFileId = (storagePath = "") => {
  const [, fileId] = String(storagePath).split("/");
  return fileId && ObjectId.isValid(fileId) ? new ObjectId(fileId) : null;
};
const createVerificationExpiryDate = () => new Date(Date.now() + verificationTtlMs);
const isVerificationTokenExpired = (expiryDate) => new Date(expiryDate).getTime() <= Date.now();
const buildVerificationUrl = (token) => {
  const verifyUrl = new URL("/api/auth/verify", apiBaseUrl);
  verifyUrl.searchParams.set("token", token);
  return verifyUrl.toString();
};
const buildFrontendLoginUrl = (status, email, reason) => {
  const url = new URL("/login", appBaseUrl);
  if (status) url.searchParams.set("verification", status);
  if (email) url.searchParams.set("email", email);
  if (reason) url.searchParams.set("reason", reason);
  return url.toString();
};
const buildVerificationEmailHtml = ({ name, verificationUrl, fallbackUrl, expiresInHours }) => `
  <div style="margin:0;padding:32px;background:#0f0a12;font-family:Arial,sans-serif;color:#f5efe7;">
    <div style="max-width:640px;margin:0 auto;background:linear-gradient(180deg,#18101c 0%,#120c16 100%);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
      <div style="padding:32px 32px 16px;background:radial-gradient(circle at top right,#ef7d57 0%,rgba(239,125,87,0) 45%),radial-gradient(circle at top left,#f7c66b 0%,rgba(247,198,107,0) 40%),#18101c;">
        <div style="font-size:28px;font-weight:700;letter-spacing:0.02em;">PitchRoom 🎬</div>
        <div style="margin-top:8px;font-size:15px;line-height:1.7;color:#f0dfcf;">
          Welcome${name ? `, ${name}` : ""}. You're one click away from joining the room where scripts meet the right producers.
        </div>
      </div>
      <div style="padding:24px 32px 32px;">
        <div style="font-size:20px;font-weight:700;margin-bottom:12px;">Verify your email address</div>
        <div style="font-size:15px;line-height:1.7;color:#d6c6b7;margin-bottom:24px;">
          Confirm your account to unlock PitchRoom. This verification link expires in ${expiresInHours} hours and can only be used once.
        </div>
        <a href="${verificationUrl}" style="display:inline-block;background:#ef7d57;color:#140d11;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;">Verify My Account</a>
        <div style="margin-top:24px;font-size:13px;line-height:1.7;color:#c4b2a0;">
          If the button does not work, paste this link into your browser:<br />
          <a href="${fallbackUrl}" style="color:#f7c66b;word-break:break-all;">${fallbackUrl}</a>
        </div>
      </div>
    </div>
  </div>
`;
const sendVerificationEmail = async ({ email, name, verificationUrl }) => {
  const html = buildVerificationEmailHtml({
    name,
    verificationUrl,
    fallbackUrl: verificationUrl,
    expiresInHours: 24,
  });

  if (!resendApiKey) {
    console.log(`[email-preview] Verification email for ${email}: ${verificationUrl}`);
    return { delivered: false, preview: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject: "Verify your PitchRoom account",
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Failed to send verification email: ${payload || response.statusText}`);
  }

  return { delivered: true, preview: false };
};
const createVerificationTokenForUser = async ({ userId, email, name }) => {
  await db.collection("verification_tokens").deleteMany({ user_id: userId });

  const token = randomUUID();
  const expiryDate = createVerificationExpiryDate();
  const verificationUrl = buildVerificationUrl(token);

  await db.collection("verification_tokens").insertOne({
    token,
    user_id: userId,
    email,
    expiry_date: expiryDate,
    created_at: new Date().toISOString(),
  });

  let delivery;
  try {
    delivery = await sendVerificationEmail({ email, name, verificationUrl });
  } catch (error) {
    console.error(`Failed to send verification email to ${email}`, error);
    delivery = {
      delivered: false,
      preview: false,
      error: error.message || "Email delivery failed",
    };
  }
  return { token, verificationUrl, expiryDate, delivery };
};
const logVerificationAttempt = async ({ email = null, token = null, status, reason = null, userId = null, ipAddress = null }) => {
  await db.collection("verification_attempt_logs").insertOne({
    email,
    token,
    status,
    reason,
    user_id: userId,
    ip_address: ipAddress,
    created_at: new Date().toISOString(),
  });
};
const ensureIndex = async (collectionName, key, options = {}) => {
  try {
    await db.collection(collectionName).createIndex(key, options);
  } catch (error) {
    if (error?.code !== 85) {
      throw error;
    }
  }
};

const normalizeDoc = (doc) => {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(normalizeDoc);
  const normalized = { ...doc };
  if (normalized._id) {
    const mongoId = normalized._id.toString();
    normalized._id = mongoId;
    if (normalized.id === undefined) {
      normalized.id = mongoId;
    } else {
      normalized.mongo_id = mongoId;
    }
  }
  for (const [key, value] of Object.entries(normalized)) {
    if (value instanceof ObjectId) normalized[key] = value.toString();
    else if (Array.isArray(value)) normalized[key] = value.map((item) => item instanceof ObjectId ? item.toString() : item);
  }
  return normalized;
};

const uniqueValues = (values) => [...new Set(values.filter(Boolean))];
const asIdString = (value) => {
  if (!value) return null;
  if (value instanceof ObjectId) return value.toString();
  return typeof value === "string" ? value : null;
};

const getConversationParticipantIds = async (conversationIds = []) => {
  if (!conversationIds.length) return [];
  const objectIds = conversationIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (!objectIds.length) return [];
  const conversations = await db.collection("conversations").find({ _id: { $in: objectIds } }).toArray();
  return uniqueValues(
    conversations.flatMap((conversation) => [conversation.writer_id, conversation.producer_id]),
  );
};

const syncUserData = async (userId) => {
  if (!userId) return;

  const now = new Date().toISOString();
  const user = ObjectId.isValid(userId)
    ? await db.collection("users").findOne({ _id: new ObjectId(userId) })
    : null;
  const profile = await db.collection("profiles").findOne({ id: userId });
  const role = await db.collection("user_roles").findOne({ user_id: userId });
  const scripts = await db.collection("scripts").find({ writer_id: userId }).sort({ created_at: -1 }).toArray();
  const stories = await db.collection("stories").find({ user_id: userId }).sort({ updated_at: -1 }).toArray();
  const uploads = await db.collection("file_uploads").find({ owner_id: userId }).sort({ created_at: -1 }).toArray();
  const savedScripts = await db.collection("collections").find({ producer_id: userId }).sort({ created_at: -1 }).toArray();
  const notifications = await db.collection("notifications").find({ user_id: userId }).sort({ created_at: -1 }).toArray();
  const enrollments = await db.collection("course_enrollments").find({ user_id: userId }).sort({ updated_at: -1 }).toArray();
  const conversations = await db.collection("conversations").find({
    $or: [{ writer_id: userId }, { producer_id: userId }],
  }).sort({ last_message_at: -1, updated_at: -1, created_at: -1 }).toArray();
  const conversationIds = conversations.map((conversation) => conversation._id.toString());
  const messages = conversationIds.length
    ? await db.collection("messages").find({ conversation_id: { $in: conversationIds } }).sort({ created_at: 1 }).toArray()
    : [];

  await db.collection("user_data").updateOne(
    { user_id: userId },
    {
      $set: {
        user_id: userId,
        auth: user ? {
          id: user._id.toString(),
          email: user.email,
          created_at: user.created_at || null,
          updated_at: user.updated_at || null,
          last_login_at: user.last_login_at || null,
        } : null,
        profile: normalizeDoc(profile),
        role: role?.role || null,
        scripts: normalizeDoc(scripts),
        stories: normalizeDoc(stories),
        uploads: normalizeDoc(uploads),
        saved_scripts: normalizeDoc(savedScripts),
        notifications: normalizeDoc(notifications),
        enrollments: normalizeDoc(enrollments),
        conversations: normalizeDoc(conversations),
        messages: normalizeDoc(messages),
        stats: {
          scripts_count: scripts.length,
          stories_count: stories.length,
          uploads_count: uploads.length,
          conversations_count: conversations.length,
          messages_count: messages.length,
          unread_messages_count: messages.filter((message) => !message.read && message.sender_id !== userId).length,
        },
        updated_at: now,
      },
      $setOnInsert: {
        created_at: now,
      },
    },
    { upsert: true },
  );
};

const syncUserDataForMany = async (userIds = []) => {
  const ids = uniqueValues(userIds);
  await Promise.all(ids.map((userId) => syncUserData(userId)));
};

const resolveAffectedUserIds = async (collectionName, docs = []) => {
  if (!docs.length) return [];

  if (collectionName === "users") return uniqueValues(docs.map((doc) => asIdString(doc._id)));
  if (collectionName === "profiles") return uniqueValues(docs.map((doc) => asIdString(doc.id)));
  if (collectionName === "user_roles") return uniqueValues(docs.map((doc) => asIdString(doc.user_id)));
  if (collectionName === "scripts") return uniqueValues(docs.map((doc) => asIdString(doc.writer_id)));
  if (collectionName === "stories") return uniqueValues(docs.map((doc) => asIdString(doc.user_id)));
  if (collectionName === "file_uploads") return uniqueValues(docs.map((doc) => asIdString(doc.owner_id)));
  if (collectionName === "collections") return uniqueValues(docs.map((doc) => asIdString(doc.producer_id)));
  if (collectionName === "notifications") return uniqueValues(docs.map((doc) => asIdString(doc.user_id)));
  if (collectionName === "course_enrollments") return uniqueValues(docs.map((doc) => asIdString(doc.user_id)));
  if (collectionName === "conversations") {
    return uniqueValues(docs.flatMap((doc) => [asIdString(doc.writer_id), asIdString(doc.producer_id)]));
  }
  if (collectionName === "messages") {
    const senderIds = uniqueValues(docs.map((doc) => asIdString(doc.sender_id)));
    const conversationParticipantIds = await getConversationParticipantIds(docs.map((doc) => asIdString(doc.conversation_id)));
    return uniqueValues([...senderIds, ...conversationParticipantIds]);
  }

  return [];
};

const withFieldValue = (field, value) => {
  if (field === "_id" && typeof value === "string" && ObjectId.isValid(value)) {
    return new ObjectId(value);
  }
  return value;
};

const buildFilter = (filters = [], orFilters = []) => {
  const clauses = [];
  for (const filter of filters) {
    if (!filter) continue;
    const { field, operator, value } = filter;
    if (!field) continue;
    if (operator === "eq") clauses.push({ [field]: withFieldValue(field, value) });
    if (operator === "neq") clauses.push({ [field]: { $ne: withFieldValue(field, value) } });
    if (operator === "in") clauses.push({ [field]: { $in: (value || []).map((item) => withFieldValue(field, item)) } });
    if (operator === "gte") clauses.push({ [field]: { $gte: value } });
    if (operator === "not" && filter.comparator === "is") clauses.push({ [field]: { $ne: value } });
  }
  if (orFilters.length) {
    clauses.push({
      $or: orFilters.map((filter) => {
        if (filter.operator === "eq") return { [filter.field]: withFieldValue(filter.field, filter.value) };
        return { [filter.field]: filter.value };
      }),
    });
  }
  return clauses.length ? { $and: clauses } : {};
};

const parseSelect = (select) => {
  if (!select || select === "*") return undefined;
  const fields = select
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => !field.includes("("));
  if (!fields.length) return undefined;
  return Object.fromEntries(fields.map((field) => [field, 1]));
};

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await db.collection("users").findOne({ _id: new ObjectId(payload.sub) });
    req.user = user ? normalizeDoc(user) : null;
    next();
  } catch {
    req.user = null;
    next();
  }
};

app.use(authMiddleware);
app.use("/api/scripts", ensureScriptRateLimit());

const requireAuth = (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/track", requireAuth, async (req, res) => {
  try {
    const event = await analyticsService.trackEvent(req.body ?? {}, req.user.id);
    return res.status(201).json({ data: event, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to track event" });
  }
});

app.get("/api/analytics", requireAuth, async (req, res) => {
  try {
    const data = await analyticsService.getAnalytics({
      userId: req.user.id,
      audience: req.query.audience,
      days: req.query.days,
      start: req.query.start,
      end: req.query.end,
    });
    return res.json({ data, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to load analytics" });
  }
});

app.get("/api/insights", requireAuth, async (req, res) => {
  try {
    const data = await analyticsService.getInsights({
      userId: req.user.id,
      audience: req.query.audience,
      days: req.query.days,
      start: req.query.start,
      end: req.query.end,
    });
    return res.json({ data, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to load insights" });
  }
});

app.post("/api/analytics/seed-demo", requireAuth, async (req, res) => {
  try {
    const data = await analyticsService.seedDemoEvents({
      userId: req.user.id,
      audience: req.body?.audience,
    });
    return res.status(201).json({ data, error: null });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to seed analytics demo data" });
  }
});

app.post("/api/scripts", requireAuth, async (req, res) => {
  try {
    const script = await scriptVisibilityService.createScript({
      userId: req.user.id,
      payload: req.body ?? {},
    });

    await syncUserData(req.user.id);
    const profileMap = await scriptVisibilityService.getProfileMap([req.user.id]);
    return res.status(201).json({
      data: scriptVisibilityService.shapeOwnerScript(script, profileMap.get(req.user.id)),
      error: null,
    });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to create script" });
  }
});

app.get("/api/scripts/public", async (_req, res) => {
  try {
    const scripts = await scriptVisibilityService.getPublicScripts();
    const ownerIds = scripts.map((script) => script.userId || script.writer_id);
    const profileMap = await scriptVisibilityService.getProfileMap(ownerIds);
    const data = scripts.map((script) =>
      scriptVisibilityService.shapePublicScript(
        script,
        profileMap.get(script.userId || script.writer_id),
      ));

    return res.json({ data, error: null });
  } catch (error) {
    return res.status(500).json({ data: null, error: error.message || "Failed to load public scripts" });
  }
});

app.get("/api/scripts/my", requireAuth, async (req, res) => {
  try {
    const scripts = await scriptVisibilityService.getMyScripts(req.user.id);
    const profileMap = await scriptVisibilityService.getProfileMap([req.user.id]);
    const data = scripts.map((script) =>
      scriptVisibilityService.shapeOwnerScript(script, profileMap.get(req.user.id)));

    return res.json({ data, error: null });
  } catch (error) {
    return res.status(500).json({ data: null, error: error.message || "Failed to load your scripts" });
  }
});

app.get("/api/scripts/:id", async (req, res) => {
  try {
    const script = await scriptVisibilityService.getScriptById(req.params.id);
    if (!script) {
      return res.status(404).json({ data: null, error: "Script not found" });
    }

    const ownerId = script.userId || script.writer_id;
    const profileMap = await scriptVisibilityService.getProfileMap([ownerId]);
    const authorName = profileMap.get(ownerId);

    if (script.visibility !== "public") {
      if (!(await scriptVisibilityService.canViewFullScript(script, req.user?.id))) {
        return res.status(403).json({ data: null, error: "Unauthorized" });
      }

      return res.json({
        data: scriptVisibilityService.shapeOwnerScript(script, authorName),
        error: null,
      });
    }

    if (await scriptVisibilityService.canViewFullScript(script, req.user?.id)) {
      return res.json({
        data: scriptVisibilityService.shapeOwnerScript(script, authorName),
        error: null,
      });
    }

    return res.json({
      data: scriptVisibilityService.shapePublicScript(script, authorName),
      error: null,
    });
  } catch (error) {
    const status = error.message === "Invalid script id" ? 400 : 500;
    return res.status(status).json({ data: null, error: error.message || "Failed to load script" });
  }
});

app.patch("/api/scripts/:id/visibility", requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ data: null, error: "Invalid script id" });
    }

    const script = await scriptVisibilityService.updateVisibility({
      scriptId: req.params.id,
      userId: req.user.id,
      visibility: req.body?.visibility,
    });

    if (!script) {
      return res.status(404).json({ data: null, error: "Script not found" });
    }

    await syncUserData(req.user.id);
    const profileMap = await scriptVisibilityService.getProfileMap([req.user.id]);
    return res.json({
      data: scriptVisibilityService.shapeOwnerScript(script, profileMap.get(req.user.id)),
      error: null,
    });
  } catch (error) {
    return res.status(400).json({ data: null, error: error.message || "Failed to update visibility" });
  }
});

app.delete("/api/scripts/:id", requireAuth, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ data: null, error: "Invalid script id" });
    }

    const deleted = await scriptVisibilityService.deleteScript({
      scriptId: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ data: null, error: "Script not found" });
    }

    await syncUserData(req.user.id);
    return res.json({ data: { id: req.params.id }, error: null });
  } catch (error) {
    return res.status(500).json({ data: null, error: error.message || "Failed to delete script" });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const userDoc = {
      email: normalizedEmail,
      passwordHash,
      is_verified: true,
      verified_at: now,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    };

    const userResult = await db.collection("users").insertOne(userDoc);
    const userId = userResult.insertedId.toString();

    await db.collection("profiles").insertOne({
      id: userId,
      name: name?.trim() || "",
      bio: "",
      avatar_url: "",
      onboarding_completed: false,
      created_at: now,
      updated_at: now,
    });

    const sessionUser = { id: userId, email: userDoc.email, is_verified: true };
    const token = jwt.sign({ sub: userId }, jwtSecret, { expiresIn: "7d" });

    await syncUserData(userId);

    res.status(201).json({
      message: "Account created successfully.",
      user: sessionUser,
      session: { access_token: token, user: sessionUser },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Signup failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection("users").findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const now = new Date().toISOString();
    await db.collection("users").updateOne({ _id: user._id }, { $set: { last_login_at: now, updated_at: now } });

    const normalized = normalizeDoc(user);
    const sessionUser = { id: normalized.id, email: normalized.email };
    const token = jwt.sign({ sub: normalized.id }, jwtSecret, { expiresIn: "7d" });

    await syncUserData(normalized.id);

    res.json({ user: sessionUser, session: { access_token: token, user: sessionUser } });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: { id: req.user.id, email: req.user.email, is_verified: Boolean(req.user.is_verified) } });
});

app.get("/api/auth/verify", async (req, res) => {
  const token = String(req.query.token || "").trim();
  const acceptsHtml = (req.headers.accept || "").includes("text/html");

  const redirectToLogin = (status, email, reason, fallbackStatus = 200) => {
    const location = buildFrontendLoginUrl(status, email, reason);
    if (acceptsHtml) {
      return res.redirect(location);
    }
    return res.status(fallbackStatus).json({ status, email, reason, redirect_to: location });
  };

  if (!token) {
    await logVerificationAttempt({ token: null, status: "failed", reason: "missing_token", ipAddress: req.ip });
    return redirectToLogin("error", null, "missing_token", 400);
  }

  const tokenDoc = await db.collection("verification_tokens").findOne({ token });
  if (!tokenDoc) {
    await logVerificationAttempt({ token, status: "failed", reason: "invalid_token", ipAddress: req.ip });
    return redirectToLogin("error", null, "invalid_token", 404);
  }

  const user = await db.collection("users").findOne({ _id: new ObjectId(tokenDoc.user_id) });
  if (!user) {
    await db.collection("verification_tokens").deleteOne({ _id: tokenDoc._id });
    await logVerificationAttempt({ token, email: tokenDoc.email, status: "failed", reason: "user_not_found", ipAddress: req.ip });
    return redirectToLogin("error", tokenDoc.email, "user_not_found", 404);
  }

  if (isVerificationTokenExpired(tokenDoc.expiry_date)) {
    await db.collection("verification_tokens").deleteOne({ _id: tokenDoc._id });
    await logVerificationAttempt({
      token,
      email: user.email,
      status: "expired",
      reason: "token_expired",
      userId: user._id.toString(),
      ipAddress: req.ip,
    });
    return redirectToLogin("expired", user.email, "token_expired", 410);
  }

  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { is_verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() } },
  );
  await db.collection("verification_tokens").deleteOne({ _id: tokenDoc._id });
  await syncUserData(user._id.toString());
  await logVerificationAttempt({
    token,
    email: user.email,
    status: "success",
    reason: null,
    userId: user._id.toString(),
    ipAddress: req.ip,
  });

  return redirectToLogin("success", user.email, null, 200);
});

app.post("/api/auth/resend-verification", async (req, res) => {
  try {
    const normalizedEmail = String(req.body?.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "No account found for that email address" });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: "This account is already verified" });
    }

    const profile = await db.collection("profiles").findOne({ id: user._id.toString() });
    const verification = await createVerificationTokenForUser({
      userId: user._id.toString(),
      email: user.email,
      name: profile?.name || "",
    });

    await logVerificationAttempt({
      email: user.email,
      token: verification.token,
      status: "resent",
      reason: null,
      userId: user._id.toString(),
      ipAddress: req.ip,
    });

    return res.json({
      message: "A new verification link has been sent to your email.",
      verification: {
        expires_at: verification.expiryDate.toISOString(),
        email_preview: verification.delivery.preview,
        email_delivery_failed: Boolean(verification.delivery.error),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to resend verification email" });
  }
});

app.post("/api/storage/:bucket/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "File is required" });

    const bucket = sanitizeBucket(req.params.bucket);
    const originalPath = typeof req.body.path === "string" ? req.body.path : "";
    const requestedName = originalPath.split("/").filter(Boolean).pop();
    const fileName = sanitizeFileName(requestedName || req.file.originalname);
    const uploadStream = uploadsBucket.openUploadStream(fileName, {
      metadata: {
        bucket,
        owner_id: req.user.id,
        content_type: req.file.mimetype || "application/octet-stream",
        original_name: req.file.originalname,
        requested_path: originalPath,
      },
    });

    uploadStream.end(req.file.buffer);
    await new Promise((resolve, reject) => {
      uploadStream.on("finish", resolve);
      uploadStream.on("error", reject);
    });

    const fileId = uploadStream.id.toString();
    const now = new Date().toISOString();
    const storagePath = buildStoragePath(bucket, fileId, fileName);

    await db.collection("file_uploads").insertOne({
      bucket,
      file_id: fileId,
      owner_id: req.user.id,
      requested_path: originalPath,
      storage_path: storagePath,
      filename: fileName,
      original_name: req.file.originalname,
      content_type: req.file.mimetype || "application/octet-stream",
      size: req.file.size,
      created_at: now,
      updated_at: now,
    });

    await syncUserData(req.user.id);

    res.json({
      path: storagePath,
      publicUrl: buildFileUrl(req, bucket, fileId),
      fileId,
      filename: fileName,
      size: req.file.size,
      contentType: req.file.mimetype || "application/octet-stream",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

app.get("/api/storage/:bucket/public/:filename", async (req, res) => {
  const bucket = sanitizeBucket(req.params.bucket);
  const fileId = getStoredFileId(req.query.path || req.params.filename);
  if (!fileId) return res.status(404).json({ error: "File not found" });

  const record = await db.collection("file_uploads").findOne({ bucket, file_id: fileId.toString() });
  if (!record) return res.status(404).json({ error: "File not found" });

  res.json({
    publicUrl: buildFileUrl(req, bucket, record.file_id),
  });
});

app.get("/api/storage/:bucket/file/:fileId", async (req, res) => {
  try {
    const bucket = sanitizeBucket(req.params.bucket);
    if (!ObjectId.isValid(req.params.fileId)) return res.status(404).json({ error: "File not found" });

    const record = await db.collection("file_uploads").findOne({ bucket, file_id: req.params.fileId });
    if (!record) return res.status(404).json({ error: "File not found" });

    const downloadStream = uploadsBucket.openDownloadStream(new ObjectId(req.params.fileId));
    res.setHeader("Content-Type", record.content_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${record.filename}"`);
    downloadStream.on("error", () => res.status(404).end());
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message || "Download failed" });
  }
});

app.get("/api/storage/:bucket/download", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const bucket = sanitizeBucket(req.params.bucket);
    const fileId = getStoredFileId(req.query.path || "");
    if (!fileId) return res.status(404).json({ error: "File not found" });

    const record = await db.collection("file_uploads").findOne({ bucket, file_id: fileId.toString() });
    if (!record) return res.status(404).json({ error: "File not found" });

    const downloadStream = uploadsBucket.openDownloadStream(fileId);
    res.setHeader("Content-Type", record.content_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${record.filename}"`);
    downloadStream.on("error", () => res.status(404).end());
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message || "Download failed" });
  }
});

app.post("/api/db/:collection/query", requireAuth, async (req, res) => {
  try {
    const { filters, orFilters, select, order, limit, single, maybeSingle, count, head } = req.body;
    const collection = db.collection(req.params.collection);
    const mongoFilter = buildFilter(filters, orFilters);

    const totalCount = count === "exact" ? await collection.countDocuments(mongoFilter) : null;
    if (head) return res.json({ data: [], count: totalCount, error: null });

    let cursor = collection.find(mongoFilter, { projection: parseSelect(select) });

    if (order?.column) {
      cursor = cursor.sort({ [order.column]: order.ascending === false ? -1 : 1 });
    }
    if (typeof limit === "number") {
      cursor = cursor.limit(limit);
    }

    const items = normalizeDoc(await cursor.toArray());
    let data = items;

    if (single) {
      data = items[0] || null;
      if (!data) return res.status(406).json({ data: null, count: totalCount, error: "No rows found" });
    }

    if (maybeSingle) {
      data = items[0] || null;
    }

    res.json({ data, count: totalCount, error: null });
  } catch (error) {
    res.status(500).json({ data: null, count: null, error: error.message || "Query failed" });
  }
});

app.post("/api/db/:collection/insert", requireAuth, async (req, res) => {
  try {
    const payload = Array.isArray(req.body.values) ? req.body.values : [req.body.values];
    const now = new Date().toISOString();
    const docs = payload.map((item) => ({ ...item, created_at: item?.created_at || now, updated_at: now }));
    const result = await db.collection(req.params.collection).insertMany(docs);
    const ids = Object.values(result.insertedIds);
    const inserted = await db.collection(req.params.collection).find({ _id: { $in: ids } }).toArray();
    await syncUserDataForMany(await resolveAffectedUserIds(req.params.collection, inserted));
    res.json({ data: normalizeDoc(inserted), error: null });
  } catch (error) {
    if (
      error?.code === 11000 &&
      req.params.collection === "user_roles" &&
      !Array.isArray(req.body.values) &&
      req.body.values?.user_id
    ) {
      const now = new Date().toISOString();
      await db.collection("user_roles").updateOne(
        { user_id: req.body.values.user_id },
        {
          $set: {
            role: req.body.values.role,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        { upsert: true },
      );

      const updated = await db.collection("user_roles").findOne({ user_id: req.body.values.user_id });
      await syncUserData(req.body.values.user_id);
      return res.json({ data: normalizeDoc(updated), error: null });
    }

    if (
      error?.code === 11000 &&
      req.params.collection === "profiles" &&
      !Array.isArray(req.body.values) &&
      req.body.values?.id
    ) {
      const now = new Date().toISOString();
      await db.collection("profiles").updateOne(
        { id: req.body.values.id },
        {
          $set: {
            ...req.body.values,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        { upsert: true },
      );

      const updated = await db.collection("profiles").findOne({ id: req.body.values.id });
      await syncUserData(req.body.values.id);
      return res.json({ data: normalizeDoc(updated), error: null });
    }

    res.status(500).json({ data: null, error: error.message || "Insert failed" });
  }
});

app.patch("/api/db/:collection/update", requireAuth, async (req, res) => {
  try {
    const mongoFilter = buildFilter(req.body.filters, req.body.orFilters);
    const beforeUpdate = await db.collection(req.params.collection).find(mongoFilter).toArray();
    const values = { ...req.body.values, updated_at: new Date().toISOString() };
    await db.collection(req.params.collection).updateMany(mongoFilter, { $set: values });
    const updated = await db.collection(req.params.collection).find(mongoFilter).toArray();
    await syncUserDataForMany(await resolveAffectedUserIds(req.params.collection, [...beforeUpdate, ...updated]));
    res.json({ data: normalizeDoc(updated), error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message || "Update failed" });
  }
});

app.delete("/api/db/:collection/delete", requireAuth, async (req, res) => {
  try {
    const mongoFilter = buildFilter(req.body.filters, req.body.orFilters);
    const deletedDocs = await db.collection(req.params.collection).find(mongoFilter).toArray();
    await db.collection(req.params.collection).deleteMany(mongoFilter);
    await syncUserDataForMany(await resolveAffectedUserIds(req.params.collection, deletedDocs));
    res.json({ data: [], error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message || "Delete failed" });
  }
});

app.post("/api/db/:collection/upsert", requireAuth, async (req, res) => {
  try {
    const values = req.body.values;
    const conflictKeys = req.body.onConflict || ["user_id", "course_id"];
    const filter = Object.fromEntries(conflictKeys.filter((key) => values?.[key] !== undefined).map((key) => [key, values[key]]));
    const now = new Date().toISOString();
    await db.collection(req.params.collection).updateOne(filter, { $set: { ...values, updated_at: now }, $setOnInsert: { created_at: now } }, { upsert: true });
    const updated = await db.collection(req.params.collection).findOne(filter);
    await syncUserDataForMany(await resolveAffectedUserIds(req.params.collection, updated ? [updated] : []));
    res.json({ data: normalizeDoc(updated), error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message || "Upsert failed" });
  }
});

app.post("/api/functions/:name", requireAuth, async (req, res) => {
  try {
    const modulePath = path.join(functionsRoot, req.params.name, "index.js");
    if (!fs.existsSync(modulePath)) {
      return res.status(404).json({
        error: `Function ${req.params.name} was not found`,
        data: null,
      });
    }

    const moduleVersion = fs.statSync(modulePath).mtimeMs;
    const handlerModule = await import(`${pathToFileURL(modulePath).href}?v=${moduleVersion}`);
    const handler = handlerModule.default;

    if (typeof handler !== "function") {
      return res.status(500).json({
        error: `Function ${req.params.name} does not export a default handler`,
        data: null,
      });
    }

    const result = await handler({
      db,
      user: req.user,
      body: req.body ?? {},
      env: process.env,
    });

    if (req.params.name === "send-script-pitch" && !result?.body?.error) {
      await syncUserDataForMany([req.user?.id, req.body?.producerId]);
    }

    return res.status(result?.status || 200).json(result?.body ?? { data: null, error: null });
  } catch (error) {
    return res.status(500).json({
      error: error.message || `Function ${req.params.name} failed`,
      data: null,
    });
  }
});

const start = async () => {
  await client.connect();
  db = client.db(dbName);
  await ensureIndex("users", { email: 1 }, { unique: true });
  await ensureIndex("verification_tokens", { token: 1 }, { unique: true });
  await ensureIndex("verification_tokens", { user_id: 1 });
  await ensureIndex("verification_tokens", { expiry_date: 1 }, { expireAfterSeconds: 0 });
  await ensureIndex("verification_attempt_logs", { created_at: -1 });
  uploadsBucket = new GridFSBucket(db, { bucketName: "uploads" });
  scriptVisibilityService = new ScriptVisibilityService({ db });
  analyticsService = new AnalyticsService({ db });
  await analyticsService.ensureIndexes();
  const existingUsers = await db.collection("users").find({}, { projection: { _id: 1 } }).toArray();
  await syncUserDataForMany(existingUsers.map((user) => user._id.toString()));
  registerPitchRoomRoutes({ app, db });
  app.listen(port, () => {
    console.log(`PitchRoom MongoDB API listening on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});

