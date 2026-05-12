import { contentPresets, inferPreset, queryForBeat, visualForSentence } from "./scriptTemplates.js";
import { refreshBeat } from "./storyboard.js";

const explainScenes = new Set(["focus", "process", "stats", "timeline", "split", "board", "html"]);
const finishScenes = new Set(["summary", "quote"]);

export function choosePreset(prompt, explicitPreset = "auto") {
  return explicitPreset === "auto" ? inferPreset(prompt) : explicitPreset;
}

export function sceneFlowForPreset(presetKey, beats = []) {
  const preset = contentPresets[presetKey] || contentPresets.explainer;
  const base = preset.defaultScenes?.length ? [...preset.defaultScenes] : ["hook", "hero", "focus", "summary"];
  if (!base.includes("hook")) base.unshift("hook");
  if (!base.some((scene) => explainScenes.has(scene))) base.splice(Math.min(2, base.length), 0, "focus");
  if (!base.some((scene) => finishScenes.has(scene))) base.push("summary");
  if (beats.length > 8 && !base.includes("timeline")) base.splice(Math.max(2, base.length - 1), 0, "timeline");
  return base;
}

function normalizeVisual(value) {
  return {
    imageText: "focus",
    arrowExplain: "focus",
    chart: "stats",
    comparison: "split",
    steps: "process",
    code: "board",
    diagram: "board",
    stock: "hero",
    titleCard: "hook"
  }[value] || value;
}

export function autoDirect(beats, options = {}) {
  const preset = choosePreset(options.prompt || "", options.preset || "auto");
  const flow = sceneFlowForPreset(preset, beats);
  return beats.map((beat, index) => {
    const directed = { ...beat };
    const inferred = normalizeVisual(visualForSentence(beat.text, index, preset));
    directed.visual = inferred === "hero" || inferred === "auto" ? flow[index % flow.length] : inferred;
    if (index === 0) directed.visual = "hook";
    if (index === beats.length - 1) directed.visual = "summary";
    directed.stockQuery = queryForBeat(beat.text, options.style || "explainer", preset);
    directed.preset = preset;
    refreshBeat(directed, {
      preset,
      style: options.style || "explainer",
      rebuildQuery: false
    });
    return directed;
  });
}

export function projectScore(beats, options = {}) {
  const notes = [];
  if (!beats.length) {
    return { score: 0, notes: ["Generate a storyboard first."] };
  }

  const visuals = beats.map((beat) => normalizeVisual(beat.visual));
  const uniqueVisuals = new Set(visuals).size;
  const assigned = beats.filter((beat) => beat.media).length;
  const hasHook = visuals[0] === "hook";
  const hasExplain = visuals.some((scene) => explainScenes.has(scene));
  const hasFinish = finishScenes.has(visuals[visuals.length - 1]);
  const longLines = beats.filter((beat) => beat.text.length > 180).length;
  const stockRatio = assigned / beats.length;

  let score = 42;
  score += Math.min(18, uniqueVisuals * 3);
  score += hasHook ? 12 : -8;
  score += hasExplain ? 14 : -10;
  score += hasFinish ? 10 : -6;
  score += Math.min(14, Math.round(stockRatio * 18));
  score -= Math.min(12, longLines * 3);
  score = Math.max(0, Math.min(100, score));

  if (!hasHook) notes.push("Open with a direct title card so the first second explains the topic.");
  if (!hasExplain) notes.push("Use focus, process, stats, split, timeline, or board scenes for explanation beats.");
  if (!hasFinish) notes.push("End with a summary beat instead of another context shot.");
  if (uniqueVisuals < 4) notes.push("Increase scene variety, but keep the same layout system so the video still feels coherent.");
  if (stockRatio < 0.35) notes.push("Assign more real media to context beats and keep generated scenes for meaning, not filler.");
  if (longLines) notes.push("Shorten narration beats so on-screen text stays readable and captions do not spill.");
  if (options.caption === "shorts" && beats.length > 14) notes.push("The center caption mode works better with fewer, faster beats.");
  if (!notes.length) notes.push("Structure is solid: context, explanation, proof, and ending are all covered.");

  return { score, notes };
}

export function codexBrief(project, manifest) {
  return [
    "Seval Codex task brief",
    "",
    `Project: ${project.name || "Untitled Seval Video"}`,
    `Prompt: ${project.prompt || ""}`,
    `Beats: ${project.beats?.length || 0}`,
    "",
    "Goal:",
    "- improve script beats",
    "- pick stronger scene templates",
    "- match source media to context beats",
    "- keep captions short",
    "- preserve source/license notes",
    "- keep the project JSON editable by AI systems",
    "",
    "Important files:",
    ...(manifest?.codex?.projectFiles || []).map((file) => `- ${file}`),
    "",
    "Run:",
    "- npm.cmd start",
    "- npm.cmd run mcp"
  ].join("\n");
}
