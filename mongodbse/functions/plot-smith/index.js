import { json } from "../_shared/context.js";
import { callGeminiText } from "../_shared/gemini.js";

const PLOT_SMITH_SYSTEM_PROMPT = `You are PlotSmith, an advanced AI storytelling engine inside the platform "PitchRoom". Your purpose is to transform any user idea, prompt, or concept into a fully developed, cinematic story.

INPUT UNDERSTANDING:
- The user may provide a short phrase, vague idea, or detailed prompt.
- You must intelligently expand it into a complete narrative.
- If details are missing, creatively assume them.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "platform": "PitchRoom",
  "feature": "PlotSmith",
  "contentType": "story",
  "title": "",
  "genre": "",
  "tone": "",
  "logline": "",
  "characters": [
    {
      "name": "",
      "role": "",
      "description": "",
      "goal": ""
    }
  ],
  "world": {
    "setting": "",
    "rules": ""
  },
  "story": {
    "act1": "",
    "act2": "",
    "act3": ""
  },
  "themes": [],
  "twist": "",
  "ending": ""
}

STORY GENERATION RULES:
1. Create a powerful, cinematic title.
2. Identify genre automatically (crime, thriller, romance, fantasy, sci-fi, etc.).
3. Define tone clearly (dark, emotional, humorous, intense, etc.).
4. Write a compelling logline (1-2 lines).
5. Generate 2-5 strong characters with clear roles and motivations.
6. Build a believable world (even for realistic stories).
7. Follow strict 3-act storytelling:
   - Act 1: Setup (introduce characters, world, and inciting incident)
   - Act 2: Conflict (rising tension, obstacles, and a major twist)
   - Act 3: Resolution (climax and satisfying ending)
8. Include at least one meaningful twist.
9. Clearly state the ending (happy, tragic, open, or ambiguous).
10. Add 2-4 core themes (e.g., betrayal, love, power, redemption).
11. Expand even the smallest prompt into a rich narrative.
12. Keep storytelling vivid, emotional, and cinematic.

STRICT RULES:
- ALWAYS return valid JSON (no extra text, no markdown, no explanation).
- NEVER leave any field empty.
- Ensure proper JSON formatting (no trailing commas).
- Characters array must have at least 2 entries.
- Acts must be detailed paragraphs (not bullet points).

ERROR HANDLING:
- If input is unclear, assume a logical and creative interpretation.
- If input is extremely short (e.g., 'love story'), still generate a full structured story.

You are not a chatbot. You are a story engine. Output only JSON.`;

const normalizeJsonCandidate = (text) =>
  String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parsePlotSmithResponse = (text) => {
  const normalized = normalizeJsonCandidate(text);

  try {
    return JSON.parse(normalized);
  } catch {
    const match = normalized.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("PlotSmith returned invalid JSON");
    }
    return JSON.parse(match[0]);
  }
};

const repairPlotSmithResponse = async ({ env, rawText }) => {
  const repairPrompt = [
    "Repair the following response into valid JSON.",
    "Return JSON only.",
    'Keep this exact top-level shape: {"platform":"","feature":"","contentType":"","title":"","genre":"","tone":"","logline":"","characters":[{"name":"","role":"","description":"","goal":""}],"world":{"setting":"","rules":""},"story":{"act1":"","act2":"","act3":""},"themes":[],"twist":"","ending":""}.',
    "Rules:",
    "- Do not add markdown fences.",
    "- Do not omit any required field.",
    "- Ensure characters has at least 2 entries.",
    "- Ensure themes has 2 to 4 strings.",
    "- Ensure act1, act2, and act3 are detailed paragraphs.",
    "Response to repair:",
    rawText,
  ].join("\n\n");

  const repairResult = await callGeminiText({
    env,
    systemPrompt: "You repair malformed JSON into valid application-ready JSON. Output only JSON.",
    userPrompt: repairPrompt,
    temperature: 0.2,
    maxOutputTokens: 4096,
  });

  if (!repairResult.ok) {
    return repairResult;
  }

  return {
    ok: true,
    text: repairResult.text,
    model: repairResult.model,
  };
};

export default async function plotSmithHandler({ user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const prompt = String(body?.prompt ?? body?.content ?? body?.idea ?? "").trim();

    if (!prompt) {
      return json(400, { error: "Prompt is required", data: null });
    }

    const aiResult = await callGeminiText({
      env,
      systemPrompt: PLOT_SMITH_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.95,
      maxOutputTokens: 4096,
    });

    if (!aiResult.ok) {
      return aiResult.response;
    }

    let story;

    try {
      story = parsePlotSmithResponse(aiResult.text);
    } catch {
      const repairedResult = await repairPlotSmithResponse({
        env,
        rawText: aiResult.text,
      });

      if (!repairedResult.ok) {
        return repairedResult.response;
      }

      story = parsePlotSmithResponse(repairedResult.text);
    }

    return json(200, {
      data: {
        model: aiResult.model,
        prompt,
        story,
        content: JSON.stringify(story, null, 2),
      },
      error: null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "PlotSmith failed",
      data: null,
    });
  }
}
