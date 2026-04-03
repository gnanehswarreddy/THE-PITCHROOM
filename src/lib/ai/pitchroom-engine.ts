export interface ScreenplayDialogue {
  character: string;
  emotion?: string;
  line: string;
}

export interface ScreenplayScene {
  scene_heading: string;
  action: string;
  dialogues: ScreenplayDialogue[];
}

export interface ScreenplayJson {
  title: string;
  scenes: ScreenplayScene[];
  status?: "draft";
  source?: "story_conversion";
  story_id?: string;
  version?: number;
  visibility?: "private" | "public";
}

const CORE_ENGINE_PROMPT = `
You are the core AI engine of PitchRoom, an AI-powered storytelling and screenplay generation system.

PitchRoom has two main content types:
1. STORIES: raw ideas, drafts, outlines, or treatments.
2. SCRIPTS: fully formatted cinematic screenplays generated from stories.

Primary workflow:
Story -> AI Conversion -> Script -> Stored in Script Library.

Core responsibility when a user provides a story:
- Analyze characters, tone, genre, plot points, and emotional arcs.
- Convert the story into a professional cinematic screenplay.
- Maintain cinematic quality: show, don't tell; natural dialogue; scene flow; genre-aligned drama, tension, or humor.

Screenplay format rules:
- Scene Heading: INT./EXT. - LOCATION - TIME
- Action: present tense, visual descriptions
- Character Name: UPPERCASE
- Dialogue: natural and emotionally aligned
- Parentheticals: sparse and only when useful

Strict rules:
- Do not output plain text scripts when screenplay JSON is requested.
- Do not skip scene formatting.
- Do not generate incomplete scripts.
- Do not mix story and script formats.
- Always maintain cinematic quality.
`.trim();

const STORY_TO_SCRIPT_RULES = `
Take the user's STORY input and return a complete screenplay in structured JSON.

Required output shape:
{
  "title": "Generated Script Title",
  "scenes": [
    {
      "scene_heading": "EXT. LOCATION - TIME",
      "action": "Scene description",
      "dialogues": [
        {
          "character": "NAME",
          "emotion": "optional",
          "line": "Dialogue text"
        }
      ]
    }
  ]
}

Generation requirements:
- Analyze the narrative deeply before writing.
- Break the screenplay into coherent scenes.
- Ensure every scene has a valid scene heading and action line.
- Use dialogue only when a character is actually speaking.
- Build a full draft, not a fragment.
- Keep the script pitch-ready and cinematic.

Workflow metadata constraints:
- status must be draft
- source must be story_conversion
- visibility defaults to private
- version defaults to 1
`.trim();

const SCRIPT_TO_STORY_RULES = `
Transform the screenplay into readable narrative prose.

Requirements:
- Remove screenplay formatting.
- Preserve the core plot, character dynamics, and emotional beats.
- Write clean prose that reads like a story, treatment, or short narrative draft.
- Do not invent a different plot unless explicitly asked.
`.trim();

const ENHANCE_SCRIPT_RULES = `
You are an advanced AI screenplay writer inside PitchRoom AI Studio.

Your job is to assist users in writing, enhancing, and refining scripts using tools such as:
- Generate Scene
- Improve Dialogues
- Add Emotions
- Format Screenplay

Critical global rules:
1. Always return a full script from beginning to end.
2. The input script is already modified by previous AI actions. Build on the current version.
3. Never reset, restart, or rewrite from scratch.
4. Preserve all existing content. Only enhance or extend.
5. Do not remove previously generated scenes, dialogues, or emotions.
6. Output only the script. No explanations, summaries, notes, headings, or bullet points.

Script format requirements:
- Include title if available
- Include scene headings
- Include character names
- Include dialogues
- Include action descriptions
- Include emotional cues when applicable
- Make the result look like a professional production-ready screenplay

Sequential action logic:
- Use the current script as the source of truth
- Preserve all previous improvements
- Return the entire updated screenplay every time
`.trim();

const getToolBehavior = (action: string) => {
  if (action === "expand_scene") {
    return `
Tool behavior: Generate Scene
- Add new scene or scenes to the existing script
- Maintain story continuity
- Do not replace or remove previous scenes
- Integrate new scenes seamlessly into the full script
`.trim();
  }

  if (action === "polish_dialogue" || action === "generate_dialogue") {
    return `
Tool behavior: Improve Dialogues
- Enhance dialogues across the current script
- Make them more natural, emotional, and impactful
- Do not change the story structure
- Return the full updated script
`.trim();
  }

  if (action === "rewrite_scene") {
    return `
Tool behavior: Add Emotions
- Add emotional depth to dialogues and action lines
- Include expressions, pauses, tone, and reactions
- Apply the enhancement across the current script
- Return the full updated script
`.trim();
  }

  if (action === "format_screenplay") {
    return `
Tool behavior: Format Screenplay
- Convert the entire current script into proper screenplay format
- Do not alter the underlying story content
- Improve structure, readability, and presentation only
- Return the full formatted script
`.trim();
  }

  return `
Tool behavior:
- Enhance the current script non-destructively
- Preserve story intent and structure
- Return the full updated script
`.trim();
};

export const buildStoryToScriptPrompt = (storySource: string) =>
  [
    CORE_ENGINE_PROMPT,
    "",
    STORY_TO_SCRIPT_RULES,
    "",
    "Story input:",
    storySource,
  ].join("\n");

export const buildStoryToScriptContext = () =>
  "Return only valid JSON for PitchRoom screenplay generation. No markdown fences. No commentary.";

export const buildEnhancementContext = (language: string, action: string) => {
  if (action === "story_transform") {
    return [
      CORE_ENGINE_PROMPT,
      "",
      SCRIPT_TO_STORY_RULES,
      "",
      `Generate output in ${language}.`,
    ].join("\n");
  }

  if (action === "format_screenplay") {
    return [
      CORE_ENGINE_PROMPT,
      "",
      ENHANCE_SCRIPT_RULES,
      "",
      getToolBehavior(action),
      "",
      `Generate output in ${language}. Return only the full screenplay as plain text, not JSON.`,
    ].join("\n");
  }

  return [
    CORE_ENGINE_PROMPT,
    "",
    ENHANCE_SCRIPT_RULES,
    "",
    getToolBehavior(action),
    "",
    `Generate output in ${language}. Keep screenplay conventions natural for this language.`,
  ].join("\n");
};

const normalizeDialogue = (value: unknown): ScreenplayDialogue | null => {
  if (!value || typeof value !== "object") return null;
  const dialogue = value as Record<string, unknown>;
  const character = String(dialogue.character || "").trim();
  const line = String(dialogue.line || "").trim();
  if (!character || !line) return null;

  const normalized: ScreenplayDialogue = {
    character: character.toUpperCase(),
    line,
  };

  const emotion = String(dialogue.emotion || "").trim();
  if (emotion) normalized.emotion = emotion;
  return normalized;
};

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
    if (char === "\"") return value;
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

const normalizeScene = (value: unknown): ScreenplayScene | null => {
  if (!value || typeof value !== "object") return null;
  const scene = value as Record<string, unknown>;
  const scene_heading = String(scene.scene_heading || "").trim();
  const action = String(scene.action || "").trim();
  if (!scene_heading || !action) return null;

  const dialogues = Array.isArray(scene.dialogues)
    ? scene.dialogues.map(normalizeDialogue).filter(Boolean) as ScreenplayDialogue[]
    : [];

  return {
    scene_heading,
    action,
    dialogues,
  };
};

const fallbackParseScreenplayJson = (raw: string, fallbackTitle: string): ScreenplayJson => {
  const source = safeJsonSlice(raw);
  const title = extractQuotedValue(source, "title") || fallbackTitle || "Generated Script";
  const scenesBlock = extractArrayBlock(source, "scenes");

  if (scenesBlock) {
    try {
      const repaired = JSON.parse(normalizeJsonLikeText(`{"scenes":${scenesBlock}}`)) as { scenes?: unknown[] };
      const scenes = Array.isArray(repaired.scenes)
        ? repaired.scenes.map(normalizeScene).filter(Boolean) as ScreenplayScene[]
        : [];

      if (scenes.length) {
        return {
          title,
          scenes,
          status: "draft",
          source: "story_conversion",
          version: 1,
          visibility: "private",
        };
      }
    } catch {
      // Fall through to plain text recovery below.
    }
  }

  const plainText = raw.trim();
  if (!plainText) {
    throw new Error("AI returned screenplay data that could not be parsed.");
  }

  return {
    title,
    scenes: [
      {
        scene_heading: "INT. UNSPECIFIED LOCATION - DAY",
        action: plainText,
        dialogues: [],
      },
    ],
    status: "draft",
    source: "story_conversion",
    version: 1,
    visibility: "private",
  };
};

export const extractScreenplayJson = (raw: string, fallbackTitle: string): ScreenplayJson => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(safeJsonSlice(raw)) as Record<string, unknown>;
  } catch {
    try {
      parsed = JSON.parse(normalizeJsonLikeText(raw)) as Record<string, unknown>;
    } catch {
      return fallbackParseScreenplayJson(raw, fallbackTitle);
    }
  }
  const title = String(parsed.title || fallbackTitle || "Generated Script").trim();
  const scenes = Array.isArray(parsed.scenes)
    ? parsed.scenes.map(normalizeScene).filter(Boolean) as ScreenplayScene[]
    : [];

  if (!scenes.length) {
    throw new Error("AI returned screenplay JSON without valid scenes.");
  }

  return {
    title,
    scenes,
    status: "draft",
    source: "story_conversion",
    version: 1,
    visibility: "private",
  };
};

export const screenplayJsonToText = (screenplay: ScreenplayJson) =>
  screenplay.scenes
    .map((scene) => {
      const dialogueBlock = scene.dialogues
        .map((dialogue) =>
          [
            dialogue.character.toUpperCase(),
            dialogue.emotion ? `(${dialogue.emotion})` : "",
            dialogue.line,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n");

      return [
        scene.scene_heading,
        "",
        scene.action,
        dialogueBlock ? `\n\n${dialogueBlock}` : "",
      ].join("\n");
    })
    .join("\n\n");
