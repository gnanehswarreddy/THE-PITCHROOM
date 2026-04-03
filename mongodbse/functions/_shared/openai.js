import { json } from "./context.js";

const DEFAULT_IMAGE_MODEL = "gpt-image-1";
const DEFAULT_IMAGE_SIZE = "1024x1536";
const DEFAULT_TEXT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 30000;

export const callOpenAIText = async ({
  env,
  systemPrompt,
  userPrompt,
  temperature = 0.8,
  maxOutputTokens = 1200,
}) => {
  const apiKey = env.OPENAI_API_KEY || "";
  const model = env.OPENAI_TEXT_MODEL || DEFAULT_TEXT_MODEL;

  if (!apiKey) {
    return {
      ok: false,
      response: json(503, {
        error: "AI text fallback is not configured. Add OPENAI_API_KEY to the backend .env file.",
        data: null,
      }),
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort(new Error("OpenAI text request timed out")), timeoutMs);

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_completion_tokens: maxOutputTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      response: json(504, {
        error: error?.name === "AbortError"
          ? "OpenAI text request timed out"
          : error?.message || "OpenAI text generation failed",
        data: null,
      }),
    };
  }

  clearTimeout(timeoutId);

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      response: json(response.status, {
        error: payload?.error?.message || "OpenAI text generation failed",
        data: null,
      }),
    };
  }

  const text = payload?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    return {
      ok: false,
      response: json(502, {
        error: "OpenAI returned an empty response",
        data: null,
      }),
    };
  }

  return {
    ok: true,
    text,
    model,
  };
};

export const callOpenAIImage = async ({ env, prompt, size = DEFAULT_IMAGE_SIZE, background = "auto" }) => {
  const apiKey = env.OPENAI_API_KEY || "";
  const model = env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;

  if (!apiKey) {
    return {
      ok: false,
      response: json(503, {
        error: "Image generation is not configured. Add OPENAI_API_KEY to the backend .env file.",
        data: null,
      }),
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(env.AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutId = setTimeout(() => controller.abort(new Error("OpenAI image request timed out")), timeoutMs);

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        size,
        background,
      }),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      response: json(504, {
        error: error?.name === "AbortError"
          ? "OpenAI image request timed out"
          : error?.message || "Image generation failed",
        data: null,
      }),
    };
  }

  clearTimeout(timeoutId);

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      response: json(response.status, {
        error: payload?.error?.message || "Image generation failed",
        data: null,
      }),
    };
  }

  const image = payload?.data?.[0];
  const b64 = image?.b64_json || "";
  const imageUrl = b64 ? `data:image/png;base64,${b64}` : image?.url || "";

  if (!imageUrl) {
    return {
      ok: false,
      response: json(502, {
        error: "Image generation returned no image data",
        data: null,
      }),
    };
  }

  return {
    ok: true,
    imageUrl,
    model,
  };
};
