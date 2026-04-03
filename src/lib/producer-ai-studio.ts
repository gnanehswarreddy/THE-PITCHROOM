export type ProducerStudioModule =
  | "home"
  | "story-analyzer"
  | "script-improver"
  | "scene-visualizer"
  | "budget-estimator"
  | "market-predictor"
  | "pitch-generator";

export interface AnalysisOutput {
  genre: string;
  threeActStructure: string[];
  emotionalCurve: string[];
  originalityScore: number;
  audienceEngagement: number;
  commercialViability: number;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface ImprovementOutput {
  mode: string;
  improvedText: string;
  changes: string[];
}

export interface VisualizationOutput {
  scenes: Array<{
    title: string;
    camera: string;
    lighting: string;
    mood: string;
    storyboardPrompt: string;
  }>;
}

export interface BudgetOutput {
  totalBudget: string;
  breakdown: Array<{ label: string; value: number }>;
  assumptions: string[];
}

export interface MarketOutput {
  targetAudience: string[];
  platform: string;
  successProbability: number;
  comparableFilms: string[];
  trends: string[];
}

export interface PitchOutput {
  title: string;
  tagline: string;
  logline: string;
  storySummary: string;
  characters: string[];
  visualStyle: string;
  budgetSummary: string;
}

export interface ProducerStudioProject {
  id: string;
  name: string;
  sourceText: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  analysis?: AnalysisOutput;
  improvement?: ImprovementOutput;
  visualization?: VisualizationOutput;
  budget?: BudgetOutput;
  market?: MarketOutput;
  pitch?: PitchOutput;
}

const defaultText = `Title: Ashes of Summer

Synopsis:
A washed-up stunt coordinator returns home after a suspicious on-set death is buried as an accident. As he reconnects with estranged family and former crew, he uncovers a pattern of exploitation linked to a powerful financier and must choose between protecting the industry that made him or exposing the truth.

Key elements:
- Emotional character journey
- Film industry backdrop
- Prestige thriller tone
- Mid-budget production scope`;

export const defaultProducerStudioProject = (): ProducerStudioProject => {
  const now = new Date().toISOString();
  return {
    id: `project-${Date.now()}`,
    name: "Untitled Producer Project",
    sourceText: defaultText,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
};

const keywordMap: Array<{ genre: string; words: string[] }> = [
  { genre: "Sci-Fi Thriller", words: ["future", "memory", "network", "synthetic", "technology", "space"] },
  { genre: "Prestige Drama", words: ["family", "grief", "legacy", "home", "truth", "loss"] },
  { genre: "Crime Thriller", words: ["murder", "detective", "criminal", "heist", "cover-up"] },
  { genre: "Horror", words: ["ghost", "monster", "blood", "haunting", "curse"] },
  { genre: "Romantic Drama", words: ["love", "relationship", "marriage", "heart", "romance"] },
];

const hashValue = (text: string) =>
  Array.from(text).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);

const boundedScore = (base: number, min = 55, max = 95) => Math.max(min, Math.min(max, Math.round(base)));

const detectGenre = (text: string) => {
  const lower = text.toLowerCase();
  const match = keywordMap
    .map((entry) => ({
      genre: entry.genre,
      score: entry.words.reduce((total, word) => total + (lower.includes(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];
  return match && match.score > 0 ? match.genre : "Character-Driven Thriller";
};

const summarize = (text: string, maxLength = 240) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
};

export const analyzeStory = (text: string): AnalysisOutput => {
  const clean = text.trim() || defaultText;
  const hash = hashValue(clean);
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  const genre = detectGenre(clean);
  const originalityScore = boundedScore(62 + (hash % 28));
  const audienceEngagement = boundedScore(60 + ((hash >> 2) % 31));
  const commercialViability = boundedScore(58 + ((hash >> 3) % 33));
  const overallScore = boundedScore((originalityScore + audienceEngagement + commercialViability) / 3);

  return {
    genre,
    threeActStructure: [
      "Act I establishes the world and central emotional wound clearly.",
      "Act II has strong escalation potential but benefits from tighter midpoint reversal.",
      "Act III promises catharsis; make the final decision more irreversible.",
    ],
    emotionalCurve: [
      "Measured opening with strong intrigue.",
      "Midpoint tension rises through betrayal and discovery.",
      "Ending lands best when personal stakes overtake plot mechanics.",
    ],
    originalityScore,
    audienceEngagement,
    commercialViability,
    overallScore,
    strengths: [
      `Compelling ${genre.toLowerCase()} positioning for producers evaluating market fit.`,
      wordCount > 250 ? "Rich enough narrative detail to support packaging conversations." : "Concept is easy to communicate in meetings and pitch decks.",
      "Strong thematic engine that can support talent attachment and visual identity.",
    ],
    weaknesses: [
      "Secondary character arcs may need more contrast to support repeatability and depth.",
      "The midpoint could introduce a sharper irreversible choice for momentum.",
      "Commercial comps should be clarified earlier in the logline and summary.",
    ],
    suggestions: [
      "Clarify the protagonist's external goal in one sentence.",
      "Sharpen the midpoint twist to increase urgency for producers and readers.",
      "Align theme, tone, and market positioning before moving into pitch materials.",
    ],
  };
};

export const improveScript = (text: string, mode: string, analysis?: AnalysisOutput): ImprovementOutput => {
  const source = text.trim() || defaultText;
  const lead = analysis?.genre ? `Tone target: ${analysis.genre}. ` : "";
  const prefixes: Record<string, string> = {
    emotional: "Emotional Enhancement",
    humor: "Humor Mode",
    intensity: "High Intensity",
    dialogue: "Cinematic Dialogue",
  };
  const label = prefixes[mode] || "Producer Polish";
  const improvedText = `${lead}${label}\n\n${summarize(source, 420)}\n\nProducer note pass:\n- Raise conflict in each exchange.\n- Keep subtext active beneath exposition.\n- Push scene turns to happen earlier for screen energy.`;

  return {
    mode: label,
    improvedText,
    changes: [
      "Dialogue tightened for stronger intention per line.",
      "Pacing sharpened by moving scene turns earlier.",
      "Emotional contrast increased to make casting and trailer moments clearer.",
    ],
  };
};

export const visualizeScenes = (text: string, analysis?: AnalysisOutput): VisualizationOutput => {
  const genreTone = analysis?.genre || detectGenre(text);
  return {
    scenes: [
      {
        title: "Opening Hook",
        camera: "Slow push-in with 50mm portrait framing",
        lighting: "Low-key practical lighting with sodium highlights",
        mood: `${genreTone} realism with latent dread`,
        storyboardPrompt: "A tense cinematic setup, grounded realism, moody practicals, subtle camera movement, premium streaming look",
      },
      {
        title: "Midpoint Reveal",
        camera: "Handheld over-shoulder and controlled whip pans",
        lighting: "Mixed fluorescent and cool moonlight contrast",
        mood: "Escalating pressure and discovery",
        storyboardPrompt: "High-tension reveal sequence, handheld urgency, sharp contrast lighting, cinematic blocking, dramatic atmosphere",
      },
      {
        title: "Final Choice",
        camera: "Wide master into intimate close-up",
        lighting: "Backlit silhouette with warm edge separation",
        mood: "Moral reckoning and emotional release",
        storyboardPrompt: "Climactic confrontation, emotional close-up, silhouette backlight, prestige cinema tone, decisive visual storytelling",
      },
    ],
  };
};

export const estimateBudget = (text: string, analysis?: AnalysisOutput): BudgetOutput => {
  const clean = text.toLowerCase();
  const characterHints = Math.max(4, (clean.match(/\b[A-Z][A-Za-z]+\b/g) || []).length % 10 + 4);
  const locationHints = Math.max(3, (clean.match(/\bint\b|\bext\b|location|house|street|office|studio/g) || []).length % 8 + 3);
  const genre = analysis?.genre || detectGenre(text);
  const multiplier = genre.includes("Sci-Fi") ? 1.7 : genre.includes("Drama") ? 0.9 : 1.1;
  const base = Math.round((characterHints * 1.6 + locationHints * 1.3 + 8) * multiplier);
  const breakdown = [
    { label: "Cast", value: Math.round(base * 0.24) },
    { label: "Crew", value: Math.round(base * 0.19) },
    { label: "Equipment", value: Math.round(base * 0.14) },
    { label: "Locations", value: Math.round(base * 0.16) },
    { label: "Post-production", value: Math.round(base * 0.17) },
    { label: "Contingency", value: Math.round(base * 0.10) },
  ];

  return {
    totalBudget: `$${base}M`,
    breakdown,
    assumptions: [
      `${characterHints} meaningful speaking roles estimated from submitted material.`,
      `${locationHints} core locations inferred for scheduling and production design.`,
      "Assumes premium independent production scale with moderate contingency.",
    ],
  };
};

export const predictMarket = (text: string, analysis?: AnalysisOutput, budget?: BudgetOutput): MarketOutput => {
  const genre = analysis?.genre || detectGenre(text);
  const successProbability = boundedScore((analysis?.overallScore || 72) + 4, 50, 96);
  const platform = genre.includes("Drama") ? "OTT + Festival" : genre.includes("Sci-Fi") ? "Theatrical + OTT" : "OTT";
  const totalBudget = budget?.totalBudget || "$18M";
  return {
    targetAudience: [
      "Premium streaming drama viewers 25-44",
      "Festival and awards-season audiences",
      "Urban multiplex and prestige-series crossover viewers",
    ],
    platform,
    successProbability,
    comparableFilms: genre.includes("Drama")
      ? ["Night Signal", "Cinder Lake", "Third Frame"]
      : ["Neon Divide", "Glass Empire", "The Quiet Exit"],
    trends: [
      `Current appetite for ${genre.toLowerCase()} stories remains healthy.`,
      `Budget band ${totalBudget} aligns with premium mid-scale commissioning interest.`,
      "Character-driven concepts with clear thematic hooks are outperforming generic high-concept pitches.",
    ],
  };
};

export const generatePitchDeck = (
  text: string,
  analysis?: AnalysisOutput,
  budget?: BudgetOutput,
  market?: MarketOutput,
): PitchOutput => {
  const source = text.trim() || defaultText;
  const firstLine = source.split("\n").find(Boolean)?.replace(/^title:\s*/i, "") || "Untitled Project";
  const genre = analysis?.genre || detectGenre(source);
  return {
    title: firstLine,
    tagline: `A ${genre.toLowerCase()} built for premium audience momentum.`,
    logline: summarize(source, 180),
    storySummary: summarize(source, 420),
    characters: ["Lead protagonist with unresolved past", "Primary ally with conflicted loyalty", "Antagonist protecting a fragile empire"],
    visualStyle: "Glossy grounded realism, dramatic practical lighting, emotionally intimate camera language.",
    budgetSummary: `${budget?.totalBudget || "$18M"} estimated, best suited for ${market?.platform || "OTT / festival crossover"} release planning.`,
  };
};

export const workflowSteps: Array<{ key: ProducerStudioModule; label: string; hint: string }> = [
  { key: "story-analyzer", label: "Analyze", hint: "Map structure, viability, and audience pull." },
  { key: "script-improver", label: "Improve", hint: "Polish scenes and dialogue with targeted modes." },
  { key: "scene-visualizer", label: "Visualize", hint: "Convert script insight into cinematic staging." },
  { key: "budget-estimator", label: "Budget", hint: "Estimate scale and cost drivers from the material." },
  { key: "market-predictor", label: "Market", hint: "Predict audience, platform, and trend fit." },
  { key: "pitch-generator", label: "Pitch", hint: "Turn the full workflow into a deck-ready package." },
];
