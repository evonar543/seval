export const videoStyles = {
  explainer: {
    name: "Explainer",
    hook: "Start with the core idea, then prove each part with a clean visual.",
    sourceHints: ["documentary footage", "close up detail", "people working", "public domain video"]
  },
  news: {
    name: "News brief",
    hook: "Use footage as context, then explain what actually matters.",
    sourceHints: ["press conference", "news footage", "city aerial", "official briefing"]
  },
  documentary: {
    name: "Documentary",
    hook: "Build context first, then move into sequence, cause, and consequence.",
    sourceHints: ["archive footage", "landscape aerial", "historical photo", "street documentary"]
  },
  training: {
    name: "Training",
    hook: "Teach the workflow clearly, with each step mapped to one visual.",
    sourceHints: ["workspace desk", "screen recording", "demonstration", "hands working"]
  }
};

export const contentPresets = {
  auto: {
    name: "Auto pick",
    tone: "clear, visual, and tightly edited",
    defaultScenes: ["hook", "hero", "focus", "process", "stats", "summary"],
    searchHints: ["documentary footage", "close up detail", "public domain footage"]
  },
  explainer: {
    name: "Faceless explainer",
    tone: "direct and guided",
    defaultScenes: ["hook", "hero", "focus", "process", "board", "summary"],
    searchHints: ["explainer footage", "close up object", "public domain footage"]
  },
  tech: {
    name: "Tech breakdown",
    tone: "precise and modular",
    defaultScenes: ["hook", "hero", "board", "process", "stats", "summary"],
    searchHints: ["technology workspace", "computer screen", "server room", "software interface"]
  },
  business: {
    name: "Business / finance",
    tone: "structured and data-led",
    defaultScenes: ["hook", "hero", "stats", "split", "timeline", "summary"],
    searchHints: ["business meeting", "office footage", "market chart", "city skyline"]
  },
  history: {
    name: "History mini-doc",
    tone: "chronological and contextual",
    defaultScenes: ["hook", "hero", "timeline", "focus", "quote", "summary"],
    searchHints: ["archive footage", "historical photo", "museum artifact", "old city footage"]
  },
  science: {
    name: "Science visualizer",
    tone: "clean and evidence-first",
    defaultScenes: ["hook", "hero", "focus", "stats", "process", "summary"],
    searchHints: ["laboratory footage", "microscope", "space footage", "science animation"]
  },
  tutorial: {
    name: "Tutorial",
    tone: "practical and stepwise",
    defaultScenes: ["hook", "hero", "process", "board", "split", "summary"],
    searchHints: ["tutorial screen recording", "workspace desk", "how to", "hands typing"]
  },
  product: {
    name: "Product / ad",
    tone: "polished and benefit-led",
    defaultScenes: ["hook", "hero", "focus", "split", "process", "summary"],
    searchHints: ["product demo", "lifestyle product", "creative workspace", "studio close up"]
  },
  gaming: {
    name: "Gaming / lore",
    tone: "dramatic and structured",
    defaultScenes: ["hook", "hero", "timeline", "focus", "quote", "summary"],
    searchHints: ["gaming setup", "controller close up", "fantasy art", "esports footage"]
  },
  military: {
    name: "Military explainer",
    tone: "calm and procedural",
    defaultScenes: ["hook", "hero", "focus", "timeline", "board", "summary"],
    searchHints: ["military exercise", "radar station", "naval training", "air force training"]
  }
};

export const musicBeds = {
  tension: { name: "Low tension", base: 54, pulse: 92, gain: 0.026 },
  news: { name: "News pulse", base: 72, pulse: 132, gain: 0.022 },
  cinematic: { name: "Cinematic build", base: 42, pulse: 86, gain: 0.032 },
  quiet: { name: "Quiet bed", base: 48, pulse: 68, gain: 0.015 }
};

export const visualTypes = [
  ["auto", "Auto pick"],
  ["hook", "Title card"],
  ["hero", "Hero media"],
  ["stock", "Stock media"],
  ["focus", "Focus breakdown"],
  ["process", "Process steps"],
  ["stats", "Stats / chart"],
  ["timeline", "Timeline"],
  ["split", "Split comparison"],
  ["board", "Board / UI"],
  ["quote", "Quote"],
  ["summary", "Summary"],
  ["html", "Scene JSON"]
];

export const captionPresets = {
  documentary: { name: "Documentary", position: "lower", weight: "bold", box: true },
  shorts: { name: "Center punch", position: "center", weight: "black", box: false },
  clean: { name: "Clean subtitle", position: "bottom", weight: "medium", box: false },
  boxed: { name: "Boxed lower-third", position: "lower", weight: "bold", box: true }
};

export function composeScript(prompt, styleKey, lengthKey, paceKey, presetKey = "auto") {
  const topic = prompt.trim() || "How a modular video system turns one idea into a polished explainer.";
  const style = videoStyles[styleKey] || videoStyles.explainer;
  const preset = contentPresets[presetKey] || contentPresets.auto;
  const target = { short: 8, medium: 12, long: 16 }[lengthKey] || 12;
  const pace =
    paceKey === "fast"
      ? "quickly"
      : paceKey === "calm"
        ? "carefully"
        : "with a controlled rise in energy";

  const lines = [
    `I will be talking about this: ${topic}.`,
    style.hook,
    `The tone should feel ${preset.tone}.`,
    "Start with one clear promise so the viewer understands the point immediately.",
    "Then switch to real footage or stills that establish the subject before adding any explanation graphics.",
    "Every new sentence should earn a visual change instead of sitting on the same frame too long.",
    "When the line introduces a process, convert that beat into a clean step layout with one action per card.",
    "When the line introduces evidence, use a stat block, chart, or comparison instead of generic footage.",
    `Move ${pace}, but keep the pacing readable and avoid stacking too many ideas into one beat.`,
    "Use captions to support the voice, not to repeat an entire screen of text.",
    "The system should pick stock media for context and generated layouts for explanation.",
    "By the middle, the viewer should understand the structure, the proof, and the main tradeoff.",
    "The ending should condense the idea into one takeaway instead of just fading out on more clips.",
    "A strong modular video pipeline works because scene types, captions, timing, and media selection all follow the script.",
    "That is how a reusable AI video system can make polished explainers across different topics."
  ];

  return lines.slice(0, target).join(" ");
}

export function inferPreset(prompt) {
  const lower = prompt.toLowerCase();
  if (/\b(war|military|naval|army|air force|missile|battle|geopolitic|defense)\b/.test(lower)) return "military";
  if (/\b(code|ai|software|app|api|server|computer|tech|program|developer)\b/.test(lower)) return "tech";
  if (/\b(stock|market|business|money|startup|company|finance|sales)\b/.test(lower)) return "business";
  if (/\b(history|ancient|empire|century|timeline|historical)\b/.test(lower)) return "history";
  if (/\b(science|space|biology|physics|chemistry|research|planet)\b/.test(lower)) return "science";
  if (/\b(how to|tutorial|learn|guide|step by step)\b/.test(lower)) return "tutorial";
  if (/\b(product|brand|launch|commercial|customer)\b/.test(lower)) return "product";
  if (/\b(game|gaming|lore|boss|character|minecraft|roblox)\b/.test(lower)) return "gaming";
  return "explainer";
}

export function queryForBeat(text, styleKey = "explainer", presetKey = "auto") {
  const lower = text.toLowerCase();
  const style = videoStyles[styleKey] || videoStyles.explainer;
  const preset = contentPresets[presetKey] || contentPresets.auto;

  if (/\b(code|software|app|api|server|dashboard|interface|developer)\b/.test(lower)) return "technology computer screen workspace";
  if (/\b(chart|data|number|trend|growth|decline|percent|market|sales)\b/.test(lower)) return "business chart office";
  if (/\b(process|step|workflow|build|make|system|pipeline)\b/.test(lower)) return "hands working process close up";
  if (/\b(history|archive|historical|century|past)\b/.test(lower)) return "archive historical footage";
  if (/\b(science|space|lab|planet|research|experiment)\b/.test(lower)) return "science laboratory footage";
  if (/\b(product|device|tool|feature|launch)\b/.test(lower)) return "product close up studio";
  if (/\b(game|gaming|controller|stream|esports)\b/.test(lower)) return "gaming setup close up";
  if (/\b(city|people|street|world|public)\b/.test(lower)) return "city street documentary";
  if (/\b(military|radar|naval|ship|aircraft|missile|command)\b/.test(lower)) return "military training footage";

  const hints = [...(preset.searchHints || []), ...(style.sourceHints || [])];
  return hints[text.length % hints.length] || "documentary footage";
}

export function visualForSentence(text, index, presetKey = "auto") {
  const lower = text.toLowerCase();
  const preset = contentPresets[presetKey] || contentPresets.auto;
  if (/i will be talking|this video|here is|the point is|why\b/.test(lower)) return "hook";
  if (/takeaway|summary|result|lesson|in short|bottom line/.test(lower)) return "summary";
  if (/quote|said|claim|message|promise/.test(lower)) return "quote";
  if (/timeline|before|after|phase|then|finally|next|middle/.test(lower)) return "timeline";
  if (/number|percent|trend|growth|decline|data|price|market|evidence/.test(lower)) return "stats";
  if (/first|second|third|step|process|workflow|how to/.test(lower)) return "process";
  if (/versus|compared|difference|better|worse|option|tradeoff/.test(lower)) return "split";
  if (/code|html|css|javascript|api|server|dashboard|system/.test(lower)) return "board";
  if (/focus|important part|key idea|reason|because|explains/.test(lower)) return "focus";
  return preset.defaultScenes[index % preset.defaultScenes.length] || "hero";
}
