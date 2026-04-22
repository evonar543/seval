import { contentPresets, inferPreset, queryForBeat, visualForSentence } from "./scriptTemplates.js";

const proofScenes = new Set(["stock", "imageText", "quote"]);
const explainScenes = new Set(["arrowExplain", "chart", "timeline", "comparison", "steps", "diagram", "code", "html"]);
const finishScenes = new Set(["summary", "quote"]);

export function choosePreset(prompt, explicitPreset = "auto") {
  return explicitPreset === "auto" ? inferPreset(prompt) : explicitPreset;
}

export function sceneFlowForPreset(presetKey, beats = []) {
  const preset = contentPresets[presetKey] || contentPresets.explainer;
  const base = preset.defaultScenes?.length ? [...preset.defaultScenes] : ["hook", "stock", "arrowExplain", "summary"];
  if (!base.includes("hook")) base.unshift("hook");
  if (!base.some((scene) => explainScenes.has(scene))) base.splice(2, 0, "arrowExplain");
  if (!base.some((scene) => finishScenes.has(scene))) base.push("summary");
  if (beats.length > 8 && !base.includes("timeline")) base.splice(Math.max(2, base.length - 1), 0, "timeline");
  return base;
}

export function autoDirect(beats, options = {}) {
  const preset = choosePreset(options.prompt || "", options.preset || "auto");
  const flow = sceneFlowForPreset(preset, beats);
  return beats.map((beat, index) => {
    const directed = { ...beat };
    const inferred = visualForSentence(beat.text, index, preset);
    directed.visual = inferred === "stock" || inferred === "map" ? flow[index % flow.length] : inferred;
    if (index === 0) directed.visual = "hook";
    if (index === beats.length - 1) directed.visual = "summary";
    directed.stockQuery = queryForBeat(beat.text, options.style || "explainer", preset);
    return directed;
  });
}

export function projectScore(beats, options = {}) {
  const notes = [];
  if (!beats.length) {
    return { score: 0, notes: ["Generate a storyboard first."] };
  }

  const visuals = beats.map((beat) => beat.visual);
  const uniqueVisuals = new Set(visuals).size;
  const assigned = beats.filter((beat) => beat.media).length;
  const hasHook = visuals[0] === "hook";
  const hasExplain = visuals.some((scene) => explainScenes.has(scene));
  const hasFinish = finishScenes.has(visuals[visuals.length - 1]);
  const longLines = beats.filter((beat) => beat.text.length > 190).length;
  const stockRatio = assigned / beats.length;

  let score = 40;
  score += Math.min(20, uniqueVisuals * 3);
  score += hasHook ? 12 : -8;
  score += hasExplain ? 12 : -8;
  score += hasFinish ? 10 : -6;
  score += Math.min(16, Math.round(stockRatio * 20));
  score -= Math.min(14, longLines * 3);
  score = Math.max(0, Math.min(100, score));

  if (!hasHook) notes.push("Open with a black-screen hook so viewers instantly understand the promise.");
  if (!hasExplain) notes.push("Add charts, steps, arrows, timelines, or diagrams where footage alone cannot explain the idea.");
  if (!hasFinish) notes.push("End on a summary or quote scene instead of another generic clip.");
  if (uniqueVisuals < 4) notes.push("Use more scene variety so the edit does not feel repetitive.");
  if (stockRatio < 0.35) notes.push("Assign more public footage to proof/context beats, then use generated scenes for explanation.");
  if (longLines) notes.push("Shorten long narration beats so captions stay readable.");
  if (options.caption === "shorts" && beats.length > 14) notes.push("For shorts-style captions, consider a shorter script or faster pacing.");
  if (!notes.length) notes.push("Strong structure: hook, visual variety, explanation scenes, and a clean ending are all present.");

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
    "Improve this video as a modular explainer:",
    "- tighten the hook and script beats",
    "- choose scene types per sentence",
    "- improve stock queries",
    "- preserve source/license notes",
    "- keep generated scenes renderable through canvas/MP4 export",
    "",
    "Important files:",
    ...(manifest?.codex?.projectFiles || []).map((file) => `- ${file}`),
    "",
    "Run:",
    "- npm.cmd start",
    "- npm.cmd run mcp"
  ].join("\n");
}
