import { json } from "./context.js";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1200;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_CONTINUATIONS = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryDelayMs = (errorMessage = "") => {
  const match = String(errorMessage).match(/retry in\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.ceil(seconds * 1000);
};

export const buildGeminiUrl = (env, model) => {
  const baseUrl = (env.GEMINI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  return `${baseUrl}/models/${model}:generateContent`;
};

export const getGeminiConfig = (env) => {
  const apiKey = env.GEMINI_API_KEY || "";
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  return { apiKey, model };
};

export const extractGeminiText = (payload) => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("\n")
    .trim();

  return text || "";
};

export const extractGeminiFinishReason = (payload) =>
  String(payload?.candidates?.[0]?.finishReason || "")
    .trim()
    .toUpperCase();

const requestGeminiText = async ({
  env,
  apiKey,
  model,
  systemPrompt,
  contents,
  temperature,
  maxOutputTokens,
  timeoutMs,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("Gemini request timed out")), timeoutMs);

  try {
    const response = await fetch(`${buildGeminiUrl(env, model)}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
    });

    clearTimeout(timeoutId);
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

export const callGeminiText = async ({ env, systemPrompt, userPrompt, temperature = 0.8, maxOutputTokens = 2048 }) => {
  const { apiKey, model } = getGeminiConfig(env);

  if (!apiKey) {
    return {
      ok: false,
      response: json(503, {
        error: "AI is not configured. Add GEMINI_API_KEY to the backend .env file.",
        data: null,
      }),
    };
  }

  let attempt = 0;
  let lastStatus = 500;
  let lastError = "Gemini request failed";
  const timeoutMs = Number(env.AI_PROVIDER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxContinuations = Number(env.AI_PROVIDER_MAX_CONTINUATIONS || DEFAULT_MAX_CONTINUATIONS);

  while (attempt <= DEFAULT_RETRIES) {
    try {
      const contents = [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ];

      let combinedText = "";
      let finishReason = "";
      let continuationCount = 0;

      while (true) {
        const { response, payload } = await requestGeminiText({
          env,
          apiKey,
          model,
          systemPrompt,
          contents,
          temperature,
          maxOutputTokens,
          timeoutMs,
        });

        if (!response.ok) {
          lastStatus = response.status;
          lastError = payload?.error?.message || "Gemini request failed";
          break;
        }

        const text = extractGeminiText(payload);
        if (!text) {
          return {
            ok: false,
            response: json(502, {
              error: "Gemini returned an empty response",
              data: null,
            }),
          };
        }

        combinedText = combinedText ? `${combinedText}\n${text}`.trim() : text;
        finishReason = extractGeminiFinishReason(payload);

        if (finishReason !== "MAX_TOKENS" || continuationCount >= maxContinuations) {
          return {
            ok: true,
            text: combinedText,
            model,
            truncated: finishReason === "MAX_TOKENS",
          };
        }

        contents.push(
          {
            role: "model",
            parts: [{ text }],
          },
          {
            role: "user",
            parts: [{
              text: "Continue exactly from where you stopped. Do not restart, do not summarize, and do not repeat earlier text. Finish the response cleanly.",
            }],
          },
        );
        continuationCount += 1;
      }
    } catch (error) {
      return {
        ok: false,
        response: json(504, {
          error: error?.name === "AbortError"
            ? "Gemini request timed out"
            : error?.message || "Gemini request failed",
          data: null,
        }),
      };
    }

    const isRateLimited = lastStatus === 429;
    const canRetry = isRateLimited && attempt < DEFAULT_RETRIES;
    if (!canRetry) {
      break;
    }

    const parsedRetryDelay = parseRetryDelayMs(lastError);
    const retryAfterHeader = Number.isFinite(Number(env.RETRY_AFTER_MS))
      ? Number(env.RETRY_AFTER_MS)
      : null;
    const retryDelayMs = parsedRetryDelay
      || retryAfterHeader
      || DEFAULT_RETRY_DELAY_MS * (attempt + 1);

    await sleep(retryDelayMs);
    attempt += 1;
  }

  return {
    ok: false,
    response: json(lastStatus, {
      error: lastError,
      data: null,
    }),
  };
};
