import { queryForBeat, visualForSentence } from "./scriptTemplates.js";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hash(input) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cleanWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "first",
  "final",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "made",
  "make",
  "more",
  "most",
  "only",
  "other",
  "over",
  "said",
  "should",
  "some",
  "takeaway",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "those",
  "through",
  "talking",
  "under",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "whole",
  "with",
  "would"
]);

function sentenceCase(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titleCase(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function compactText(text, limit = 92) {
  const safe = text.trim();
  if (safe.length <= limit) return safe;
  return `${safe.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function uniqueWords(text, minLength = 4) {
  const seen = new Set();
  const output = [];
  for (const word of cleanWords(text)) {
    if (word.length < minLength || stopWords.has(word) || seen.has(word)) continue;
    seen.add(word);
    output.push(word);
  }
  return output;
}

function splitClauses(text) {
  return text
    .split(/[,:;]|(?:\band\b)|(?:\bbut\b)|(?:\bwhile\b)|(?:\bbecause\b)/i)
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter((part) => part.length > 3);
}

function extractNumber(text) {
  const match = text.match(/\b\d+(?:\.\d+)?%?\b/);
  return match?.[0] || "";
}

function scoreWord(word) {
  let score = word.length;
  if (/\d/.test(word)) score += 4;
  if (/ing$/.test(word)) score += 1;
  if (/tion$|ment$|ness$|ship$/.test(word)) score += 2;
  return score;
}

function buildTitle(text) {
  const words = uniqueWords(text, 3).sort((a, b) => scoreWord(b) - scoreWord(a));
  const chosen = words.slice(0, 4);
  if (!chosen.length) return compactText(text, 44);
  return titleCase(chosen.join(" "));
}

function buildKicker(text, visual, preset) {
  if (visual === "hook" || visual === "titleCard") return "Opening line";
  if (visual === "summary") return "Takeaway";
  if (visual === "timeline") return "Sequence";
  if (visual === "process") return "How it works";
  if (visual === "stats" || visual === "chart") return "Key numbers";
  if (visual === "quote") return "Point of view";
  if (visual === "board") return "Breakdown";
  const first = cleanWords(text).slice(0, 2).join(" ");
  return titleCase(first || preset || "Explainer");
}

function buildBullets(text) {
  const clauses = splitClauses(text);
  if (clauses.length >= 2) {
    return clauses
      .slice(0, 3)
      .map((item) => sentenceCase(compactText(item, 42)))
      .filter((item) => !stopWords.has(item.toLowerCase()));
  }
  const words = uniqueWords(text, 4).slice(0, 3);
  if (!words.length) return [compactText(text, 42)];
  return words.map((word) => titleCase(word));
}

function buildChips(text) {
  const words = uniqueWords(text, 4)
    .filter((word) => !["this", "that", "with", "from", "into", "your", "their"].includes(word))
    .slice(0, 4);
  return words.map((word) => titleCase(word));
}

function buildCaption(text) {
  const clauses = splitClauses(text);
  const base = clauses[0] || text;
  return compactText(sentenceCase(base), 82);
}

function buildSceneData(text, visual, preset) {
  const number = extractNumber(text);
  return {
    title: buildTitle(text),
    kicker: buildKicker(text, visual, preset),
    bullets: buildBullets(text),
    chips: buildChips(text),
    caption: buildCaption(text),
    emphasis: number || titleCase((uniqueWords(text, 5)[0] || "").slice(0, 18)),
    quote: compactText(text.replace(/^["']|["']$/g, ""), 160)
  };
}

export function refreshBeat(beat, options = {}) {
  const visual = visualForSentence(beat.text, beat.index || 0, options.preset || beat.preset || "auto");
  const normalizedVisual = {
    titleCard: "hook",
    imageText: "focus",
    arrowExplain: "focus",
    chart: "stats",
    comparison: "split",
    steps: "process",
    code: "board",
    diagram: "board",
    stock: "hero",
    map: "focus",
    air: "focus",
    naval: "focus",
    missile: "focus",
    ground: "focus",
    radar: "focus",
    intel: "board",
    city: "hero"
  }[beat.visual] || beat.visual;
  const resolvedVisual = normalizedVisual === "auto" ? visual : normalizedVisual || visual;
  beat.visual = resolvedVisual;
  const scene = buildSceneData(beat.text, resolvedVisual, options.preset || beat.preset || "auto");
  beat.scene = scene;
  if (!beat.stockQuery || options.rebuildQuery) {
    beat.stockQuery = queryForBeat(beat.text, options.style || beat.style || "explainer", options.preset || beat.preset || "auto");
  }
  if (!beat.visual) beat.visual = visual;
  if (!beat.from || !beat.to) {
    beat.from = { x: 0.22, y: 0.34 };
    beat.to = { x: 0.74, y: 0.58 };
  }
  beat.captionText = scene.caption;
  beat.title = scene.title;
  return beat;
}

export function buildBeats(script, options = {}) {
  const sentences = splitSentences(script);
  const seed = hash(`${script}:${options.style || "explainer"}`);
  const random = seeded(seed);
  const targetDuration = { short: 45, medium: 75, long: 120 }[options.length] || 75;
  const weights = sentences.map((sentence) => Math.max(2.8, sentence.length / 15));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let start = 0;

  const beats = sentences.map((text, index) => {
    const duration = clamp((weights[index] / weightSum) * targetDuration, 3.2, 11.5);
    const lane = index % 4;
    const jitter = () => random() * 0.14 - 0.07;
    const beat = {
      id: crypto.randomUUID(),
      index,
      text,
      style: options.style || "explainer",
      preset: options.preset || "auto",
      visual: visualForSentence(text, index, options.preset),
      stockQuery: queryForBeat(text, options.style, options.preset),
      media: null,
      start,
      duration,
      from: {
        x: clamp(0.18 + lane * 0.14 + jitter(), 0.08, 0.82),
        y: clamp(0.28 + random() * 0.4, 0.18, 0.78)
      },
      to: {
        x: clamp(0.74 - lane * 0.1 + jitter(), 0.18, 0.9),
        y: clamp(0.2 + random() * 0.44, 0.16, 0.8)
      }
    };
    refreshBeat(beat, options);
    start += duration;
    return beat;
  });

  normalizeTiming(beats, targetDuration);
  return beats;
}

export function normalizeTiming(beats, duration) {
  if (!beats.length) return;
  const total = beats.reduce((sum, beat) => sum + beat.duration, 0) || duration;
  const scale = duration / total;
  let start = 0;
  for (const beat of beats) {
    beat.duration *= scale;
    beat.start = start;
    start += beat.duration;
  }
}

export function activeBeatAt(beats, time) {
  return (
    beats.find((beat) => time >= beat.start && time < beat.start + beat.duration) ||
    beats[beats.length - 1] ||
    null
  );
}

export function totalDuration(beats) {
  return beats.reduce((sum, beat) => sum + beat.duration, 0);
}
