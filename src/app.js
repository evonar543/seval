import { addMusicAndSoundDesign, fetchAudioBuffer, loadVoices, tts } from "./modules/audio.js";
import { autoDirect, codexBrief, projectScore, sceneFlowForPreset } from "./modules/director.js";
import {
  autoMatchBeats,
  createVideoPool,
  loadProviders,
  searchPublicMedia,
  searchPublicMusic,
  startVideoPool
} from "./modules/media.js";
import { createRenderer } from "./modules/renderer.js";
import { composeScript, inferPreset, visualTypes } from "./modules/scriptTemplates.js";
import { activeBeatAt, buildBeats, formatTime, normalizeTiming, totalDuration } from "./modules/storyboard.js";

const canvas = document.querySelector("#stage");

const els = {
  systemStatus: document.querySelector("#systemStatus"),
  prompt: document.querySelector("#promptInput"),
  script: document.querySelector("#scriptInput"),
  style: document.querySelector("#styleSelect"),
  preset: document.querySelector("#presetSelect"),
  projectName: document.querySelector("#projectNameInput"),
  projectStatus: document.querySelector("#projectStatus"),
  projectSelect: document.querySelector("#projectSelect"),
  saveProject: document.querySelector("#saveProjectBtn"),
  refreshProjects: document.querySelector("#refreshProjectsBtn"),
  loadProject: document.querySelector("#loadProjectBtn"),
  deleteProject: document.querySelector("#deleteProjectBtn"),
  length: document.querySelector("#lengthSelect"),
  pace: document.querySelector("#paceSelect"),
  voice: document.querySelector("#voiceSelect"),
  caption: document.querySelector("#captionSelect"),
  accent: document.querySelector("#accentInput"),
  music: document.querySelector("#musicSelect"),
  source: document.querySelector("#sourceSelect"),
  mediaType: document.querySelector("#mediaTypeSelect"),
  pexelsKey: document.querySelector("#pexelsKeyInput"),
  pixabayKey: document.querySelector("#pixabayKeyInput"),
  dvidsKey: document.querySelector("#dvidsKeyInput"),
  providerStatus: document.querySelector("#providerStatus"),
  providerBox: document.querySelector("#providerBox"),
  saveProviderKeys: document.querySelector("#saveProviderKeysBtn"),
  checkProviders: document.querySelector("#checkProvidersBtn"),
  musicSearch: document.querySelector("#musicSearchInput"),
  musicButton: document.querySelector("#musicSearchBtn"),
  clearMusic: document.querySelector("#clearMusicBtn"),
  musicUpload: document.querySelector("#musicUploadInput"),
  musicResults: document.querySelector("#musicResults"),
  musicStatus: document.querySelector("#musicStatus"),
  ttsEngine: document.querySelector("#ttsEngineSelect"),
  ttsEndpoint: document.querySelector("#ttsEndpointInput"),
  ttsModel: document.querySelector("#ttsModelInput"),
  ttsAiVoice: document.querySelector("#ttsVoiceInput"),
  ttsStatus: document.querySelector("#ttsStatus"),
  ttsEnginesBtn: document.querySelector("#ttsEnginesBtn"),
  ttsSaveBtn: document.querySelector("#ttsSaveBtn"),
  ttsInstallBox: document.querySelector("#ttsInstallBox"),
  flowInput: document.querySelector("#flowInput"),
  applyFlow: document.querySelector("#applyFlowBtn"),
  saveFlow: document.querySelector("#saveFlowBtn"),
  htmlScene: document.querySelector("#htmlSceneInput"),
  applyHtmlScene: document.querySelector("#applyHtmlSceneBtn"),
  previewHtmlScene: document.querySelector("#previewHtmlSceneBtn"),
  generateHtmlScene: document.querySelector("#generateHtmlSceneBtn"),
  autoDirect: document.querySelector("#autoDirectBtn"),
  directorPlan: document.querySelector("#directorPlanBtn"),
  directorScore: document.querySelector("#directorScore"),
  directorNotes: document.querySelector("#directorNotes"),
  integration: document.querySelector("#integrationBtn"),
  copyBrief: document.querySelector("#copyBriefBtn"),
  integrationStatus: document.querySelector("#integrationStatus"),
  integrationBox: document.querySelector("#integrationBox"),
  generate: document.querySelector("#generateBtn"),
  sample: document.querySelector("#sampleBtn"),
  preview: document.querySelector("#previewBtn"),
  record: document.querySelector("#recordBtn"),
  mp4: document.querySelector("#mp4Btn"),
  sourceReport: document.querySelector("#sourceReportBtn"),
  timeline: document.querySelector("#timeline"),
  beatCount: document.querySelector("#beatCount"),
  duration: document.querySelector("#durationReadout"),
  progress: document.querySelector("#progressBar"),
  download: document.querySelector("#downloadArea"),
  timecode: document.querySelector("#timecode"),
  activeBeat: document.querySelector("#activeBeat"),
  scrubber: document.querySelector("#scrubber"),
  stockSearch: document.querySelector("#stockSearchInput"),
  stockButton: document.querySelector("#stockSearchBtn"),
  autoStock: document.querySelector("#autoStockBtn"),
  stockResults: document.querySelector("#stockResults"),
  stockStatus: document.querySelector("#stockStatus")
};

const samplePrompt =
  "Explain why AI agents are changing how people build software, using a strong hook, stock footage, charts, code-style visuals, and clean captions.";

const state = {
  beats: [],
  selectedBeatId: null,
  currentTime: 0,
  playing: false,
  playStart: 0,
  audio: null,
  videoPool: new Map(),
  selectedMusic: null,
  lastWebm: null,
  lastWebmName: "",
  projectId: ""
};

const renderer = createRenderer(canvas, {
  onFrame(beat, time, duration) {
    updateReadouts(time, duration, beat);
  }
});

function selectedBeat() {
  return state.beats.find((beat) => beat.id === state.selectedBeatId) || activeBeatAt(state.beats, state.currentTime);
}

function scriptFromBeats() {
  return state.beats.map((beat) => beat.text).join(" ");
}

function syncScriptFromBeats() {
  els.script.value = scriptFromBeats();
}

function rebuildVideoPool() {
  state.videoPool = createVideoPool(state.beats);
}

function providerKeySettings() {
  return {
    pexels: els.pexelsKey.value.trim(),
    pixabay: els.pixabayKey.value.trim(),
    dvids: els.dvidsKey.value.trim()
  };
}

function saveProviderKeys() {
  localStorage.setItem("seval.providerKeys", JSON.stringify(providerKeySettings()));
  els.providerStatus.textContent = "Keys saved locally";
}

function loadProviderKeys() {
  try {
    const keys = JSON.parse(localStorage.getItem("seval.providerKeys") || "{}");
    els.pexelsKey.value = keys.pexels || "";
    els.pixabayKey.value = keys.pixabay || "";
    els.dvidsKey.value = keys.dvids || "";
  } catch {
    localStorage.removeItem("seval.providerKeys");
  }
}

function updateReadouts(time = state.currentTime, duration = totalDuration(state.beats), beat = activeBeatAt(state.beats, time)) {
  const assigned = state.beats.filter((item) => item.media).length;
  const quality = projectScore(state.beats, {
    caption: els.caption.value,
    prompt: els.prompt.value
  });
  els.timecode.textContent = formatTime(time);
  els.duration.textContent = formatTime(duration);
  els.beatCount.textContent = `${state.beats.length} beats`;
  els.stockStatus.textContent = `${assigned}/${state.beats.length} clips assigned`;
  els.directorScore.textContent = `Score ${quality.score}`;
  els.activeBeat.textContent = beat ? beat.text : "Ready";
  els.scrubber.value = String(duration ? Math.round((time / duration) * 1000) : 0);
  document.querySelectorAll(".beat-card").forEach((card) => {
    card.classList.toggle("active", beat?.id === card.dataset.id || state.selectedBeatId === card.dataset.id);
  });
}

function renderDirectorNotes(notes) {
  els.directorNotes.innerHTML = "";
  for (const note of notes.slice(0, 5)) {
    const item = document.createElement("div");
    item.textContent = note;
    els.directorNotes.append(item);
  }
}

function draw(time = state.currentTime) {
  renderer.drawFrame(state.beats, time, state.videoPool, {
    caption: els.caption.value,
    accent: els.accent.value
  });
}

function generate() {
  stopPreview();
  const preset = els.preset.value === "auto" ? inferPreset(els.prompt.value) : els.preset.value;
  const script =
    els.script.value.trim() ||
    composeScript(els.prompt.value, els.style.value, els.length.value, els.pace.value, preset);
  els.script.value = script;
  state.beats = buildBeats(script, {
    style: els.style.value,
    length: els.length.value,
    preset
  });
  state.selectedBeatId = state.beats[0]?.id || null;
  state.currentTime = 0;
  rebuildVideoPool();
  renderTimeline();
  const quality = projectScore(state.beats, { caption: els.caption.value, prompt: els.prompt.value });
  renderDirectorNotes(quality.notes);
  draw(0);
}

function assignMediaToBeat(beat, media) {
  if (!beat) return;
  beat.media = media;
  beat.visual = "stock";
  rebuildVideoPool();
  renderTimeline();
  draw(state.currentTime);
}

function serializeProject() {
  return {
    name: els.projectName.value.trim() || "Untitled Seval Video",
    prompt: els.prompt.value,
    script: els.script.value,
    settings: {
      preset: els.preset.value,
      style: els.style.value,
      length: els.length.value,
      pace: els.pace.value,
      voice: els.voice.value,
      caption: els.caption.value,
      accent: els.accent.value,
      music: els.music.value,
      source: els.source.value,
      mediaType: els.mediaType.value,
      selectedMusic: state.selectedMusic
        ? {
            id: state.selectedMusic.id,
            source: state.selectedMusic.source,
            title: state.selectedMusic.title,
            credit: state.selectedMusic.credit,
            license: state.selectedMusic.license,
            pageUrl: state.selectedMusic.pageUrl,
            url: state.selectedMusic.url,
            previewUrl: state.selectedMusic.previewUrl,
            mime: state.selectedMusic.mime
          }
        : null,
      sceneFlow: els.flowInput.value,
      tts: {
        engine: els.ttsEngine.value,
        endpoint: els.ttsEndpoint.value,
        model: els.ttsModel.value,
        aiVoice: els.ttsAiVoice.value
      }
    },
    beats: state.beats,
    savedAt: new Date().toISOString()
  };
}

function applyProject(project) {
  const settings = project.settings || {};
  els.projectName.value = project.name || "Untitled Seval Video";
  els.prompt.value = project.prompt || "";
  els.script.value = project.script || "";
  if (settings.preset) els.preset.value = settings.preset;
  if (settings.style) els.style.value = settings.style;
  if (settings.length) els.length.value = settings.length;
  if (settings.pace) els.pace.value = settings.pace;
  if (settings.caption) els.caption.value = settings.caption;
  if (settings.accent) els.accent.value = settings.accent;
  if (settings.music) els.music.value = settings.music;
  if (settings.source) els.source.value = settings.source;
  if (settings.mediaType) els.mediaType.value = settings.mediaType;
  state.selectedMusic = settings.selectedMusic || null;
  els.musicStatus.textContent = state.selectedMusic ? `Music: ${state.selectedMusic.title}` : "Generated bed";
  if (settings.sceneFlow) els.flowInput.value = settings.sceneFlow;
  if (settings.tts?.engine) els.ttsEngine.value = settings.tts.engine;
  if (settings.tts?.endpoint) els.ttsEndpoint.value = settings.tts.endpoint;
  if (settings.tts?.model) els.ttsModel.value = settings.tts.model;
  if (settings.tts?.aiVoice) els.ttsAiVoice.value = settings.tts.aiVoice;
  state.beats = Array.isArray(project.beats) ? project.beats : buildBeats(els.script.value, {
    style: els.style.value,
    length: els.length.value,
    preset: els.preset.value
  });
  state.selectedBeatId = state.beats[0]?.id || null;
  state.currentTime = 0;
  rebuildVideoPool();
  renderTimeline();
  const quality = projectScore(state.beats, { caption: els.caption.value, prompt: els.prompt.value });
  renderDirectorNotes(quality.notes);
  draw(0);
}

function renderSearchResults(results) {
  els.stockResults.innerHTML = "";
  if (!results.length) {
    els.stockResults.textContent = "No public footage found for that query.";
    return;
  }
  const target = selectedBeat();
  for (const result of results) {
    const item = document.createElement("article");
    item.className = "stock-item";

    const thumb = document.createElement("img");
    thumb.className = "stock-thumb";
    thumb.alt = "";
    thumb.src = result.thumb || "";

    const copy = document.createElement("div");
    copy.className = "stock-copy";

    const title = document.createElement("div");
    title.className = "stock-title";
    title.textContent = result.title || "Untitled public clip";

    const meta = document.createElement("div");
    meta.className = "stock-meta";
    meta.textContent = `${result.source} - ${result.license}`;

    const actions = document.createElement("div");
    actions.className = "stock-actions";

    const assign = document.createElement("button");
    assign.textContent = target ? "Use for beat" : "Use";
    assign.addEventListener("click", () => assignMediaToBeat(selectedBeat(), result));

    const open = document.createElement("a");
    open.href = result.pageUrl;
    open.target = "_blank";
    open.rel = "noreferrer";
    open.textContent = "Source";

    actions.append(assign, open);
    copy.append(title, meta, actions);
    item.append(thumb, copy);
    els.stockResults.append(item);
  }
}

async function searchStock(query = els.stockSearch.value.trim()) {
  const target = selectedBeat();
  const finalQuery = query || target?.stockQuery || "military exercise public domain";
  els.stockSearch.value = finalQuery;
  els.stockButton.disabled = true;
  els.stockButton.textContent = "Searching...";
  try {
    const data = await searchPublicMedia(finalQuery, els.source.value, 8, providerKeySettings(), els.mediaType.value);
    renderSearchResults(data.results);
    if (data.warnings?.length) els.stockStatus.textContent = data.warnings[0];
  } finally {
    els.stockButton.disabled = false;
    els.stockButton.textContent = "Search";
  }
}

function renderMusicResults(results) {
  els.musicResults.innerHTML = "";
  if (!results.length) {
    els.musicResults.textContent = "No music found for that query.";
    return;
  }
  for (const result of results) {
    const item = document.createElement("article");
    item.className = "stock-item music-item";
    const preview = document.createElement("audio");
    preview.controls = true;
    preview.preload = "none";
    preview.src = result.previewUrl || result.url;
    preview.className = "audio-preview";

    const copy = document.createElement("div");
    copy.className = "stock-copy";
    const title = document.createElement("div");
    title.className = "stock-title";
    title.textContent = result.title || "Untitled music";
    const meta = document.createElement("div");
    meta.className = "stock-meta";
    meta.textContent = `${result.source} - ${result.license}`;
    const actions = document.createElement("div");
    actions.className = "stock-actions";
    const use = document.createElement("button");
    use.textContent = "Use music";
    use.addEventListener("click", () => {
      state.selectedMusic = result;
      els.musicStatus.textContent = `Music: ${result.title}`;
    });
    const open = document.createElement("a");
    open.href = result.pageUrl;
    open.target = "_blank";
    open.rel = "noreferrer";
    open.textContent = "Source";
    actions.append(use, open);
    copy.append(title, meta, actions);
    item.append(preview, copy);
    els.musicResults.append(item);
  }
}

async function searchMusic() {
  els.musicButton.disabled = true;
  els.musicButton.textContent = "Searching...";
  try {
    const data = await searchPublicMusic(els.musicSearch.value.trim() || "cinematic instrumental", "all", 8);
    renderMusicResults(data.results);
    if (data.warnings?.length) els.musicStatus.textContent = data.warnings[0];
  } finally {
    els.musicButton.disabled = false;
    els.musicButton.textContent = "Search music";
  }
}

async function checkProviders() {
  const data = await loadProviders();
  els.providerBox.innerHTML = "";
  for (const provider of data.providers) {
    const row = document.createElement("div");
    const localKey = providerKeySettings()[provider.id] ? "local key saved" : "";
    const status = provider.requiresKey
      ? provider.configured || localKey
        ? "available"
        : "needs key"
      : "available";
    row.textContent = `${provider.name} - ${status} - ${provider.media.join(", ")}`;
    els.providerBox.append(row);
  }
  els.providerStatus.textContent = "Sources checked";
}

async function refreshProjects() {
  const data = await fetch("/api/projects").then((res) => res.json());
  els.projectSelect.innerHTML = "";
  if (!data.projects.length) {
    els.projectSelect.append(new Option("No saved projects yet", ""));
    return;
  }
  for (const project of data.projects) {
    els.projectSelect.append(new Option(`${project.name} (${project.beats} beats)`, project.id));
  }
}

async function saveProject() {
  const project = serializeProject();
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: state.projectId || project.name,
      name: project.name,
      project
    })
  });
  if (!response.ok) throw new Error("Could not save project.");
  const saved = await response.json();
  state.projectId = saved.id;
  els.projectStatus.textContent = `Saved ${new Date(saved.updatedAt).toLocaleTimeString()}`;
  await refreshProjects();
  els.projectSelect.value = saved.id;
}

async function loadProject() {
  const id = els.projectSelect.value;
  if (!id) return;
  const data = await fetch(`/api/projects/${encodeURIComponent(id)}`).then((res) => res.json());
  state.projectId = data.id;
  applyProject(data.project || {});
  els.projectStatus.textContent = "Loaded";
}

async function deleteProject() {
  const id = els.projectSelect.value;
  if (!id) return;
  await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (state.projectId === id) state.projectId = "";
  els.projectStatus.textContent = "Deleted";
  await refreshProjects();
}

async function autoStock() {
  if (!state.beats.length) generate();
  stopPreview();
  els.autoStock.disabled = true;
  els.autoStock.textContent = "Matching...";
  await autoMatchBeats(state.beats, els.source.value, providerKeySettings(), (done, total, beat) => {
    els.stockStatus.textContent = beat ? `Searching ${done + 1}/${total}: ${beat.stockQuery}` : "Stock matching complete";
  });
  rebuildVideoPool();
  renderTimeline();
  draw(0);
  els.autoStock.disabled = false;
  els.autoStock.textContent = "Auto-match beats";
}

function renderTimeline() {
  els.timeline.innerHTML = "";
  for (const [index, beat] of state.beats.entries()) {
    beat.index = index;
    const card = document.createElement("article");
    card.className = "beat-card";
    card.dataset.id = beat.id;
    card.addEventListener("click", () => {
      state.selectedBeatId = beat.id;
      state.currentTime = beat.start;
      els.stockSearch.value = beat.stockQuery;
      draw(state.currentTime);
    });

    const meta = document.createElement("div");
    meta.className = "beat-meta";
    meta.innerHTML = `<strong>Beat ${index + 1}</strong><span>${formatTime(beat.start)} - ${beat.duration.toFixed(1)}s</span>`;

    const textarea = document.createElement("textarea");
    textarea.value = beat.text;
    textarea.addEventListener("input", () => {
      beat.text = textarea.value.trim();
      syncScriptFromBeats();
      draw(state.currentTime);
    });

    const select = document.createElement("select");
    for (const [value, label] of visualTypes) {
      select.append(new Option(label, value));
    }
    select.value = beat.visual;
    select.addEventListener("change", () => {
      beat.visual = select.value;
      draw(state.currentTime);
    });

    const mediaTitle = document.createElement("div");
    mediaTitle.className = "media-title";
    mediaTitle.textContent = beat.media ? `${beat.media.source}: ${beat.media.title}` : "No public clip assigned yet";

    const tools = document.createElement("div");
    tools.className = "beat-tools";
    const query = document.createElement("input");
    query.type = "text";
    query.value = beat.stockQuery;
    query.addEventListener("input", () => {
      beat.stockQuery = query.value;
    });

    const search = document.createElement("button");
    search.textContent = "Find";
    search.title = "Search this beat";
    search.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedBeatId = beat.id;
      searchStock(beat.stockQuery).catch((error) => alert(error.message));
    });

    const clear = document.createElement("button");
    clear.textContent = "Clear";
    clear.title = "Clear clip";
    clear.addEventListener("click", (event) => {
      event.stopPropagation();
      beat.media = null;
      beat.visual = "map";
      rebuildVideoPool();
      renderTimeline();
      draw(state.currentTime);
    });

    tools.append(query, search, clear);
    card.append(meta, textarea, select, mediaTitle, tools);
    els.timeline.append(card);
  }
  updateReadouts();
}

function parseSceneFlow() {
  const allowed = new Set(visualTypes.map(([value]) => value));
  return els.flowInput.value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => allowed.has(item));
}

function applySceneFlow() {
  const flow = parseSceneFlow();
  if (!flow.length) {
    alert(`Use scene IDs like: ${visualTypes.map(([value]) => value).join(", ")}`);
    return;
  }
  state.beats.forEach((beat, index) => {
    beat.visual = flow[index % flow.length];
  });
  renderTimeline();
  draw(state.currentTime);
}

function readHtmlScene() {
  try {
    return JSON.parse(els.htmlScene.value);
  } catch {
    return {
      title: "Custom scene",
      badge: "HTML-style",
      lines: els.htmlScene.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5)
    };
  }
}

function applyHtmlSceneToBeat() {
  const beat = selectedBeat();
  if (!beat) return;
  beat.visual = "html";
  beat.htmlScene = readHtmlScene();
  renderTimeline();
  draw(beat.start);
}

function generateHtmlSceneFromBeat() {
  const beat = selectedBeat();
  if (!beat) return;
  const words = beat.text
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 4)
    .slice(0, 5);
  const scene = {
    title: beat.text.length > 92 ? `${beat.text.slice(0, 89)}...` : beat.text,
    badge: `${els.preset.value === "auto" ? inferPreset(els.prompt.value) : els.preset.value} scene`,
    lines: words.length ? words.map((word, index) => `${index + 1}. ${word}`) : ["Hook", "Proof", "Takeaway"],
    motion: "slide, pulse, reveal"
  };
  els.htmlScene.value = JSON.stringify(scene, null, 2);
  applyHtmlSceneToBeat();
}

function runAutoDirector() {
  const directed = autoDirect(state.beats, {
    prompt: els.prompt.value,
    preset: els.preset.value,
    style: els.style.value
  });
  state.beats = directed;
  const preset = els.preset.value === "auto" ? inferPreset(els.prompt.value) : els.preset.value;
  els.flowInput.value = sceneFlowForPreset(preset, state.beats).join(", ");
  rebuildVideoPool();
  renderTimeline();
  const quality = projectScore(state.beats, { caption: els.caption.value, prompt: els.prompt.value });
  renderDirectorNotes(quality.notes);
  draw(state.currentTime);
}

function showDirectorPlan() {
  const quality = projectScore(state.beats, { caption: els.caption.value, prompt: els.prompt.value });
  const preset = els.preset.value === "auto" ? inferPreset(els.prompt.value) : els.preset.value;
  const flow = sceneFlowForPreset(preset, state.beats);
  renderDirectorNotes([
    `Detected preset: ${preset}`,
    `Recommended flow: ${flow.join(", ")}`,
    ...quality.notes
  ]);
}

async function showIntegrations() {
  const manifest = await fetch("/api/integrations").then((res) => res.json());
  els.integrationBox.innerHTML = "";
  const lines = [
    "MCP command:",
    `cd "${manifest.mcp.cwd}"`,
    "npm.cmd run mcp",
    "",
    "Codex run command:",
    "npm.cmd start",
    "",
    "Local app:",
    manifest.server
  ];
  for (const line of lines) {
    const block = document.createElement(line ? "code" : "div");
    block.textContent = line || " ";
    els.integrationBox.append(block);
  }
  els.integrationStatus.textContent = "Manifest loaded";
}

async function copyCodexBrief() {
  const manifest = await fetch("/api/integrations").then((res) => res.json());
  const brief = codexBrief(serializeProject(), manifest);
  await navigator.clipboard?.writeText(brief);
  els.integrationStatus.textContent = "Brief copied";
  els.integrationBox.innerHTML = "";
  const code = document.createElement("code");
  code.textContent = brief;
  els.integrationBox.append(code);
}

async function createNarrationAudio() {
  const narration = await tts(els.script.value, {
    voice: els.voice.value,
    pace: els.pace.value,
    engine: els.ttsEngine.value,
    endpoint: els.ttsEndpoint.value,
    model: els.ttsModel.value,
    aiVoice: els.ttsAiVoice.value
  });
  return narration;
}

async function prepareNarrationDuration(arrayBuffer) {
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  normalizeTiming(state.beats, Math.max(1, decoded.duration));
  await audioContext.close();
  renderTimeline();
  return decoded.duration;
}

async function playPreview() {
  if (!state.beats.length) generate();
  if (state.playing) {
    stopPreview();
    return;
  }
  els.preview.disabled = true;
  els.preview.textContent = "Preparing...";
  const audioBuffer = await createNarrationAudio();
  await prepareNarrationDuration(audioBuffer);
  const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  state.audio = audio;
  await startVideoPool(state.videoPool);
  audio.addEventListener("ended", stopPreview, { once: true });
  await audio.play();
  state.playing = true;
  state.playStart = performance.now() - state.currentTime * 1000;
  els.preview.disabled = false;
  els.preview.textContent = "Stop";
  requestAnimationFrame(tickPreview);
}

function tickPreview(now) {
  if (!state.playing) return;
  state.currentTime = (now - state.playStart) / 1000;
  draw(state.currentTime);
  if (state.currentTime < totalDuration(state.beats)) {
    requestAnimationFrame(tickPreview);
  } else {
    stopPreview();
  }
}

function stopPreview() {
  state.playing = false;
  if (state.audio) {
    state.audio.pause();
    URL.revokeObjectURL(state.audio.src);
    state.audio = null;
  }
  for (const video of state.videoPool.values()) {
    video.pause();
  }
  els.preview.disabled = false;
  els.preview.textContent = "Preview";
}

async function exportWebm() {
  if (!state.beats.length) generate();
  stopPreview();
  els.record.disabled = true;
  els.mp4.disabled = true;
  els.record.textContent = "Rendering...";
  els.progress.style.width = "0%";
  els.download.innerHTML = "";

  const narration = await createNarrationAudio();
  const audioContext = new AudioContext();
  const decoded = await audioContext.decodeAudioData(narration.slice(0));
  normalizeTiming(state.beats, Math.max(1, decoded.duration));
  renderTimeline();
  rebuildVideoPool();
  await startVideoPool(state.videoPool);

  const destination = audioContext.createMediaStreamDestination();
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.connect(destination);
  const decodedMusic = await fetchAudioBuffer(audioContext, state.selectedMusic).catch(() => null);
  addMusicAndSoundDesign(audioContext, destination, state.beats, decoded.duration, els.music.value, decodedMusic);

  const canvasStream = canvas.captureStream(30);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...destination.stream.getAudioTracks()
  ]);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const recorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: 7_500_000,
    audioBitsPerSecond: 192_000
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  await audioContext.resume();
  recorder.start(250);
  source.start();
  const started = performance.now();
  const duration = totalDuration(state.beats);

  await new Promise((resolve) => {
    function render(now) {
      const elapsed = (now - started) / 1000;
      state.currentTime = Math.min(elapsed, duration);
      draw(state.currentTime);
      els.progress.style.width = `${Math.min(100, (elapsed / duration) * 100)}%`;
      if (elapsed < duration + 0.15) {
        requestAnimationFrame(render);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(render);
  });

  recorder.stop();
  source.stop();
  canvasStream.getTracks().forEach((track) => track.stop());
  destination.stream.getTracks().forEach((track) => track.stop());
  for (const video of state.videoPool.values()) video.pause();
  await audioContext.close();

  const blob = await done;
  state.lastWebm = blob;
  state.lastWebmName = `seval-stock-${Date.now()}.webm`;
  addDownload(blob, state.lastWebmName, "Download WebM");
  els.progress.style.width = "100%";
  els.record.disabled = false;
  els.mp4.disabled = false;
  els.record.textContent = "Export WebM";
}

function addDownload(blob, filename, label) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.textContent = label;
  els.download.prepend(link);
}

function makeSourceReport() {
  const lines = [
    `Seval source report`,
    `Project: ${els.projectName.value.trim() || "Untitled Seval Video"}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Video sources:"
  ];
  state.beats.forEach((beat, index) => {
    if (!beat.media) return;
    lines.push(
      `${index + 1}. ${beat.media.title}`,
      `   Source: ${beat.media.source}`,
      `   Credit: ${beat.media.credit || "Unknown"}`,
      `   License: ${beat.media.license || "Check source"}`,
      `   URL: ${beat.media.pageUrl || beat.media.url}`,
      ""
    );
  });
  lines.push("Music:");
  if (state.selectedMusic) {
    lines.push(
      `Title: ${state.selectedMusic.title}`,
      `Source: ${state.selectedMusic.source}`,
      `Credit: ${state.selectedMusic.credit || "Unknown"}`,
      `License: ${state.selectedMusic.license || "Check source"}`,
      `URL: ${state.selectedMusic.pageUrl || state.selectedMusic.url || "Local upload"}`
    );
  } else {
    lines.push("Generated Web Audio bed inside Seval.");
  }
  addDownload(new Blob([lines.join("\n")], { type: "text/plain" }), `seval-sources-${Date.now()}.txt`, "Download Source Report");
}

async function makeMp4() {
  if (!state.lastWebm) return;
  els.mp4.disabled = true;
  els.mp4.textContent = "Converting...";
  const response = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "video/webm" },
    body: state.lastWebm
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not convert to MP4.");
  }
  const mp4 = await response.blob();
  addDownload(mp4, state.lastWebmName.replace(/\.webm$/, ".mp4"), "Download MP4");
  els.mp4.disabled = false;
  els.mp4.textContent = "Make MP4";
}

async function checkHealth() {
  try {
    const health = await fetch("/api/health").then((res) => res.json());
    const ffmpeg = health.checks.ffmpeg?.startsWith("ffmpeg") ? "FFmpeg ready" : "FFmpeg missing";
    els.systemStatus.textContent = `${ffmpeg} - public footage search - local narration`;
  } catch {
    els.systemStatus.textContent = "Local server is not responding";
  }
}

els.generate.addEventListener("click", generate);
els.saveProject.addEventListener("click", () => {
  saveProject().catch((error) => {
    els.projectStatus.textContent = "Save failed";
    alert(error.message);
  });
});
els.refreshProjects.addEventListener("click", () => {
  refreshProjects().catch((error) => alert(error.message));
});
els.loadProject.addEventListener("click", () => {
  loadProject().catch((error) => alert(error.message));
});
els.deleteProject.addEventListener("click", () => {
  deleteProject().catch((error) => alert(error.message));
});
els.sample.addEventListener("click", () => {
  els.prompt.value = samplePrompt;
  els.script.value = "";
  generate();
});
els.stockButton.addEventListener("click", () => {
  searchStock().catch((error) => alert(error.message));
});
els.saveProviderKeys.addEventListener("click", saveProviderKeys);
els.checkProviders.addEventListener("click", () => {
  checkProviders().catch((error) => alert(error.message));
});
els.musicButton.addEventListener("click", () => {
  searchMusic().catch((error) => alert(error.message));
});
els.clearMusic.addEventListener("click", () => {
  state.selectedMusic = null;
  els.musicStatus.textContent = "Generated bed";
});
els.musicUpload.addEventListener("change", async () => {
  const file = els.musicUpload.files?.[0];
  if (!file) return;
  state.selectedMusic = {
    id: `upload:${file.name}`,
    source: "Local upload",
    title: file.name,
    credit: "Local file",
    license: "User supplied",
    pageUrl: "",
    url: "",
    previewUrl: "",
    mime: file.type || "audio/mpeg",
    arrayBuffer: await file.arrayBuffer()
  };
  els.musicStatus.textContent = `Music: ${file.name}`;
});
els.autoDirect.addEventListener("click", runAutoDirector);
els.directorPlan.addEventListener("click", showDirectorPlan);
els.autoStock.addEventListener("click", () => {
  autoStock().catch((error) => {
    els.autoStock.disabled = false;
    els.autoStock.textContent = "Auto-match beats";
    alert(error.message);
  });
});
els.preview.addEventListener("click", () => {
  playPreview().catch((error) => {
    stopPreview();
    alert(error.message);
  });
});
els.record.addEventListener("click", () => {
  exportWebm().catch((error) => {
    els.record.disabled = false;
    els.record.textContent = "Export WebM";
    alert(error.message);
  });
});
els.mp4.addEventListener("click", () => {
  makeMp4().catch((error) => {
    els.mp4.disabled = false;
    els.mp4.textContent = "Make MP4";
    alert(error.message);
  });
});
els.sourceReport.addEventListener("click", makeSourceReport);
els.script.addEventListener("input", () => {
  const preset = els.preset.value === "auto" ? inferPreset(`${els.prompt.value} ${els.script.value}`) : els.preset.value;
  state.beats = buildBeats(els.script.value, {
    style: els.style.value,
    length: els.length.value,
    preset
  });
  state.selectedBeatId = state.beats[0]?.id || null;
  rebuildVideoPool();
  renderTimeline();
  draw(0);
});
els.caption.addEventListener("change", () => draw(state.currentTime));
els.accent.addEventListener("input", () => draw(state.currentTime));
els.ttsSaveBtn.addEventListener("click", () => {
  localStorage.setItem(
    "seval.tts",
    JSON.stringify({
      engine: els.ttsEngine.value,
      endpoint: els.ttsEndpoint.value,
      model: els.ttsModel.value,
      aiVoice: els.ttsAiVoice.value
    })
  );
  els.ttsStatus.textContent = "Voice setup saved";
});
els.ttsEnginesBtn.addEventListener("click", async () => {
  els.ttsInstallBox.textContent = "Checking engines...";
  const data = await fetch("/api/tts/engines").then((res) => res.json());
  els.ttsInstallBox.innerHTML = "";
  for (const engine of data.engines) {
    const row = document.createElement("div");
    const installed = engine.installed ? "installed" : "optional";
    row.innerHTML = `<strong>${engine.name}</strong> - ${installed}<br>${engine.notes || ""}`;
    if (engine.command) {
      const code = document.createElement("code");
      code.textContent = engine.command;
      row.append(code);
    }
    els.ttsInstallBox.append(row);
  }
});
els.integration.addEventListener("click", () => {
  showIntegrations().catch((error) => alert(error.message));
});
els.copyBrief.addEventListener("click", () => {
  copyCodexBrief().catch((error) => alert(error.message));
});
els.applyFlow.addEventListener("click", applySceneFlow);
els.saveFlow.addEventListener("click", () => {
  localStorage.setItem("seval.sceneFlow", els.flowInput.value);
  applySceneFlow();
});
els.applyHtmlScene.addEventListener("click", applyHtmlSceneToBeat);
els.previewHtmlScene.addEventListener("click", () => {
  const beat = selectedBeat();
  if (!beat) return;
  const previousVisual = beat.visual;
  const previousScene = beat.htmlScene;
  beat.visual = "html";
  beat.htmlScene = readHtmlScene();
  draw(beat.start);
  beat.visual = previousVisual;
  beat.htmlScene = previousScene;
});
els.generateHtmlScene.addEventListener("click", generateHtmlSceneFromBeat);
els.scrubber.addEventListener("input", () => {
  stopPreview();
  state.currentTime = (Number(els.scrubber.value) / 1000) * totalDuration(state.beats);
  draw(state.currentTime);
});

await checkHealth();
loadProviderKeys();
await loadVoices(els.voice);
await checkProviders().catch(() => {});
try {
  const saved = JSON.parse(localStorage.getItem("seval.tts") || "{}");
  if (saved.engine) els.ttsEngine.value = saved.engine;
  if (saved.endpoint) els.ttsEndpoint.value = saved.endpoint;
  if (saved.model) els.ttsModel.value = saved.model;
  if (saved.aiVoice) els.ttsAiVoice.value = saved.aiVoice;
} catch {
  localStorage.removeItem("seval.tts");
}
const savedFlow = localStorage.getItem("seval.sceneFlow");
if (savedFlow) els.flowInput.value = savedFlow;
await refreshProjects().catch(() => {});
generate();
