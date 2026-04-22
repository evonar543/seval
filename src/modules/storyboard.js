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

export function buildBeats(script, options = {}) {
  const sentences = splitSentences(script);
  const seed = hash(`${script}:${options.style || "explainer"}`);
  const random = seeded(seed);
  const targetDuration = { short: 45, medium: 75, long: 120 }[options.length] || 75;
  const weights = sentences.map((sentence) => Math.max(2.8, sentence.length / 14));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let start = 0;

  const beats = sentences.map((text, index) => {
    const duration = clamp((weights[index] / weightSum) * targetDuration, 3.2, 12);
    const lane = index % 4;
    const jitter = () => random() * 0.16 - 0.08;
    const beat = {
      id: crypto.randomUUID(),
      index,
      text,
      visual: visualForSentence(text, index, options.preset),
      stockQuery: queryForBeat(text, options.style, options.preset),
      media: null,
      start,
      duration,
      from: {
        x: clamp(0.16 + lane * 0.14 + jitter(), 0.08, 0.82),
        y: clamp(0.32 + random() * 0.42, 0.18, 0.78)
      },
      to: {
        x: clamp(0.72 - lane * 0.08 + jitter(), 0.18, 0.9),
        y: clamp(0.22 + random() * 0.48, 0.16, 0.8)
      }
    };
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
