import { json } from "../_shared/context.js";
import { callGeminiText } from "../_shared/gemini.js";
import { buildLocalAiText } from "../_shared/local-ai.js";
import { callOpenAIImage, callOpenAIText } from "../_shared/openai.js";

const getSystemPrompt = (action, context, language) => {
  const basePrompt =
    "You are PitchRoom AI Studio, a creative development assistant for film writers and producers. " +
    "Give polished, practical, high-quality output that is vivid, structured, and production-aware.";

  const actionPromptMap = {
    expand_story:
      "Expand concepts into compelling creative outputs. Use headings and clean formatting when useful. Keep the result directly usable by a film creator.",
    generate_titles:
      "Generate memorable, marketable, original movie titles. Avoid generic repetition.",
    poster_concept:
      "Create visually specific poster concepts with strong cinematic detail, mood, color, and typography guidance.",
    audio_pitch:
      "Write spoken trailer and pitch material with rhythm, dramatic pacing, and performance cues when appropriate.",
    script_analysis:
      "Analyze scripts like a development executive and screenplay consultant. Return balanced, commercially aware, actionable insight.",
    character_development:
      "Develop rich, psychologically coherent film characters.",
    scene_breakdown:
      "Break scripts down like a first assistant director and line producer creating a usable production plan.",
    expand_scene:
      "Expand scenes with more cinematic detail, stronger beats, and richer tension while preserving story intent.",
    rewrite_scene:
      "Rewrite scenes for clarity, pacing, emotion, and dramatic impact.",
    generate_dialogue:
      "Write distinct, natural, performable dialogue with subtext and voice.",
    polish_dialogue:
      "Polish dialogue for clarity, voice, rhythm, and dramatic purpose.",
    format_screenplay:
      "Format material into clean screenplay-style writing.",
    story_transform:
      "Transform partial script material into a fuller story treatment with stronger structure and payoff.",
  };

  const languageInstruction = language ? `You must write the response in ${language}.` : "";

  return [basePrompt, actionPromptMap[action] || actionPromptMap.expand_story, languageInstruction, context || ""]
    .filter(Boolean)
    .join("\n\n");
};

const extractText = (payload) => {
  if (payload?.choices?.[0]?.message?.content) {
    return payload.choices[0].message.content.trim();
  }

  const responseText = payload?.output
    ?.flatMap((item) => item.content || [])
    ?.filter((item) => item.type === "output_text")
    ?.map((item) => item.text)
    ?.join("\n")
    ?.trim();

  return responseText || "";
};

const buildScriptAnalysisPrompt = (scriptText) => [
  "Analyze the following script or treatment and return valid JSON only.",
  "Required JSON shape:",
  `{
  "coverage": {
    "logline": "string",
    "synopsis": "string",
    "premise": "string",
    "strengths": ["string"],
    "weaknesses": ["string"],
    "recommendations": ["string"],
    "overallRating": 1-10,
    "commercialViability": 1-10
  },
  "genre": {
    "primary": "string",
    "secondary": ["string"],
    "tone": "string",
    "targetAudience": "string",
    "comparableTitles": ["string"],
    "uniqueElements": ["string"]
  },
  "marketability": {
    "score": 1-10,
    "budgetEstimate": "string",
    "targetPlatforms": ["string"],
    "demographicAppeal": [{"group": "string", "score": 1-10}],
    "trendAlignment": ["string"],
    "castingPotential": "string",
    "internationalAppeal": 1-10
  },
  "structure": {
    "actBreakdown": [{"act": "string", "description": "string", "strength": 1-10}],
    "pacingScore": 1-10,
    "characterArcs": [{"name": "string", "arc": "string", "development": 1-10}],
    "thematicDepth": 1-10,
    "dialogueQuality": 1-10
  }
}`,
  "Use realistic values and do not wrap the JSON in markdown fences.",
  "Script:",
  scriptText,
].join("\n\n");

const buildEnhancementPrompt = (action, scriptText, context) => {
  const promptMap = {
    expand_scene: "Expand this material into a richer, more cinematic scene.",
    rewrite_scene: "Rewrite this material to improve clarity, pacing, and dramatic impact.",
    generate_dialogue: "Generate fresh dialogue for this material while keeping voices distinct.",
    polish_dialogue: "Polish the dialogue in this material without losing intent.",
    format_screenplay: "Format this material into clean screenplay-style writing.",
    story_transform: "Transform this material into a fuller story treatment with stronger structure and emotional payoff.",
  };

  return [
    promptMap[action] || "Improve this script material.",
    context ? `Focus context: ${context}` : "",
    "Source material:",
    scriptText,
  ].filter(Boolean).join("\n\n");
};

const parsePosterSections = (text = "") => {
  const posterConceptMatch = text.match(/Poster Concept:\s*([\s\S]*?)(?=Image Prompt:|$)/i);
  const imagePromptMatch = text.match(/Image Prompt:\s*([\s\S]*?)$/i);

  return {
    posterConcept: posterConceptMatch?.[1]?.trim() || "",
    imagePrompt: imagePromptMatch?.[1]?.trim() || "",
  };
};

const normalizeJsonCandidate = (text = "") =>
  String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const isValidJsonPayload = (action, text) => {
  if (!["character_development", "scene_breakdown", "script_analysis"].includes(action)) {
    return true;
  }

  try {
    const parsed = JSON.parse(normalizeJsonCandidate(text));
    if (action === "character_development") {
      return Boolean(parsed?.name && parsed?.personality && Array.isArray(parsed?.dialoguePatterns));
    }
    if (action === "scene_breakdown") {
      return Array.isArray(parsed?.scenes);
    }
    if (action === "script_analysis") {
      return Boolean(parsed?.coverage && parsed?.genre && parsed?.marketability);
    }
    return true;
  } catch {
    return false;
  }
};

const getActionConfig = (action) => {
  const configMap = {
    expand_story: { temperature: 0.8, maxOutputTokens: 900 },
    generate_titles: { temperature: 0.7, maxOutputTokens: 260 },
    poster_concept: { temperature: 0.8, maxOutputTokens: 700 },
    audio_pitch: { temperature: 0.8, maxOutputTokens: 600 },
    script_analysis: { temperature: 0.4, maxOutputTokens: 4096 },
    character_development: { temperature: 0.8, maxOutputTokens: 1100 },
    scene_breakdown: { temperature: 0.5, maxOutputTokens: 1800 },
    expand_scene: { temperature: 0.85, maxOutputTokens: 1800 },
    rewrite_scene: { temperature: 0.8, maxOutputTokens: 1600 },
    generate_dialogue: { temperature: 0.85, maxOutputTokens: 1200 },
    polish_dialogue: { temperature: 0.7, maxOutputTokens: 1200 },
    format_screenplay: { temperature: 0.5, maxOutputTokens: 1800 },
    story_transform: { temperature: 0.8, maxOutputTokens: 1800 },
  };

  return configMap[action] || { temperature: 0.8, maxOutputTokens: 900 };
};

const shouldUseTextFallback = (action, response) => {
  if (action === "poster_concept") return false;
  const status = response?.status || 500;
  const message = String(response?.body?.error || "");
  return status === 429 || status >= 500 || /quota|rate limit|resource has been exhausted|retry in|timed out|failed/i.test(message);
};

export default async function aiStudioHandler({ user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const { action = "expand_story", context = "", language = "" } = body || {};
    const rawContent =
      body?.content ??
      body?.text ??
      body?.prompt ??
      body?.sceneData ??
      body?.characterDescription ??
      "";

    if (!String(rawContent).trim() && !body?.characterDescription && !body?.sceneData) {
      return json(400, { error: "Content is required", data: null });
    }

    let promptBody = String(rawContent);
    if (body?.characterDescription) {
      promptBody = [
        "Create a detailed JSON character profile for the following character.",
        `Character description: ${body.characterDescription}`,
        body.context ? `Story context: ${body.context}` : "",
        'Return valid JSON only with keys: name, age, physicalDescription, personality, backstory, motivation, fears, flaws, relationships, dialoguePatterns, sampleDialogue, characterArc, mannerisms.',
      ].filter(Boolean).join("\n\n");
    }
    if (action === "scene_breakdown" && body?.sceneData) {
      promptBody = [
        "Create a production-ready scene breakdown from the following script text.",
        body.sceneData,
        'Return valid JSON only with keys: scenes, summary. Include sceneNumber, heading, description, pageLength, dayNight, interiorExterior, location, characters, extras, props, wardrobe, makeup, specialEffects, stunts, vehicles, animals, sound, estimatedDuration, shootingNotes.',
      ].join("\n\n");
    }
    if (action === "script_analysis") {
      promptBody = buildScriptAnalysisPrompt(String(body?.sceneData || rawContent));
    }
    if (["expand_scene", "rewrite_scene", "generate_dialogue", "polish_dialogue", "format_screenplay", "story_transform"].includes(action)) {
      promptBody = buildEnhancementPrompt(action, String(rawContent), String(context || ""));
    }

    const actionConfig = getActionConfig(action);

    const aiResult = await callGeminiText({
      env,
      systemPrompt: getSystemPrompt(action, context, language),
      userPrompt: promptBody,
      temperature: actionConfig.temperature,
      maxOutputTokens: actionConfig.maxOutputTokens,
    });

    if (!aiResult.ok) {
      if (shouldUseTextFallback(action, aiResult.response)) {
        const fallbackResult = await callOpenAIText({
          env,
          systemPrompt: getSystemPrompt(action, context, language),
          userPrompt: promptBody,
          temperature: actionConfig.temperature,
          maxOutputTokens: actionConfig.maxOutputTokens,
        });

        if (fallbackResult.ok) {
          return json(200, {
            data: {
              action,
              model: fallbackResult.model,
              fallbackUsed: true,
              content: fallbackResult.text,
              result: fallbackResult.text,
            },
            error: null,
          });
        }
      }

      const fallbackContent = buildLocalAiText({
        action,
        content: promptBody,
        context,
        language,
      });

      return json(200, {
        data: {
          action,
          model: "pitchroom-local-fallback",
          fallbackUsed: true,
          content: fallbackContent,
          result: fallbackContent,
        },
        error: null,
      });
    }

    const generatedText = aiResult.text;
    if (!isValidJsonPayload(action, generatedText)) {
      const fallbackContent = buildLocalAiText({
        action,
        content: promptBody,
        context,
        language,
      });

      return json(200, {
        data: {
          action,
          model: "pitchroom-local-fallback",
          fallbackUsed: true,
          content: fallbackContent,
          result: fallbackContent,
        },
        error: null,
      });
    }

    if (action === "poster_concept") {
      const { imagePrompt } = parsePosterSections(generatedText);
      const imageResult = await callOpenAIImage({
        env,
        prompt: imagePrompt || generatedText,
      });

      if (!imageResult.ok) {
        return imageResult.response;
      }

      return json(200, {
        data: {
          action,
          model: aiResult.model,
          imageModel: imageResult.model,
          content: generatedText,
          result: generatedText,
          imageUrl: imageResult.imageUrl,
        },
        error: null,
      });
    }

    return json(200, {
      data: {
        action,
        model: aiResult.model,
        content: generatedText,
        result: generatedText,
      },
      error: null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "AI Studio failed",
      data: null,
    });
  }
}
