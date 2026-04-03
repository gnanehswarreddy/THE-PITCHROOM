import { json } from "../_shared/context.js";
import { callGeminiText } from "../_shared/gemini.js";
import { buildLocalIntelligenceAnalysis } from "../_shared/local-ai.js";

const promptMap = {
  "market-trends": (data) =>
    `Analyze current and near-term market trends for the ${data.genre} genre over the ${data.timeframe}.\n\nInclude:\n1. Audience appetite\n2. Streaming/theatrical relevance\n3. Common themes that are working\n4. Risks and oversaturation signs\n5. Actionable advice for creators and producers`,
  "genre-prediction": (data) =>
    `Predict how the ${data.genre} genre is likely to evolve over the next 12-24 months.\n\nInclude:\n1. Emerging trends\n2. Themes and formats likely to gain traction\n3. Audience shifts\n4. Commercial opportunities\n5. Strategic recommendations`,
  "script-evaluation": (data) =>
    `Evaluate the market potential of this script idea.\n\nTitle: ${data.title}\nGenre: ${data.genre}\nLogline: ${data.logline}\n\nProvide:\n1. Strengths\n2. Weaknesses\n3. Commercial potential\n4. Target audience\n5. Platform fit\n6. Improvement suggestions\n7. Final verdict`,
  "competitive-analysis": (data) =>
    `Provide a competitive analysis for the ${data.genre} genre.\n\nInclude:\n1. Comparable projects\n2. What is saturated\n3. What still feels fresh\n4. Positioning opportunities\n5. Advice for standing out`,
};

export default async function intelligenceAnalysisHandler({ user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const { analysisType, data = {} } = body || {};
    const userPrompt = promptMap[analysisType]?.(data);
    if (!userPrompt) {
      return json(400, { error: "Unsupported analysisType", data: null });
    }

    const aiResult = await callGeminiText({
      env,
      systemPrompt:
        "You are PitchRoom Intelligence, an AI analyst for film and media strategy. Be practical, concise, and commercially aware. Use clear headings and bullet-style sections when useful.",
      userPrompt,
      temperature: 0.4,
      maxOutputTokens: 1800,
    });

    if (!aiResult.ok) {
      return json(200, {
        data: {
          analysis: buildLocalIntelligenceAnalysis({ analysisType, data }),
          model: "pitchroom-local-fallback",
          fallbackUsed: true,
        },
        error: null,
      });
    }

    return json(200, {
      data: {
        analysis: aiResult.text,
        model: aiResult.model,
      },
      error: null,
    });
  } catch (error) {
    return json(500, {
      error: error.message || "intelligence-analysis failed",
      data: null,
    });
  }
}
