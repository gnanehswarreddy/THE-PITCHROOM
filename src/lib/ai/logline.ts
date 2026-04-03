import { mongodbClient } from "@/lib/mongodb/client";

const MAX_LOG_WORDS = 40;
const MAX_LOG_CHARACTERS = 200;

const normalizeOneLine = (text: string): string => {
  const clean = text
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";

  // Remove common wrappers and labels the model may return.
  const unlabeled = clean
    .replace(/^"|"$/g, "")
    .replace(/^logline\s*:\s*/i, "")
    .replace(/^here'?s\s+your\s+logline\s*:\s*/i, "")
    .trim();

  const sentence = unlabeled.split(/(?<=[.!?])\s+/)[0] ?? unlabeled;
  return sentence.slice(0, MAX_LOG_CHARACTERS).trim();
};

const countWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const looksUsableLogline = (text: string): boolean => {
  if (!text) return false;
  const words = countWords(text);
  if (words < 10 || words > 55) return false;

  const normalized = text.toLowerCase();
  if (
    normalized.includes("json") ||
    normalized.includes("```") ||
    normalized.includes("screenplay") ||
    normalized.includes("analysis")
  ) {
    return false;
  }

  return true;
};

const tightenToWordLimit = (text: string, limit = MAX_LOG_WORDS): string => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= limit && text.trim().length <= MAX_LOG_CHARACTERS) return text.trim();
  const clipped = words.slice(0, limit).join(" ").replace(/[,:;\-]+$/g, "");
  const punctuated = /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
  return punctuated.slice(0, MAX_LOG_CHARACTERS).trim().replace(/[,:;\-]+$/g, "");
};

const fallbackLogline = (title: string, genre: string, scriptText: string): string => {
  const firstSentence = normalizeOneLine(scriptText);
  if (firstSentence.length >= 40 && looksUsableLogline(firstSentence)) {
    return tightenToWordLimit(firstSentence);
  }

  const genreLabel = genre?.trim() ? genre : "dramatic";
  const safeTitle = title?.trim() || "Untitled Story";
  return `${safeTitle} is a ${genreLabel.toLowerCase()} story about a protagonist pushed toward a life-changing decision.`;
};

const buildPrompt = ({
  title,
  genre,
  language,
  scriptText,
  improve,
}: {
  title: string;
  genre: string;
  language: string;
  scriptText: string;
  improve?: string;
}) => {
  const sections = [
    "You are an expert film development executive.",
    "Task: Write exactly ONE cinematic logline from the screenplay text.",
    "Output constraints:",
    "- One sentence only.",
    "- Mention protagonist, central conflict, and stakes.",
    "- Keep it specific and vivid, avoid generic words.",
    "- No bullets, no labels, no quotes, no markdown.",
    `- Max ${MAX_LOG_WORDS} words.`,
    `Title: ${title || "Untitled"}`,
    `Genre: ${genre || "Unknown"}`,
    `Language: ${language || "English"}`,
    improve ? `Revise this draft into a stronger logline: ${improve}` : "",
    "Script:",
    scriptText.slice(0, 16000),
  ];
  return sections.filter(Boolean).join("\n\n");
};

export const generateLoglineFromScript = async ({
  title,
  genre,
  language,
  scriptText,
}: {
  title: string;
  genre: string;
  language: string;
  scriptText: string;
}): Promise<string> => {
  const trimmedText = scriptText.trim();
  if (!trimmedText) return fallbackLogline(title, genre, scriptText);

  const prompt = buildPrompt({
    title,
    genre,
    language,
    scriptText: trimmedText,
  });

  try {
    const { data, error } = await mongodbClient.functions.invoke("ai-studio", {
      body: {
        action: "expand_story",
        language: language || "English",
        content: prompt,
      },
    });

    if (error) {
      return fallbackLogline(title, genre, scriptText);
    }

    const content = typeof data?.content === "string" ? data.content : "";
    let oneLine = tightenToWordLimit(normalizeOneLine(content));

    // Second pass: if first result is weak, ask model to rewrite that draft cleanly.
    if (!looksUsableLogline(oneLine)) {
      const rewritePrompt = buildPrompt({
        title,
        genre,
        language,
        scriptText: trimmedText,
        improve: oneLine || fallbackLogline(title, genre, scriptText),
      });

      const rewritten = await mongodbClient.functions.invoke("ai-studio", {
        body: {
          action: "rewrite_scene",
          language: language || "English",
          content: rewritePrompt,
        },
      });

      if (!rewritten.error && typeof rewritten.data?.content === "string") {
        oneLine = tightenToWordLimit(normalizeOneLine(rewritten.data.content));
      }
    }

    return looksUsableLogline(oneLine) ? oneLine : fallbackLogline(title, genre, scriptText);
  } catch {
    return fallbackLogline(title, genre, scriptText);
  }
};
