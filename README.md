# Seval

Seval is a local script-first video generator for modular explainer videos. It turns a prompt into narration beats, auto-picks scene types, searches public stock footage when useful, generates text/arrow/chart/timeline/code-style scenes when footage is not the best choice, adds narration/music/captions, and exports a video.

## Run

```powershell
npm.cmd start
```

Then open:

```text
http://localhost:5177
```

## What works locally

- Prompt to narration script
- Auto-pick presets for explainer, tech, business, history, science, tutorial, product, gaming, and military videos
- Auto Director scoring, notes, and scene-flow improvement
- Save, load, and delete local projects
- Sentence-by-sentence storyboard editing
- Public footage search from Wikimedia Commons, Internet Archive, NASA Image and Video Library, and optional-key providers Pexels, Pixabay, and DVIDS
- Public music/audio search from Wikimedia Commons, Internet Archive, and NASA
- Local music upload and real soundtrack mixing during export
- Per-beat clip assignment and auto-matching
- Black-screen hooks, image/text scenes, arrows, charts, timelines, comparisons, steps, code/UI scenes, quote cards, summaries, and HTML-style scenes
- Map, aircraft, naval, missile, radar, ground, city, and intel-board fallback visuals
- Windows text-to-speech narration
- OpenAI-compatible local TTS endpoint support for Kokoro, Chatterbox-style servers, Speaches, or other local voice tools
- Optional Kokoro and Chatterbox-Turbo installer scripts under `tools/tts`
- Customizable caption style and accent color
- Scene-flow preset maker
- Per-beat HTML-style scene JSON rendered through canvas for MP4/WebM export
- Codex/MCP integration panel
- Local MCP stdio bridge with project and media-search tools
- Source/license report generation
- Music beds and sound cues
- WebM export with stock footage, narration, music bed, and captions
- MP4 conversion through FFmpeg

## Notes

The app stays free by using public media sources first and generated map/icon visuals as fallback. Always check each clip's source page before publishing, because public availability does not automatically mean every use is license-free. It is built for fictional, educational, high-level scenario storytelling and avoids presenting stock clips as footage of a specific real event unless you have verified that source.

## Module Map

- `src/modules/scriptTemplates.js`: script styles, content presets, music presets, caption presets, visual types, and stock search keywords
- `src/modules/storyboard.js`: sentence splitting, beat timing, and active beat lookup
- `src/modules/director.js`: Auto Director scoring, preset inference, scene-flow recommendations, and Codex briefs
- `src/modules/media.js`: public media search helpers, auto-matching, and video pooling
- `src/modules/audio.js`: Windows narration and generated music/sound design
- `src/modules/renderer.js`: stock footage compositing, captions, headers, charts, hooks, HTML-style scenes, and fallback graphics

## HTML-Style Scenes

The browser records the canvas, so Seval renders HTML/CSS/JS-style motion as canvas scenes. Use the **HTML-Style Scene** panel to attach structured content to the selected beat:

```json
{
  "title": "Animated proof",
  "badge": "HTML / CSS / JS style",
  "lines": ["Hook", "Visual proof", "Clear takeaway"]
}
```

Those scenes are drawn into the same canvas as stock footage, captions, charts, and maps, which means they are included in WebM and MP4 exports.

## Codex and MCP

Run the browser studio:

```powershell
npm.cmd start
```

Run the local MCP stdio bridge:

```powershell
npm.cmd run mcp
```

MCP manifest:

```text
seval.mcp.json
```

MCP tools:

- `seval_list_projects`
- `seval_get_project`
- `seval_save_project`
- `seval_delete_project`
- `seval_search_media`
- `seval_search_music`
- `seval_list_providers`
- `seval_tts_engines`
- `seval_integrations`
- `seval_source_report`
- `seval_codex_brief`

The app also exposes:

```text
GET /api/integrations
```

This returns the local server, MCP command, and Codex-oriented project file map.

## Sample Video

Render the built-in chicken nuggets explainer sample:

```powershell
npm.cmd run sample:chicken-nuggets
```

Output:

```text
.seval/renders/seval-chicken-nuggets.mp4
```

Optional keyed providers can be configured in the app's **Source Keys** panel or through environment variables:

```powershell
$env:PEXELS_API_KEY="..."
$env:PIXABAY_API_KEY="..."
$env:DVIDS_API_KEY="..."
```

## Local AI Voice Support

Seval's safest default is Windows SAPI. For better voices, run a local OpenAI-compatible TTS server and select **OpenAI-compatible local TTS** in the app.

Optional installers:

```powershell
powershell -ExecutionPolicy Bypass -File tools\tts\install-kokoro.ps1
powershell -ExecutionPolicy Bypass -File tools\tts\install-chatterbox-turbo.ps1
```

Kokoro is usually lighter. Chatterbox-Turbo can be heavier and may require more local setup.
