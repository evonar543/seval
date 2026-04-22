export const videoStyles = {
  explainer: {
    name: "Military explainer",
    hook: "Here is the situation, explained step by step.",
    sourceHints: ["military exercise", "naval exercise", "air force training", "radar station"]
  },
  news: {
    name: "Current-event brief",
    hook: "The footage you are about to see is used as context, not proof of a live event.",
    sourceHints: ["newsreel", "military footage", "press briefing", "aircraft carrier"]
  },
  documentary: {
    name: "Documentary",
    hook: "To understand the larger story, start with geography, timing, and what each side can see.",
    sourceHints: ["archive footage", "soldiers training", "ships at sea", "aircraft patrol"]
  },
  training: {
    name: "Training simulation",
    hook: "This is a fictional training scenario built from public-domain style footage and simple visual logic.",
    sourceHints: ["training exercise", "command center", "convoy", "helicopter exercise"]
  }
};

export const contentPresets = {
  auto: {
    name: "Auto pick",
    tone: "clear, punchy, and visual",
    defaultScenes: ["hook", "stock", "arrowExplain", "chart", "timeline", "summary"],
    searchHints: ["public footage", "explain animation", "documentary footage"]
  },
  explainer: {
    name: "Faceless explainer",
    tone: "curious, direct, and easy to follow",
    defaultScenes: ["hook", "imageText", "arrowExplain", "chart", "summary"],
    searchHints: ["documentary footage", "public domain footage", "education animation"]
  },
  tech: {
    name: "Tech breakdown",
    tone: "precise and practical",
    defaultScenes: ["hook", "code", "diagram", "chart", "steps", "summary"],
    searchHints: ["technology server room", "software animation", "computer screen"]
  },
  business: {
    name: "Business / finance",
    tone: "confident and data-driven",
    defaultScenes: ["hook", "chart", "comparison", "timeline", "summary"],
    searchHints: ["stock market chart", "business meeting", "city office"]
  },
  history: {
    name: "History mini-doc",
    tone: "documentary and chronological",
    defaultScenes: ["hook", "imageText", "timeline", "map", "quote", "summary"],
    searchHints: ["archive footage", "historical footage", "old film"]
  },
  science: {
    name: "Science visualizer",
    tone: "wonder-driven and accurate",
    defaultScenes: ["hook", "diagram", "chart", "steps", "summary"],
    searchHints: ["science laboratory", "space footage", "microscope"]
  },
  tutorial: {
    name: "Tutorial",
    tone: "friendly and action-oriented",
    defaultScenes: ["hook", "steps", "code", "comparison", "summary"],
    searchHints: ["tutorial screen recording", "workspace desk", "how to"]
  },
  product: {
    name: "Product / ad",
    tone: "polished and benefit-led",
    defaultScenes: ["hook", "imageText", "comparison", "steps", "summary"],
    searchHints: ["product demo", "creative workspace", "customer success"]
  },
  gaming: {
    name: "Gaming / lore",
    tone: "dramatic and story-rich",
    defaultScenes: ["hook", "timeline", "comparison", "quote", "summary"],
    searchHints: ["game controller", "esports", "fantasy animation"]
  },
  military: {
    name: "Military explainer",
    tone: "calm, dramatic, and careful",
    defaultScenes: ["hook", "stock", "map", "arrowExplain", "timeline", "summary"],
    searchHints: ["military exercise", "naval exercise", "air force training", "radar station"]
  }
};

export const musicBeds = {
  tension: {
    name: "Low tension",
    base: 54,
    pulse: 92,
    gain: 0.026
  },
  news: {
    name: "News pulse",
    base: 72,
    pulse: 132,
    gain: 0.022
  },
  cinematic: {
    name: "Cinematic build",
    base: 42,
    pulse: 86,
    gain: 0.032
  },
  quiet: {
    name: "Quiet bed",
    base: 48,
    pulse: 68,
    gain: 0.015
  }
};

export const visualTypes = [
  ["auto", "Auto pick"],
  ["stock", "Stock footage"],
  ["hook", "Black-screen hook"],
  ["imageText", "Image + text"],
  ["arrowExplain", "Arrows explainer"],
  ["chart", "Chart"],
  ["timeline", "Timeline"],
  ["comparison", "Comparison"],
  ["steps", "Steps"],
  ["diagram", "Diagram"],
  ["code", "Code / UI"],
  ["quote", "Quote card"],
  ["summary", "Summary"],
  ["html", "HTML-style scene"],
  ["map", "Map movement"],
  ["air", "Aircraft graphic"],
  ["naval", "Naval graphic"],
  ["missile", "Missile graphic"],
  ["ground", "Ground graphic"],
  ["radar", "Radar graphic"],
  ["intel", "Intel board"],
  ["city", "City pressure"]
];

export const captionPresets = {
  documentary: {
    name: "Documentary lower-third",
    position: "lower",
    weight: "bold",
    box: true
  },
  shorts: {
    name: "Shorts punch captions",
    position: "center",
    weight: "black",
    box: false
  },
  clean: {
    name: "Clean subtitle",
    position: "bottom",
    weight: "medium",
    box: false
  },
  boxed: {
    name: "Boxed explainer",
    position: "lower",
    weight: "bold",
    box: true
  }
};

export function composeScript(prompt, styleKey, lengthKey, paceKey, presetKey = "auto") {
  const topic =
    prompt.trim() ||
    "Why a simple idea can become a great explainer video when each sentence gets the right visual.";
  const style = videoStyles[styleKey] || videoStyles.explainer;
  const preset = contentPresets[presetKey] || contentPresets.auto;
  const target = { short: 8, medium: 12, long: 18 }[lengthKey] || 12;
  const pace =
    paceKey === "fast"
      ? "quickly"
      : paceKey === "calm"
        ? "carefully"
        : "with rising pressure";

  const lines = [
    `I will be talking about this: ${topic}`,
    style.hook,
    `The tone should feel ${preset.tone}, with visuals that change every time the idea changes.`,
    `The topic is this: ${topic}`,
    "First, we open on a black screen with a strong line of text so the viewer instantly knows what the video is about.",
    "Then we bring in a matching image or public clip, and use arrows, labels, and motion to point at the important part.",
    "Public footage gives the viewer real-world texture, while generated graphics explain the idea that the clip cannot show by itself.",
    `The first visible movement happens ${pace}, and that is where the timeline starts to tighten.`,
    "The important editing trick is matching each sentence to one clear visual, then cutting when the thought changes.",
    "If the line needs proof, use footage; if it needs explanation, use text, arrows, charts, timelines, or a diagram.",
    "When the narration mentions a number or trend, the scene should become a chart instead of random stock footage.",
    "When the narration mentions a process, the scene should become steps, code, a UI mockup, or a simple animated diagram.",
    "The music should stay under the voice and rise only when the story needs energy.",
    "By the middle, the viewer should understand who is moving, what each side sees, and why timing matters.",
    "Then the story narrows into a decision point, where one wrong assumption can create a larger crisis.",
    "A good explainer keeps the footage clean, the voiceover steady, captions readable, and motion purposeful.",
    "The final beat should summarize the lesson instead of leaving the viewer with only drama.",
    "In this version, the takeaway is simple: stock clips create the feel, but scripted visuals create the meaning.",
    "That is how Seval builds a polished explainer from public footage, generated scenes, narration, music, and sentence-level timing.",
    "The result should feel like a guided story, not random clips pasted together.",
    "Everything should remain honest about what the footage represents and flexible enough to work for many types of videos."
  ];

  return lines.slice(0, target).join(" ");
}

export function inferPreset(prompt) {
  const lower = prompt.toLowerCase();
  if (/\b(war|military|naval|army|air force|missile|battle|geopolitic|geopolitics)\b/.test(lower)) return "military";
  if (/code|ai|software|app|api|server|computer|tech|program/.test(lower)) return "tech";
  if (/stock|market|business|money|startup|company|finance|sales/.test(lower)) return "business";
  if (/history|ancient|empire|war of|century|timeline/.test(lower)) return "history";
  if (/science|space|biology|physics|chemistry|research|planet/.test(lower)) return "science";
  if (/how to|tutorial|learn|guide|step/.test(lower)) return "tutorial";
  if (/product|brand|launch|ad|commercial|customer/.test(lower)) return "product";
  if (/game|gaming|lore|boss|character|minecraft|roblox/.test(lower)) return "gaming";
  return "explainer";
}

export function queryForBeat(text, styleKey = "explainer", presetKey = "auto") {
  const lower = text.toLowerCase();
  const style = videoStyles[styleKey] || videoStyles.explainer;
  const preset = contentPresets[presetKey] || contentPresets.auto;
  if (/radar|detect|sensor|signal|surveillance|watch/.test(lower)) return "radar military surveillance";
  if (/air|aircraft|jet|drone|pilot|intercept/.test(lower)) return "military aircraft training";
  if (/ship|naval|fleet|sea|coast|strait|carrier/.test(lower)) return "naval exercise ships";
  if (/convoy|vehicle|tank|ground|border|route|movement/.test(lower)) return "military convoy training";
  if (/command|brief|decision|control|intel/.test(lower)) return "military command center";
  if (/missile|strike|escalation|defense/.test(lower)) return "air defense missile exercise";
  if (/city|civilian|capital|port/.test(lower)) return "city aerial public domain";
  if (/code|software|api|server|data|dashboard|interface/.test(lower)) return "technology computer screen";
  if (/money|stock|market|sales|business|growth|trend/.test(lower)) return "business chart office";
  if (/history|archive|old|century|past/.test(lower)) return "archive historical footage";
  if (/science|space|lab|planet|research/.test(lower)) return "science laboratory footage";
  const hints = [...(preset.searchHints || []), ...(style.sourceHints || [])];
  return hints[text.length % hints.length] || "public domain footage";
}

export function visualForSentence(text, index, presetKey = "auto") {
  const lower = text.toLowerCase();
  const preset = contentPresets[presetKey] || contentPresets.auto;
  if (/i will be talking|here is|this video|why\b|what if|the truth/.test(lower)) return "hook";
  if (/number|percent|trend|growth|decline|chart|data|price|market/.test(lower)) return "chart";
  if (/first|second|third|step|process|how to|workflow/.test(lower)) return "steps";
  if (/timeline|before|after|middle|final|phase|century|year/.test(lower)) return "timeline";
  if (/versus|compared|difference|better|worse|option/.test(lower)) return "comparison";
  if (/code|api|html|css|javascript|server|software/.test(lower)) return "code";
  if (/quote|said|claim|message/.test(lower)) return "quote";
  if (/takeaway|summary|result|lesson|final/.test(lower)) return "summary";
  if (/radar|detect|sensor|signal|surveillance|watch/.test(lower)) return "radar";
  if (/air|aircraft|jet|drone|pilot|intercept/.test(lower)) return "air";
  if (/ship|naval|fleet|sea|coast|strait|carrier/.test(lower)) return "naval";
  if (/missile|strike|escalation|defense/.test(lower)) return "missile";
  if (/convoy|vehicle|tank|ground|border|route|movement/.test(lower)) return "ground";
  if (/command|brief|decision|control|intel/.test(lower)) return "intel";
  if (/city|civilian|capital|port/.test(lower)) return "city";
  return preset.defaultScenes[index % preset.defaultScenes.length] || "stock";
}
