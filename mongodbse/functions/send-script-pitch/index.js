import { ObjectId } from "mongodb";
import { json } from "../_shared/context.js";
import { callGeminiText } from "../_shared/gemini.js";

const buildPitchMessage = ({ writerName, title, genre, logline }) => {
  const intro = writerName ? `${writerName} shared a script pitch.` : "A writer shared a script pitch.";
  const titleLine = `Title: ${title}`;
  const genreLine = genre ? `Genre: ${genre}` : null;
  const loglineLine = logline ? `Logline: ${logline}` : "Logline: Not provided yet.";
  const close = "Let me know if you'd like to discuss the project further.";

  return [intro, titleLine, genreLine, loglineLine, close].filter(Boolean).join("\n");
};

const normalizeLogline = (text) => {
  const clean = String(text || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^logline\s*:\s*/i, "")
    .replace(/^"|"$/g, "")
    .trim();

  if (!clean) return "";
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
  return firstSentence.split(/\s+/).slice(0, 40).join(" ").trim();
};

const fallbackLogline = ({ title, genre }) => {
  const safeTitle = title || "Untitled Script";
  const safeGenre = genre ? String(genre).toLowerCase() : "dramatic";
  return `${safeTitle} is a ${safeGenre} story about a protagonist forced to confront a defining conflict with high personal stakes.`;
};

const generateLogline = async ({ env, script }) => {
  const prompt = [
    "Write exactly one compelling movie logline.",
    "Rules:",
    "- One sentence only.",
    "- Include protagonist, central conflict, and stakes.",
    "- Maximum 40 words.",
    "- Return plain text only.",
    `Title: ${script.title || "Untitled Script"}`,
    `Genre: ${script.genre || "Unknown"}`,
    script.description ? `Description: ${script.description}` : "",
    script.summary ? `Summary: ${script.summary}` : "",
    script.scriptContent ? `Script: ${String(script.scriptContent).slice(0, 14000)}` : "",
    script.full_script_text ? `Script: ${String(script.full_script_text).slice(0, 14000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const aiResult = await callGeminiText({
    env,
    systemPrompt:
      "You are a film development executive who writes cinematic, market-ready loglines.",
    userPrompt: prompt,
    temperature: 0.5,
    maxOutputTokens: 120,
  });

  if (!aiResult.ok) {
    return fallbackLogline({ title: script.title, genre: script.genre });
  }

  const normalized = normalizeLogline(aiResult.text);
  return normalized || fallbackLogline({ title: script.title, genre: script.genre });
};

export default async function sendScriptPitchHandler({ db, user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const { scriptId, producerId } = body || {};
    if (!scriptId || !producerId) {
      return json(400, { error: "scriptId and producerId are required", data: null });
    }

    if (!ObjectId.isValid(scriptId)) {
      return json(400, { error: "Invalid scriptId", data: null });
    }

    const script = await db.collection("scripts").findOne({ _id: new ObjectId(scriptId) });
    if (!script) {
      return json(404, { error: "Script not found", data: null });
    }

    if (script.writer_id !== user.id) {
      return json(403, { error: "You can only pitch your own scripts", data: null });
    }

    const producerRole = await db.collection("user_roles").findOne({ user_id: producerId, role: "producer" });
    if (!producerRole) {
      return json(404, { error: "Producer not found", data: null });
    }

    const writerProfile = await db.collection("profiles").findOne({ id: user.id });
    const now = new Date().toISOString();

    let pitchLogline = String(script.logline || "").trim();
    if (!pitchLogline) {
      pitchLogline = await generateLogline({ env, script });

      await db.collection("scripts").updateOne(
        { _id: script._id },
        { $set: { logline: pitchLogline, updated_at: now } },
      );
    }

    const messageContent = buildPitchMessage({
      writerName: writerProfile?.name || "",
      title: script.title || "Untitled Script",
      genre: script.genre || "",
      logline: pitchLogline,
    });

    let conversation = await db.collection("conversations").findOne({
      writer_id: user.id,
      producer_id: producerId,
      script_id: scriptId,
    });

    if (!conversation) {
      const conversationDoc = {
        writer_id: user.id,
        producer_id: producerId,
        script_id: scriptId,
        last_message_at: now,
        created_at: now,
        updated_at: now,
      };

      const conversationResult = await db.collection("conversations").insertOne(conversationDoc);
      conversation = { ...conversationDoc, _id: conversationResult.insertedId };
    } else {
      await db.collection("conversations").updateOne(
        { _id: conversation._id },
        { $set: { last_message_at: now, updated_at: now } },
      );
    }

    const messageDoc = {
      conversation_id: conversation._id.toString(),
      sender_id: user.id,
      content: messageContent,
      read: false,
      created_at: now,
      updated_at: now,
    };

    const messageResult = await db.collection("messages").insertOne(messageDoc);

    return json(200, {
      data: {
        conversationId: conversation._id.toString(),
        messageId: messageResult.insertedId.toString(),
      },
      error: null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "send-script-pitch failed",
      data: null,
    });
  }
}
