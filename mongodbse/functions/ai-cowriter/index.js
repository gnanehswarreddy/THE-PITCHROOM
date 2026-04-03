import { json } from "../_shared/context.js";
import { callGeminiText } from "../_shared/gemini.js";
import { buildLocalAiText } from "../_shared/local-ai.js";

export default async function aiCowriterHandler({ user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const { prompt = "", mode = "cowriter", context = "" } = body || {};
    if (!String(prompt).trim()) {
      return json(400, { error: "Prompt is required", data: null });
    }

    const aiResult = await callGeminiText({
      env,
      systemPrompt:
        "You are PitchRoom AI Co-Writer. Help screenwriters with scenes, dialogue, rewrites, and creative development. Preserve cinematic format and keep writing vivid and usable.",
      userPrompt: [`Mode: ${mode}`, context ? `Context: ${context}` : "", `Prompt: ${prompt}`].filter(Boolean).join("\n\n"),
      temperature: 0.85,
      maxOutputTokens: 2200,
    });

    if (!aiResult.ok) {
      const fallbackContent = buildLocalAiText({
        action: mode,
        content: prompt,
        context,
      });
      return json(200, {
        data: {
          content: fallbackContent,
          result: fallbackContent,
          model: "pitchroom-local-fallback",
          fallbackUsed: true,
        },
        error: null,
      });
    }

    return json(200, {
      data: {
        content: aiResult.text,
        result: aiResult.text,
        model: aiResult.model,
      },
      error: null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "ai-cowriter failed",
      data: null,
    });
  }
}
