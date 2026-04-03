const toWords = (value = "") =>
  String(value)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const firstSentence = (value = "", fallback = "A new cinematic story unfolds.") => {
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || fallback;
};

const titleFromPrompt = (value = "", fallback = "Untitled Pitch") => {
  const cleaned = String(value).replace(/[^a-zA-Z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned
    .split(" ")
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const detectGenre = (value = "") => {
  const text = String(value).toLowerCase();
  const tests = [
    ["Sci-Fi", ["space", "future", "time", "robot", "alien", "technology"]],
    ["Romance", ["love", "romance", "relationship", "heart"]],
    ["Thriller", ["thriller", "murder", "secret", "killer", "conspiracy", "danger", "suspense", "chase"]],
    ["Horror", ["ghost", "haunted", "blood", "monster", "curse"]],
    ["Comedy", ["funny", "comed", "awkward", "laugh"]],
    ["Action", ["fight", "chase", "explosion", "assassin", "stunt"]],
  ];

  for (const [genre, keywords] of tests) {
    if (keywords.some((keyword) => text.includes(keyword))) return genre;
  }
  return "Drama";
};

const detectTone = (genre) => {
  const toneMap = {
    "Sci-Fi": "Visionary and urgent",
    Romance: "Emotional and intimate",
    Thriller: "Tense and suspenseful",
    Horror: "Dread-soaked and atmospheric",
    Comedy: "Sharp and playful",
    Action: "Kinetic and cinematic",
    Drama: "Emotional and grounded",
  };

  return toneMap[genre] || "Cinematic and emotionally grounded";
};

export const buildLocalAiText = ({ action = "expand_story", content = "", context = "", language = "" }) => {
  const source = String(content || "").trim();
  const genre = detectGenre(`${source} ${context}`);
  const tone = detectTone(genre);
  const title = titleFromPrompt(source, "PitchRoom Draft");
  const opener = firstSentence(source, "A creative spark becomes a cinematic moment.");
  const languageNote = language ? `Language target: ${language}.` : "";

  const actionMap = {
    expand_story: [
      `Title: ${title}`,
      "",
      `Logline: In this ${genre.toLowerCase()} with a ${tone.toLowerCase()} edge, an ordinary life is shattered when ${opener.toLowerCase()}, forcing the protagonist into a dangerous maze of secrets, betrayal, and escalating stakes.`,
      "",
      "Synopsis:",
      `When the first clue appears, the lead character thinks the disruption can be contained quietly. Instead, each decision pulls them deeper into a conspiracy that touches their past, their closest relationships, and a public truth someone powerful is desperate to bury.`,
      `As pressure mounts, the protagonist must outmaneuver a calculating antagonist, survive a series of reversals, and choose whether exposing the truth is worth sacrificing the last safe version of their life. The final turn leaves the story with a cinematic hook and sequel-ready emotional resonance.`,
      "",
      "Main Character:",
      "A sharp but emotionally guarded protagonist whose instincts are strong, but whose trust in others has been damaged by an old betrayal. Their arc is about learning that survival alone is not enough if it costs them their identity.",
      "",
      "Unique Selling Point:",
      `A ${genre.toLowerCase()} concept built around emotional intimacy, a high-pressure mystery engine, and a visual world designed for strong trailer moments and marketable key art.`,
    ],
    expand_scene: [
      `${title}`,
      "",
      `${opener} The scene opens with precise visual detail, layered tension, and a clear emotional objective for the lead character.`,
      `As the moment develops, the environment starts pushing back. Small gestures, pauses, and reactions reveal what the characters are hiding from one another.`,
      `By the end of the beat, the scene lands on a stronger turn: a discovery, accusation, or irreversible decision that propels the story forward. ${languageNote}`.trim(),
    ],
    rewrite_scene: [
      `${title}`,
      "",
      `INT. REFINED LOCATION - ${tone.toUpperCase()}`,
      "",
      `${opener}`,
      "",
      "The exchange becomes cleaner, sharper, and more dramatic as each line now pushes conflict instead of repeating information.",
      "",
      "The scene ends on a stronger image or line that gives the next sequence momentum.",
    ],
    generate_dialogue: [
      "CHARACTER A",
      "I kept telling myself this was only a bad night. Now it feels like the first honest moment we've had in weeks.",
      "",
      "CHARACTER B",
      "Honest? Honest would have been saying you were afraid before everything started breaking around us.",
      "",
      "CHARACTER A",
      "I wasn't afraid of the truth. I was afraid of what it would cost once you believed me.",
      "",
      languageNote,
    ],
    polish_dialogue: [
      "Polished Dialogue",
      "",
      `"${opener}" becomes more direct, more character-specific, and more playable for actors.`,
      "Each line now carries subtext, with fewer filler phrases and clearer emotional shifts between speakers.",
      "The revised exchange keeps the original intent but lands with stronger rhythm and cleaner escalation.",
      languageNote,
    ],
    format_screenplay: [
      `TITLE: ${title.toUpperCase()}`,
      "",
      "FADE IN:",
      "",
      "INT. PRIMARY LOCATION - NIGHT",
      "",
      `${opener}`,
      "",
      "A decisive beat closes the moment and transitions naturally into the next scene.",
      "",
      "FADE OUT.",
    ],
    story_transform: [
      `${title}`,
      "",
      `Logline: In this ${genre.toLowerCase()} story, a protagonist is forced to confront a defining fear after one destabilizing event changes everything.`,
      "",
      "Act I: The world and emotional stakes are established quickly, grounding the audience in the protagonist's flaw and desire.",
      "",
      "Act II: Pressure mounts through setbacks, reversals, and a midpoint revelation that deepens the central conflict.",
      "",
      "Act III: The protagonist makes a costly choice, resolves the emotional arc, and earns an ending with clear thematic payoff.",
      "",
      languageNote,
    ],
    character_development: JSON.stringify({
      name: titleFromPrompt(source.split(/[.,\n]/)[0], "Lead Character"),
      age: "Mid 30s",
      physicalDescription: "Expressive eyes, a controlled posture, and a presence that suggests both resilience and fatigue.",
      personality: {
        traits: ["observant", "guarded", "resourceful", "emotionally intense"],
        mbtiType: "INFJ",
        enneagram: "6w5",
      },
      backstory: `${opener} Their past left them highly capable, but deeply reluctant to trust easy answers.`,
      motivation: "To regain control over a life that has started slipping beyond their expectations.",
      fears: ["being abandoned", "making the wrong sacrifice", "losing moral clarity"],
      flaws: ["withholds vulnerability", "overthinks pressure", "pushes allies away"],
      relationships: [
        { name: "Closest Ally", relationship: "A loyal friend who challenges the character's isolation." },
        { name: "Primary Rival", relationship: "A mirror figure who exposes the character's blind spots." },
      ],
      dialoguePatterns: ["speaks carefully before escalating", "uses precise language when emotional", "deflects with dry humor"],
      sampleDialogue: [
        "You think I need certainty. I just need one reason not to walk away.",
        "Every promise in this room has a price attached to it.",
      ],
      characterArc: "Moves from guarded self-protection to a more courageous and emotionally honest form of leadership.",
      mannerisms: ["taps a finger while thinking", "avoids eye contact before difficult truths", "straightens objects when anxious"],
    }, null, 2),
    scene_breakdown: JSON.stringify(buildLocalSceneBreakdown(source), null, 2),
  };

  const resolved =
    actionMap[action]
    || [
      `${title}`,
      "",
      opener,
      `Genre: ${genre}. Tone: ${tone}.`,
      languageNote,
    ];

  return Array.isArray(resolved)
    ? resolved.filter(Boolean).join("\n")
    : resolved;
};

export const buildLocalSceneBreakdown = (content = "") => {
  const scenes = String(content)
    .split(/(?=INT\.|EXT\.)/i)
    .map((scene) => scene.trim())
    .filter(Boolean)
    .slice(0, 8);

  const normalizedScenes = (scenes.length ? scenes : [String(content).trim() || "INT. UNKNOWN LOCATION - DAY"]).map((scene, index) => {
    const heading = scene.split("\n")[0]?.trim() || `Scene ${index + 1}`;
    const locationName = heading.replace(/^(INT\.|EXT\.)\s*/i, "").split("-")[0]?.trim() || `Location ${index + 1}`;
    return {
      sceneNumber: index + 1,
      heading,
      description: firstSentence(scene, "A key dramatic beat unfolds with clear production requirements."),
      pageLength: "1-2 pages",
      dayNight: /night/i.test(heading) ? "Night" : "Day",
      interiorExterior: /^EXT\./i.test(heading) ? "Exterior" : "Interior",
      location: {
        name: locationName,
        requirements: ["Controlled lighting setup", "Dialogue coverage", "Basic set dressing"],
        notes: "Plan for emotional close-ups and a clean master shot.",
      },
      characters: ["Lead", "Support"],
      extras: { count: 0, description: "No major background action required." },
      props: ["phone", "bag", "table paperwork"],
      wardrobe: [
        { character: "Lead", costume: "Primary costume continuity look" },
        { character: "Support", costume: "Neutral supporting wardrobe" },
      ],
      makeup: ["Natural continuity makeup"],
      specialEffects: [],
      stunts: [],
      vehicles: [],
      animals: [],
      sound: ["Room tone", "Key dialogue capture"],
      estimatedDuration: "2-3 min",
      shootingNotes: "Capture a performance-driven version first, then pickups for inserts and reactions.",
    };
  });

  return {
    scenes: normalizedScenes,
    summary: {
      totalScenes: normalizedScenes.length,
      totalPages: `${Math.max(1, normalizedScenes.length * 2)}`,
      estimatedShootDays: Math.max(1, Math.ceil(normalizedScenes.length / 3)),
      uniqueLocations: [...new Set(normalizedScenes.map((scene) => scene.location.name))],
      mainCast: ["Lead", "Support"],
      keyProductionNotes: [
        "Group scenes by location to reduce setup time.",
        "Prioritize dialogue coverage and reaction inserts.",
      ],
    },
  };
};

export const buildLocalPlotSmithStory = (prompt = "") => {
  const genre = detectGenre(prompt);
  const tone = detectTone(genre);
  const title = titleFromPrompt(prompt, "Fragments of Tomorrow");
  const words = toWords(prompt);
  const seed = words.slice(0, 12).join(" ") || "a life-changing idea";

  return {
    platform: "PitchRoom",
    feature: "PlotSmith",
    contentType: "story",
    title,
    genre,
    tone,
    logline: `When ${seed.toLowerCase()} disrupts an ordinary life, a determined protagonist must risk intimacy, identity, and certainty to reach the truth.`,
    characters: [
      {
        name: "Asha",
        role: "Protagonist",
        description: "A talented but emotionally guarded lead who wants control more than comfort.",
        goal: "To understand the force that has upended her world before it destroys what she loves.",
      },
      {
        name: "Rian",
        role: "Catalyst",
        description: "A magnetic outsider whose arrival turns theory into personal stakes.",
        goal: "To persuade Asha to act before the window for change closes.",
      },
      {
        name: "Dev Malhotra",
        role: "Antagonistic pressure",
        description: "A polished authority figure who prefers order over truth.",
        goal: "To contain the disruption and preserve the system that benefits him.",
      },
    ],
    world: {
      setting: `A cinematic ${genre.toLowerCase()} world where private emotion collides with public consequence.`,
      rules: "Every major choice reveals hidden costs, and unresolved secrets return in physical, social, or emotional form.",
    },
    story: {
      act1: `Asha's routine is shattered by a discovery tied to ${seed.toLowerCase()}. The inciting incident forces her into contact with Rian, who knows more than he first admits. By the end of the act, she chooses pursuit over safety.`,
      act2: "As clues accumulate, alliances shift and the central mystery grows more intimate. The search exposes old wounds, deepens attraction and distrust, and culminates in a twist that reframes who has really been controlling events.",
      act3: "With time running out, Asha confronts the architect of the conflict and must decide what she is willing to lose. The climax resolves the external threat while completing her emotional transformation from guarded observer to decisive participant.",
    },
    themes: ["trust", "identity", "sacrifice"],
    twist: "The evidence Asha has been chasing was partially created by her own forgotten past decision, making her both witness and participant.",
    ending: "Bittersweet but hopeful: the truth comes at a cost, yet the final image suggests a more honest future has finally begun.",
  };
};

export const buildLocalIntelligenceAnalysis = ({ analysisType = "", data = {} }) => {
  const genre = data.genre || "Drama";
  const title = data.title || "Untitled Project";
  const logline = data.logline || "A project with emotional stakes and commercial potential.";

  const sections = {
    "market-trends": [
      `Market Trends: ${genre}`,
      "",
      "Audience appetite remains strongest when familiar genre pleasures are paired with a sharper hook or point of view.",
      "Streaming buyers tend to favor concepts that can be sold in one sentence and support strong key art.",
      "Commercial risk rises when the premise feels derivative or budget scale is not matched to audience size.",
      "Recommendation: position the concept around one distinct emotional engine and one memorable visual idea.",
    ],
    "genre-prediction": [
      `Genre Prediction: ${genre}`,
      "",
      "Over the next 12-24 months, projects that blend genre with character specificity are likely to outperform generic executions.",
      "Expect buyers to keep rewarding high-concept ideas with contained production footprints.",
      "Opportunity: stories that feel personal first and marketable second tend to travel better across platforms.",
    ],
    "script-evaluation": [
      `Script Evaluation: ${title}`,
      "",
      `Logline: ${logline}`,
      "Strengths: clear dramatic engine, adaptable premise, room for strong performances.",
      "Weaknesses: hook may need sharper differentiation and clearer escalation in the midpoint.",
      "Commercial potential: moderate to strong if the concept can be summarized in a striking one-line pitch.",
      "Platform fit: strong for streaming, with theatrical potential if the visual concept is bold enough.",
      "Recommendation: sharpen the protagonist goal, antagonist pressure, and ending image.",
    ],
    "competitive-analysis": [
      `Competitive Analysis: ${genre}`,
      "",
      "The genre remains crowded at the generic middle, but there is still room for projects with a fresh emotional or cultural lens.",
      "Saturated area: familiar setups without a clear market hook.",
      "Fresh area: projects that combine accessible tension with a very specific world or relationship dynamic.",
      "Positioning advice: lead with the clearest contrast between what audiences expect and what only this project can deliver.",
    ],
  };

  return (sections[analysisType] || [
    "PitchRoom Intelligence",
    "",
    "A local fallback analysis was generated because the live provider was unavailable.",
  ]).join("\n");
};
