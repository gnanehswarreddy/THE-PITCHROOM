export type StoryEditMode = "full_edit" | "partial_add" | "structured_update";

export interface StorySection {
  type: "backstory" | "character" | "conflict" | "plot";
  title: string;
  content: string;
}

export interface ManagedStory {
  title: string;
  genre: string;
  logline: string;
  tags: string[];
  status: "idea" | "draft" | "treatment";
  content: string;
  sections: StorySection[];
  version: number;
}

export interface StoryManagementResponse {
  updated_story: ManagedStory;
  script_outdated: boolean;
  message: string;
}

const STORY_MANAGEMENT_PROMPT = `
You are the Story Management AI for PitchRoom.

PitchRoom has:
1. STORIES -> user-created narrative content
2. SCRIPTS -> AI-generated screenplays from stories

This prompt focuses only on editing and adding new information to existing stories.

Core responsibilities:
- Preserve existing content
- Integrate new information smoothly
- Improve clarity, flow, and structure
- Maintain original tone and genre
- Do not remove important story elements unless asked

Editing modes:
1. FULL EDIT: clean grammar, improve readability, enhance descriptions, maintain consistency
2. PARTIAL ADD: merge new scenes/details/backstory/twists naturally and preserve continuity
3. STRUCTURED UPDATE: refine title, genre, logline, tags, and status concisely

Smart enhancement rules:
- Improve emotional depth
- Strengthen character motivations
- Enhance scene clarity
- Remove repetition
- Keep writing cinematic

Safety rules:
- Never overwrite the entire story without user intent
- Never delete sections unless explicitly asked
- Always preserve user-added content
- Avoid hallucinating new plot unless enhancement is requested

Output JSON only:
{
  "updated_story": {
    "title": "...",
    "genre": "...",
    "logline": "...",
    "tags": ["..."],
    "status": "idea | draft | treatment",
    "content": "Full story narrative",
    "sections": [
      {
        "type": "backstory | character | conflict | plot",
        "title": "...",
        "content": "..."
      }
    ],
    "version": number
  },
  "script_outdated": true,
  "message": "Story has been updated. Regenerate screenplay to reflect changes."
}
`.trim();

export const buildStoryManagementPrompt = ({
  mode,
  story,
  updateInstruction,
  hasLinkedScript,
}: {
  mode: StoryEditMode;
  story: ManagedStory;
  updateInstruction: string;
  hasLinkedScript: boolean;
}) =>
  [
    STORY_MANAGEMENT_PROMPT,
    "",
    `Editing mode: ${mode}`,
    `Linked screenplay exists: ${hasLinkedScript ? "yes" : "no"}`,
    "",
    "Existing story JSON:",
    JSON.stringify(story, null, 2),
    "",
    "User update request:",
    updateInstruction,
  ].join("\n");

const safeJsonSlice = (raw: string) => {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
};

const normalizeJsonLikeText = (raw: string) => {
  const input = safeJsonSlice(raw);
  let output = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      output += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        output += "\\n";
        continue;
      }
      if (char === "\r") {
        output += "\\r";
        continue;
      }
      if (char === "\t") {
        output += "\\t";
        continue;
      }
    }

    output += char;
  }

  return output
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");
};

const extractQuotedValue = (source: string, key: string) => {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;
  const colonIndex = source.indexOf(":", keyIndex);
  if (colonIndex < 0) return null;
  const firstQuote = source.indexOf("\"", colonIndex + 1);
  if (firstQuote < 0) return null;

  let value = "";
  let escaped = false;
  for (let i = firstQuote + 1; i < source.length; i += 1) {
    const char = source[i];
    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      return value;
    }
    value += char;
  }
  return value.trim() || null;
};

const extractArrayBlock = (source: string, key: string) => {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;
  const start = source.indexOf("[", keyIndex);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
};

const extractBooleanValue = (source: string, key: string) => {
  const match = source.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`, "i"));
  return match ? match[1].toLowerCase() === "true" : null;
};

const fallbackParseStoryManagementResponse = (
  raw: string,
  fallback: ManagedStory,
  hasLinkedScript: boolean,
): StoryManagementResponse => {
  const source = safeJsonSlice(raw);
  const title = extractQuotedValue(source, "title") || fallback.title;
  const genre = extractQuotedValue(source, "genre") || fallback.genre;
  const logline = extractQuotedValue(source, "logline") || fallback.logline;
  const status = (extractQuotedValue(source, "status") || fallback.status) as ManagedStory["status"];
  const content = extractQuotedValue(source, "content") || fallback.content;
  const message = extractQuotedValue(source, "message")
    || (hasLinkedScript ? "Story has been updated. Regenerate screenplay to reflect changes." : "Story updated successfully.");
  const scriptOutdated = extractBooleanValue(source, "script_outdated") ?? hasLinkedScript;

  let tags = fallback.tags;
  const tagsBlock = extractArrayBlock(source, "tags");
  if (tagsBlock) {
    const tagMatches = [...tagsBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1].trim()).filter(Boolean);
    if (tagMatches.length) tags = tagMatches;
  }

  let sections = fallback.sections;
  const sectionsBlock = extractArrayBlock(source, "sections");
  if (sectionsBlock) {
    try {
      const repairedSections = JSON.parse(normalizeJsonLikeText(`{"sections":${sectionsBlock}}`)) as { sections?: unknown[] };
      const nextSections = Array.isArray(repairedSections.sections)
        ? repairedSections.sections.map(normalizeSection).filter(Boolean) as StorySection[]
        : [];
      if (nextSections.length || sectionsBlock === "[]") sections = nextSections;
    } catch {
      sections = fallback.sections;
    }
  }

  return {
    updated_story: normalizeManagedStory({
      title,
      genre,
      logline,
      tags,
      status,
      content,
      sections,
      version: Math.max((fallback.version || 1) + 1, 1),
    }, Math.max((fallback.version || 1) + 1, 1)),
    script_outdated: scriptOutdated,
    message,
  };
};

const normalizeSection = (value: unknown): StorySection | null => {
  if (!value || typeof value !== "object") return null;
  const section = value as Record<string, unknown>;
  const type = String(section.type || "").trim() as StorySection["type"];
  const title = String(section.title || "").trim();
  const content = String(section.content || "").trim();
  if (!type || !title || !content) return null;
  if (!["backstory", "character", "conflict", "plot"].includes(type)) return null;
  return { type, title, content };
};

export const normalizeManagedStory = (value: Partial<ManagedStory>, previousVersion = 1): ManagedStory => ({
  title: String(value.title || "Untitled Story").trim(),
  genre: String(value.genre || "Drama").trim(),
  logline: String(value.logline || "").trim(),
  tags: Array.isArray(value.tags) ? value.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
  status: ["idea", "draft", "treatment"].includes(String(value.status))
    ? String(value.status) as ManagedStory["status"]
    : "idea",
  content: String(value.content || "").trim(),
  sections: Array.isArray(value.sections)
    ? value.sections.map(normalizeSection).filter(Boolean) as StorySection[]
    : [],
  version: typeof value.version === "number" && Number.isFinite(value.version) ? value.version : previousVersion,
});

export const extractStoryManagementResponse = (raw: string, fallback: ManagedStory, hasLinkedScript: boolean): StoryManagementResponse => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(safeJsonSlice(raw)) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(normalizeJsonLikeText(raw)) as Record<string, unknown>;
    } catch {
      return fallbackParseStoryManagementResponse(raw, fallback, hasLinkedScript);
    }
  }
  const updatedStory = normalizeManagedStory(
    (parsed.updated_story || {}) as Partial<ManagedStory>,
    Math.max((fallback.version || 1) + 1, 1),
  );
  const scriptOutdated = typeof parsed.script_outdated === "boolean" ? parsed.script_outdated : hasLinkedScript;
  const message = String(
    parsed.message || (scriptOutdated ? "Story has been updated. Regenerate screenplay to reflect changes." : "Story updated successfully."),
  ).trim();

  return {
    updated_story: {
      ...updatedStory,
      version: Math.max(updatedStory.version, (fallback.version || 1) + 1),
    },
    script_outdated: scriptOutdated,
    message,
  };
};

export const storyToLegacyFields = (story: ManagedStory) => ({
  title: story.title,
  genre: story.genre,
  logline: story.logline,
  status: story.status,
  notes: story.content,
  themes: story.tags,
});

export const legacyStoryToManagedStory = (story: {
  title?: string;
  genre?: string;
  logline?: string;
  status?: string;
  notes?: string;
  themes?: string[];
  characters?: string[];
  version?: number;
  sections?: StorySection[];
}) =>
  normalizeManagedStory({
    title: story.title || "",
    genre: story.genre || "Drama",
    logline: story.logline || "",
    tags: story.themes || [],
    status: (["idea", "draft", "treatment"].includes(String(story.status)) ? story.status : "idea") as ManagedStory["status"],
    content: story.notes || "",
    sections: story.sections || (story.characters || []).map((character) => ({
      type: "character" as const,
      title: character,
      content: `${character} is part of the current story draft.`,
    })),
    version: story.version || 1,
  });
