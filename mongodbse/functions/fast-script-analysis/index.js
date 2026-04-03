import { json } from "../_shared/context.js";
import { readFileSync } from "fs";
import { join } from "path";

// Fast script analysis function - optimized for under 30 seconds
export default async function fastScriptAnalysisHandler({ user, body, env }) {
  try {
    if (!user?.id) {
      return json(401, { error: "Unauthorized", data: null });
    }

    const { scriptContent, fileName = "script" } = body || {};

    if (!scriptContent || typeof scriptContent !== "string") {
      return json(400, { error: "Script content is required", data: null });
    }

    // Start timing
    const startTime = Date.now();

    // Step 1: Basic text preprocessing (2-3 seconds)
    const features = preprocessScript(scriptContent);

    // Step 2: Parallel analysis pipeline (20-25 seconds)
    const analysisPromises = [
      analyzeGenre(features),
      analyzeStructure(features),
      analyzeCharacters(features),
      analyzeDialogue(features),
      analyzeMarketability(features)
    ];

    const [genre, structure, characters, dialogue, marketability] = await Promise.all(analysisPromises);

    // Step 3: Compile results (2-3 seconds)
    const processingTime = (Date.now() - startTime) / 1000;

    // Generate coverage analysis
    const totalPages = Math.ceil(features.wordCount / 200); // Standard: ~200 words per page
    const estimatedRuntime = Math.ceil(totalPages * 1); // Standard: 1 page = 1 minute

    const coverage = {
      overallRating: Math.round(Math.min(10, (structure.structureScore * 10 + dialogue.dialogueScore * 10) / 2)),
      commercialViability: Math.round(Math.min(10, marketability.marketScore * 10)),
      logline: `A ${genre.primary.toLowerCase()} story that explores ${features.characters.length > 0 ? 'character development' : 'narrative depth'}.`,
      synopsis: `This ${features.scenes.length}-scene script follows a journey through ${structure.estimatedStructure.toLowerCase()}.`,
      premise: "When faced with overwhelming challenges, the characters must confront their deepest fears.",
      strengths: ["Strong character development", "Compelling narrative structure", "Emotional resonance"],
      weaknesses: features.scenes.length < 10 ? ["Limited scene variety"] : ["Some pacing issues"],
      recommendations: features.characters.length < 3 ? ["Consider adding more characters"] : ["Develop character relationships further"]
    };

    const result = {
      coverage,
      genre,
      structure,
      characters,
      dialogue,
      marketability,
      metadata: {
        processingTime: Math.round(processingTime * 100) / 100,
        wordCount: features.wordCount,
        totalPages: totalPages,
        estimatedRuntime: estimatedRuntime,
        sceneCount: features.scenes.length,
        characterCount: features.characters.length,
        analyzedAt: new Date().toISOString()
      },
      confidenceScores: {
        genre: genre.confidence || 0.8,
        structure: structure.confidence || 0.9,
        characters: characters.confidence || 0.7,
        dialogue: dialogue.confidence || 0.8,
        marketability: marketability.confidence || 0.6
      }
    };

    return json(200, {
      data: result,
      error: null,
    });
  } catch (error) {
    console.error("Fast script analysis error:", error);
    return json(500, {
      error: error.message || "Script analysis failed",
      data: null,
    });
  }
}

// Preprocessing functions
function preprocessScript(text) {
  // Extract scenes
  const scenes = extractScenes(text);

  // Extract dialogue
  const dialogue = extractDialogue(text);

  // Extract characters
  const characters = extractCharacters(text);

  // Basic structure analysis
  const structure = analyzeBasicStructure(text, scenes);

  return {
    rawText: text,
    scenes,
    dialogue,
    characters,
    structure,
    wordCount: text.split(/\s+/).length,
    pageCount: Math.ceil(text.split(/\s+/).length / 200) // Approximate
  };
}

function extractScenes(text) {
  const scenePattern = /(?:INT\.|EXT\.)\s*.*?(?=(?:INT\.|EXT\.|$))/gis;
  const matches = text.match(scenePattern) || [];

  return matches.map((scene, index) => {
    const headingMatch = scene.match(/^(INT\.|EXT\.)\s*([^\n]*)/i);
    const heading = headingMatch ? headingMatch[0] : `Scene ${index + 1}`;

    return {
      number: index + 1,
      heading: heading.trim(),
      content: scene.trim(),
      wordCount: scene.split(/\s+/).length
    };
  });
}

function extractDialogue(text) {
  const dialoguePattern = /^([A-Z][A-Z\s]+?)\n(.*?)(?=\n[A-Z][A-Z\s]+?\n|\n[A-Z][A-Z\s]*$|$)/gms;
  const matches = [...text.matchAll(dialoguePattern)];

  return matches
    .filter(match => match[2].trim().length > 10)
    .map(match => ({
      character: match[1].trim(),
      text: match[2].trim(),
      wordCount: match[2].split(/\s+/).length
    }));
}

function extractCharacters(text) {
  const characterPattern = /^([A-Z][A-Z\s]+?)\n/gm;
  const matches = [...text.matchAll(characterPattern)];

  const characters = new Set();
  matches.forEach(match => {
    const name = match[1].trim();
    if (name.length > 1 && name.length < 30) {
      characters.add(name);
    }
  });

  return Array.from(characters).sort();
}

function analyzeBasicStructure(text, scenes) {
  const actBreaks = (text.match(/ACT\s+[IVX]+/gi) || []).length;
  const sceneLengths = scenes.map(scene => scene.wordCount);
  const avgSceneLength = sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length || 0;

  return {
    actBreaks,
    sceneCount: scenes.length,
    avgSceneLength: Math.round(avgSceneLength),
    estimatedStructure: actBreaks >= 2 ? 'Three-Act' : 'Alternative'
  };
}

// Analysis functions
async function analyzeGenre(features) {
  const text = features.rawText.toLowerCase();

  const genreKeywords = {
    'Comedy': ['laugh', 'funny', 'joke', 'humor', 'comedy', 'hilarious'],
    'Drama': ['drama', 'emotional', 'serious', 'tear', 'cry', 'heartbreaking'],
    'Action': ['action', 'fight', 'explosion', 'chase', 'battle', 'gun', 'car'],
    'Thriller': ['thriller', 'suspense', 'mystery', 'tension', 'scary', 'killer'],
    'Romance': ['love', 'romance', 'kiss', 'relationship', 'heart', 'marriage'],
    'Sci-Fi': ['space', 'future', 'technology', 'alien', 'robot', 'spaceship'],
    'Horror': ['horror', 'scary', 'ghost', 'monster', 'fear', 'blood', 'death']
  };

  const genreScores = {};
  let totalScore = 0;

  for (const [genre, keywords] of Object.entries(genreKeywords)) {
    const score = keywords.reduce((sum, keyword) => sum + (text.split(keyword).length - 1), 0);
    genreScores[genre] = score;
    totalScore += score;
  }

  // Normalize scores
  if (totalScore > 0) {
    for (const genre in genreScores) {
      genreScores[genre] = genreScores[genre] / totalScore;
    }
  }

  const sortedGenres = Object.entries(genreScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return {
    primary: sortedGenres[0]?.[0] || 'Drama',
    secondary: sortedGenres.slice(1).map(([genre]) => genre),
    tone: 'Dramatic',
    targetAudience: 'General Audience',
    comparableTitles: ['Similar Title 1', 'Similar Title 2', 'Similar Title 3'],
    uniqueElements: ['Strong character development', 'Compelling narrative', 'Visual storytelling'],
    confidenceScores: genreScores,
    confidence: sortedGenres[0]?.[1] || 0.5
  };
}

async function analyzeStructure(features) {
  const { scenes, structure } = features;

  // Pacing analysis
  const sceneLengths = scenes.map(s => s.wordCount);
  const avgLength = sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length || 0;
  const variance = sceneLengths.reduce((sum, length) => sum + Math.pow(length - avgLength, 2), 0) / sceneLengths.length || 0;
  const pacingVariety = Math.max(0, 1 - (variance / (avgLength * avgLength)));

  // Structure quality
  const structureScore = Math.min(1.0, (
    (structure.estimatedStructure === 'Three-Act' ? 0.3 : 0.2) +
    (structure.actBreaks >= 2 ? 0.3 : 0.1) +
    (structure.sceneCount >= 20 ? 0.2 : 0.1) +
    (pacingVariety * 0.2)
  ));

  return {
    ...structure,
    pacingScore: Math.round(structureScore * 10), // Convert to 1-10 scale
    thematicDepth: 8, // Placeholder for now
    dialogueQuality: 8, // Placeholder for now
    actBreakdown: [
      { act: "Act I", description: "Setup and inciting incident", strength: 8 },
      { act: "Act II", description: "Rising action and confrontation", strength: 7 },
      { act: "Act III", description: "Climax and resolution", strength: 9 }
    ],
    characterArcs: [
      { name: "Main Character", arc: "Transformation from doubt to confidence", development: 8 }
    ],
    pacingVariety: Math.round(pacingVariety * 100) / 100,
    structureScore: Math.round(structureScore * 100) / 100,
    confidence: 0.9
  };
}

async function analyzeCharacters(features) {
  const { characters, dialogue } = features;

  // Character dialogue distribution
  const characterDialogue = {};
  dialogue.forEach(d => {
    characterDialogue[d.character] = (characterDialogue[d.character] || 0) + 1;
  });

  // Main characters (top 5 by dialogue count)
  const mainCharacters = Object.entries(characterDialogue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      dialogueCount: count,
      dialoguePercentage: Math.round((count / dialogue.length) * 100)
    }));

  // Character development score
  const characterScore = Math.min(1.0, (
    (characters.length >= 3 && characters.length <= 10 ? 0.4 : 0.2) +
    (mainCharacters.length >= 2 ? 0.3 : 0.1) +
    (dialogue.length > 0 ? 0.3 : 0)
  ));

  return {
    totalCharacters: characters.length,
    mainCharacters,
    characterDialogue,
    characterScore: Math.round(characterScore * 100) / 100,
    confidence: 0.7
  };
}

async function analyzeDialogue(features) {
  const { dialogue, rawText } = features;

  if (dialogue.length === 0) {
    return {
      totalDialogueLines: 0,
      averageDialogueLength: 0,
      characterVariety: 0,
      sentimentDistribution: { positive: 0.5, negative: 0.5 },
      dialogueScore: 0,
      dialogueRatio: 0, // Percentage of dialogue vs. action
      emotionalDepth: 0,
      confidence: 0
    };
  }

  // Calculate dialogue ratio (dialogue words vs. total words)
  const dialogueWords = dialogue.reduce((sum, d) => sum + d.wordCount, 0);
  const dialogueRatio = Math.round((dialogueWords / features.wordCount) * 100);

  // Dialogue length analysis
  const dialogueLengths = dialogue.map(d => d.wordCount);
  const avgLength = dialogueLengths.reduce((a, b) => a + b, 0) / dialogueLengths.length;

  // Character variety
  const uniqueCharacters = new Set(dialogue.map(d => d.character));
  const characterVariety = uniqueCharacters.size / Math.max(dialogue.length, 1);

  // Simple sentiment analysis (keyword-based)
  const positiveWords = ['love', 'happy', 'good', 'great', 'wonderful', 'amazing', 'beautiful', 'hope', 'joy'];
  const negativeWords = ['hate', 'sad', 'bad', 'terrible', 'awful', 'horrible', 'death', 'fear', 'anger'];

  let positiveCount = 0;
  let negativeCount = 0;

  dialogue.forEach(d => {
    const text = d.text.toLowerCase();
    positiveWords.forEach(word => {
      positiveCount += (text.split(word).length - 1);
    });
    negativeWords.forEach(word => {
      negativeCount += (text.split(word).length - 1);
    });
  });

  const totalSentimentWords = positiveCount + negativeCount;
  const sentimentDistribution = totalSentimentWords > 0 ? {
    positive: positiveCount / totalSentimentWords,
    negative: negativeCount / totalSentimentWords
  } : { positive: 0.5, negative: 0.5 };

  // Calculate emotional depth based on sentiment variety and dialogue complexity
  const emotionalDepth = Math.round(Math.min(10, (
    (Math.abs(sentimentDistribution.positive - 0.5) * 20) + // Emotional balance
    (characterVariety * 5) + // Character emotional variety
    (avgLength > 10 && avgLength < 30 ? 3 : 1) // Appropriate dialogue length
  )));

  // Dialogue quality score
  const dialogueScore = Math.min(1.0, (
    (avgLength >= 5 && avgLength <= 25 ? 0.4 : 0.2) +
    (characterVariety >= 0.1 ? 0.3 : 0.1) +
    (Math.abs(sentimentDistribution.positive - 0.5) < 0.3 ? 0.3 : 0.1)
  ));

  return {
    totalDialogueLines: dialogue.length,
    averageDialogueLength: Math.round(avgLength * 100) / 100,
    characterVariety: Math.round(characterVariety * 100) / 100,
    sentimentDistribution,
    dialogueScore: Math.round(dialogueScore * 100) / 100,
    dialogueRatio: dialogueRatio,
    emotionalDepth: emotionalDepth,
    confidence: 0.8
  };
}

async function analyzeMarketability(features) {
  const { characters, scenes, pageCount } = features;

  // Market factors
  const factors = {
    characterCount: Math.min(1.0, characters.length / 8), // Optimal 5-8 characters
    sceneCount: Math.min(1.0, scenes.length / 30), // Optimal 25-35 scenes
    length: pageCount >= 80 && pageCount <= 120 ? 1.0 : (pageCount >= 60 && pageCount <= 140 ? 0.7 : 0.4),
    structureComplexity: scenes.length > 10 ? 0.8 : 0.5
  };

  const marketScore = Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;

  // Budget estimation
  const budgetEstimate = marketScore > 0.8 ? 'High' : marketScore > 0.6 ? 'Medium' : 'Low';

  // Target audience
  const targetAudience = marketScore > 0.7 ? 'Wide Appeal' : 'Niche Appeal';

  // Comparable titles (simplified)
  const comparableTitles = [
    'The Shawshank Redemption',
    'The Godfather',
    'Pulp Fiction',
    'Forrest Gump',
    'The Dark Knight'
  ];

  return {
    marketScore: Math.round(marketScore * 100) / 100,
    budgetEstimate,
    targetAudience,
    comparableTitles: comparableTitles.slice(0, 3),
    marketFactors: factors,
    confidence: 0.6
  };
}
