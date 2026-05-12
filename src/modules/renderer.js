import { captionPresets } from "./scriptTemplates.js";
import { activeBeatAt, clamp, formatTime, totalDuration } from "./storyboard.js";

const palette = {
  bg: "#090b10",
  panel: "rgba(10, 13, 18, 0.82)",
  panelSoft: "rgba(18, 24, 31, 0.62)",
  line: "rgba(255, 255, 255, 0.12)",
  lineStrong: "rgba(255, 255, 255, 0.24)",
  text: "#f5f7fb",
  muted: "rgba(245, 247, 251, 0.72)",
  dim: "rgba(245, 247, 251, 0.48)",
  shadow: "rgba(0, 0, 0, 0.44)"
};

const legacyMap = {
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
};

export function createRenderer(canvas, hooks = {}) {
  const ctx = canvas.getContext("2d");

  function roundedRect(x, y, w, h, r = 8) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function fillRoundedRect(x, y, w, h, r, fill) {
    ctx.save();
    roundedRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function strokeRoundedRect(x, y, w, h, r, stroke, lineWidth = 1) {
    ctx.save();
    roundedRect(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  function setText(size, weight = 700, color = palette.text, family = "Inter, Segoe UI, sans-serif") {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${family}`;
  }

  function wrapLines(text, maxWidth, size, weight = 700) {
    setText(size, weight);
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawTextBlock(text, x, y, maxWidth, size, lineHeight, maxLines, weight = 700, color = palette.text) {
    const lines = wrapLines(text, maxWidth, size, weight).slice(0, maxLines);
    setText(size, weight, color);
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
    return lines.length;
  }

  function safeScene(beat) {
    return beat?.scene || {
      title: beat?.text || "",
      kicker: "Explainer",
      bullets: [],
      chips: [],
      caption: beat?.text || "",
      emphasis: "",
      quote: beat?.text || ""
    };
  }

  function normalizedVisual(beat) {
    const visual = beat?.visual || "hero";
    return legacyMap[visual] || visual;
  }

  function drawBackdrop(time, accent) {
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, "#070910");
    bg.addColorStop(0.55, "#0d1220");
    bg.addColorStop(1, "#090d16");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const offset = (time * 12) % 72;
    for (let x = -offset; x < canvas.width + 72; x += 72) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offset; y < canvas.height + 72; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(1080, 120, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.arc(180, 580, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMediaBackground(media, progress) {
    if (media instanceof HTMLImageElement && media.complete && media.naturalWidth > 0) {
      const scale = Math.max(canvas.width / media.naturalWidth, canvas.height / media.naturalHeight) * (1.04 + progress * 0.05);
      const w = media.naturalWidth * scale;
      const h = media.naturalHeight * scale;
      const x = (canvas.width - w) / 2 + Math.sin(progress * Math.PI * 2) * 20;
      const y = (canvas.height - h) / 2 + Math.cos(progress * Math.PI * 2) * 10;
      ctx.drawImage(media, x, y, w, h);
      return true;
    }
    if (media instanceof HTMLVideoElement && media.readyState >= 2) {
      const scale = Math.max(canvas.width / media.videoWidth, canvas.height / media.videoHeight) * (1.03 + progress * 0.03);
      const w = media.videoWidth * scale;
      const h = media.videoHeight * scale;
      const x = (canvas.width - w) / 2 + Math.sin(progress * Math.PI * 2) * 12;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(media, x, y, w, h);
      return true;
    }
    return false;
  }

  function drawMediaOverlay(accent, strength = 0.7) {
    const top = ctx.createLinearGradient(0, 0, 0, canvas.height);
    top.addColorStop(0, `rgba(5, 7, 10, ${0.38 + strength * 0.12})`);
    top.addColorStop(0.45, `rgba(7, 10, 14, ${0.2 + strength * 0.08})`);
    top.addColorStop(1, `rgba(5, 7, 10, ${0.68 + strength * 0.14})`);
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, canvas.width, 6);
    ctx.restore();
  }

  function drawChips(chips, x, y, accent) {
    let offset = x;
    for (const chip of chips.slice(0, 4)) {
      setText(15, 700);
      const width = Math.ceil(ctx.measureText(chip).width) + 26;
      fillRoundedRect(offset, y, width, 30, 15, "rgba(255,255,255,0.08)");
      strokeRoundedRect(offset, y, width, 30, 15, "rgba(255,255,255,0.12)");
      setText(15, 700, accent);
      ctx.fillText(chip, offset + 13, y + 20);
      offset += width + 10;
    }
  }

  function drawPanelTitle(scene, accent, progress, x = 88, y = 96, width = 660) {
    setText(15, 700, accent);
    ctx.fillText((scene.kicker || "Explainer").toUpperCase(), x, y);
    drawTextBlock(scene.title || "", x, y + 44, width, 56, 62, 2, 800, palette.text);
    if (scene.chips?.length) drawChips(scene.chips, x, y + 130 + progress * 6, accent);
  }

  function drawBulletList(scene, accent, x, y, width, progress) {
    const bullets = scene.bullets?.length ? scene.bullets : [scene.caption];
    bullets.slice(0, 3).forEach((bullet, index) => {
      const on = progress >= index * 0.18;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.3;
      fillRoundedRect(x, y + index * 70, width, 54, 10, "rgba(255,255,255,0.06)");
      setText(18, 800, accent);
      ctx.fillText(String(index + 1).padStart(2, "0"), x + 18, y + 33 + index * 70);
      drawTextBlock(bullet, x + 64, y + 35 + index * 70, width - 86, 22, 26, 1, 600, palette.text);
      ctx.restore();
    });
  }

  function drawDivider(accent, x, y, w, progress) {
    fillRoundedRect(x, y, w * progress, 5, 3, accent);
  }

  function sceneHook(beat, scene, progress, accent) {
    const bg = ctx.createRadialGradient(640, 240, 20, 640, 240, 620);
    bg.addColorStop(0, "rgba(18,25,40,0.92)");
    bg.addColorStop(1, "#06080d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawDivider(accent, 84, 74, 280, Math.min(1, progress * 1.3));
    setText(16, 700, accent);
    ctx.fillText("SEVAL EXPLAINER", 84, 120);
    const title = beat.text.replace(/^I will be talking about this:\s*/i, "").replace(/\.$/, "");
    drawTextBlock(title, 84, 232, 920, 72, 80, 3, 800, palette.text);
    setText(20, 500, palette.muted);
    drawTextBlock(scene.caption, 88, 488, 780, 30, 36, 2, 500, palette.muted);
    fillRoundedRect(84, 580, 300, 44, 22, "rgba(255,255,255,0.06)");
    setText(18, 700, accent);
    ctx.fillText(scene.kicker || "Opening line", 104, 608);
  }

  function sceneHero(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 6, accent);
    fillRoundedRect(72, 74, 580, 292, 10, "rgba(8, 10, 14, 0.62)");
    strokeRoundedRect(72, 74, 580, 292, 10, "rgba(255,255,255,0.1)");
    drawPanelTitle(scene, accent, progress, 96, 112, 520);
    setText(26, 600, palette.muted);
    drawTextBlock(scene.caption, 96, 284, 500, 26, 32, 3, 600, palette.muted);
    if (scene.emphasis) {
      fillRoundedRect(918, 90, 214, 72, 10, "rgba(8, 10, 14, 0.74)");
      setText(15, 700, palette.dim);
      ctx.fillText("FOCUS", 942, 118);
      setText(28, 800, accent);
      ctx.fillText(scene.emphasis, 942, 148);
    }
    if (scene.chips?.length) drawChips(scene.chips, 96, 320, accent);
  }

  function sceneFocus(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 5, accent);
    fillRoundedRect(70, 90, 520, 440, 10, "rgba(8, 10, 14, 0.76)");
    strokeRoundedRect(70, 90, 520, 440, 10, "rgba(255,255,255,0.1)");
    drawPanelTitle(scene, accent, progress, 96, 128, 460);
    drawBulletList(scene, accent, 96, 282, 454, progress);

    fillRoundedRect(710, 132, 454, 334, 10, "rgba(10, 13, 18, 0.52)");
    strokeRoundedRect(710, 132, 454, 334, 10, "rgba(255,255,255,0.08)");
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(772, 392);
    ctx.bezierCurveTo(862, 260, 938, 240, 1082, 204 + Math.sin(progress * Math.PI) * 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(956, 328);
    ctx.lineTo(1088, 204);
    ctx.lineTo(1052, 208);
    ctx.stroke();
    ctx.restore();

    fillRoundedRect(774, 340, 170, 76, 10, "rgba(255,255,255,0.08)");
    fillRoundedRect(956, 184, 170, 76, 10, "rgba(255,255,255,0.08)");
    setText(15, 700, palette.dim);
    ctx.fillText("CAUSE", 796, 368);
    ctx.fillText("RESULT", 980, 212);
    setText(28, 800, accent);
    ctx.fillText(scene.bullets?.[0] || scene.title, 796, 404);
    ctx.fillText(scene.bullets?.[1] || scene.emphasis || scene.caption, 980, 248);
  }

  function sceneProcess(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 5, accent);
    drawPanelTitle(scene, accent, progress, 88, 102, 720);
    const cards = (scene.bullets?.length ? scene.bullets : scene.chips).slice(0, 4);
    cards.forEach((item, index) => {
      const x = 82 + index * 286;
      const y = 296;
      const active = progress >= index * 0.18;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.35;
      fillRoundedRect(x, y, 250, 190, 10, "rgba(8, 10, 14, 0.78)");
      strokeRoundedRect(x, y, 250, 190, 10, "rgba(255,255,255,0.1)");
      setText(42, 800, active ? accent : palette.dim);
      ctx.fillText(String(index + 1).padStart(2, "0"), x + 24, y + 54);
      drawTextBlock(item, x + 24, y + 106, 192, 28, 34, 2, 700, palette.text);
      ctx.restore();
      if (index < cards.length - 1) {
        fillRoundedRect(x + 248, 388, 30, 6, 3, "rgba(255,255,255,0.24)");
      }
    });
  }

  function sceneStats(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 6, accent);
    drawPanelTitle(scene, accent, progress, 88, 98, 720);
    const labels = (scene.chips?.length ? scene.chips : scene.bullets || []).slice(0, 4);
    const values = [0.42, 0.68, 0.56, 0.82];
    fillRoundedRect(82, 250, 1114, 330, 10, "rgba(8, 10, 14, 0.72)");
    strokeRoundedRect(82, 250, 1114, 330, 10, "rgba(255,255,255,0.08)");
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(128, 534);
    ctx.lineTo(1150, 534);
    ctx.lineTo(1150, 294);
    ctx.stroke();
    ctx.restore();
    labels.forEach((label, index) => {
      const x = 164 + index * 238;
      const h = 210 * values[index] * progress;
      fillRoundedRect(x, 534 - h, 112, h, 8, index % 2 ? "rgba(255,255,255,0.2)" : accent);
      setText(17, 700, palette.muted);
      drawTextBlock(label, x - 4, 566, 120, 17, 20, 2, 700, palette.muted);
    });
    if (scene.emphasis) {
      fillRoundedRect(968, 104, 198, 72, 10, "rgba(8,10,14,0.74)");
      setText(15, 700, palette.dim);
      ctx.fillText("SIGNAL", 992, 132);
      setText(30, 800, accent);
      ctx.fillText(scene.emphasis, 992, 162);
    }
  }

  function sceneTimeline(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 6, accent);
    drawPanelTitle(scene, accent, progress, 88, 102, 700);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(140, 398);
    ctx.lineTo(1140, 398);
    ctx.stroke();
    ctx.restore();
    const labels = (scene.bullets?.length ? scene.bullets : scene.chips).slice(0, 4);
    labels.forEach((label, index) => {
      const x = 170 + index * 314;
      const active = progress >= index * 0.18;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.34;
      fillRoundedRect(x - 80, 286, 160, 72, 10, "rgba(8, 10, 14, 0.78)");
      strokeRoundedRect(x - 80, 286, 160, 72, 10, "rgba(255,255,255,0.08)");
      fillRoundedRect(x - 16, 382, 32, 32, 16, active ? accent : "rgba(255,255,255,0.18)");
      setText(14, 700, palette.dim);
      ctx.fillText(String(index + 1).padStart(2, "0"), x - 12, 434);
      drawTextBlock(label, x - 60, 314, 120, 18, 22, 2, 700, palette.text);
      ctx.restore();
    });
  }

  function sceneSplit(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 5, accent);
    drawPanelTitle(scene, accent, progress, 88, 98, 720);
    const left = scene.bullets?.[0] || scene.chips?.[0] || "Option A";
    const right = scene.bullets?.[1] || scene.chips?.[1] || "Option B";
    const leftPoints = scene.bullets?.slice(0, 3) || [];
    const rightPoints = scene.chips?.slice(1, 4) || [];
    fillRoundedRect(82, 242, 522, 300, 10, "rgba(8, 10, 14, 0.76)");
    fillRoundedRect(676, 242, 522, 300, 10, "rgba(8, 10, 14, 0.76)");
    strokeRoundedRect(82, 242, 522, 300, 10, "rgba(255,255,255,0.08)");
    strokeRoundedRect(676, 242, 522, 300, 10, "rgba(255,255,255,0.08)");
    setText(30, 800, accent);
    ctx.fillText(left, 114, 298);
    setText(30, 800, palette.text);
    ctx.fillText(right, 708, 298);
    drawBulletList({ bullets: leftPoints }, accent, 114, 334, 456, progress);
    drawBulletList({ bullets: rightPoints }, palette.text, 708, 334, 456, progress);
  }

  function sceneBoard(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 5, accent);
    fillRoundedRect(104, 92, 1072, 512, 10, "rgba(8, 10, 14, 0.84)");
    strokeRoundedRect(104, 92, 1072, 512, 10, "rgba(255,255,255,0.1)");
    fillRoundedRect(104, 92, 1072, 48, 10, "rgba(255,255,255,0.06)");
    fillRoundedRect(126, 110, 10, 10, 5, "#ff6b6b");
    fillRoundedRect(144, 110, 10, 10, 5, "#ffd166");
    fillRoundedRect(162, 110, 10, 10, 5, accent);
    drawPanelTitle(scene, accent, progress, 142, 188, 840);
    const lines = scene.bullets?.length
      ? scene.bullets
      : [
          "Pick a visual per idea.",
          "Use real media for context.",
          "Use overlays for explanation."
        ];
    lines.slice(0, 3).forEach((line, index) => {
      fillRoundedRect(142, 322 + index * 68, 720, 50, 8, "rgba(255,255,255,0.05)");
      setText(20, 700, accent);
      ctx.fillText(`0${index + 1}`, 160, 354 + index * 68);
      drawTextBlock(line, 212, 356 + index * 68, 610, 22, 28, 1, 600, palette.text);
    });
    fillRoundedRect(898, 224, 228, 280, 10, "rgba(255,255,255,0.05)");
    setText(15, 700, palette.dim);
    ctx.fillText("MODULES", 924, 254);
    (scene.chips?.length ? scene.chips : ["Script", "Scenes", "Media", "Audio"]).slice(0, 4).forEach((chip, index) => {
      fillRoundedRect(924, 284 + index * 48, 176, 34, 17, index % 2 ? "rgba(255,255,255,0.08)" : accent);
      setText(16, 700, index % 2 ? palette.text : "#071015");
      ctx.fillText(chip, 940, 307 + index * 48);
    });
  }

  function sceneQuote(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 4, accent);
    setText(140, 800, accent, "Georgia, serif");
    ctx.fillText("“", 92, 222);
    drawTextBlock(scene.quote || beat.text, 180, 234, 860, 52, 62, 4, 800, palette.text);
    drawDivider(accent, 184, 524, 280, Math.min(1, progress * 1.2));
    setText(22, 600, palette.muted);
    ctx.fillText(scene.kicker || "Key line", 184, 568);
  }

  function sceneSummary(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 3, accent);
    fillRoundedRect(140, 116, 1000, 438, 12, "rgba(8, 10, 14, 0.78)");
    strokeRoundedRect(140, 116, 1000, 438, 12, "rgba(255,255,255,0.1)");
    setText(16, 700, accent);
    ctx.fillText("TAKEAWAY", 176, 166);
    drawTextBlock(scene.title || beat.text, 176, 242, 900, 60, 68, 2, 800, palette.text);
    drawBulletList(scene, accent, 176, 356, 816, progress);
    drawDivider(accent, 176, 512, 780, Math.min(1, progress * 1.2));
  }

  function sceneHtml(beat, scene, progress, accent, hasMedia) {
    if (!hasMedia) drawBackdrop(progress * 6, accent);
    const custom = beat.htmlScene || {};
    const title = custom.title || scene.title;
    const badge = custom.badge || "Scene JSON";
    const lines = Array.isArray(custom.lines) && custom.lines.length ? custom.lines : scene.bullets;
    fillRoundedRect(110, 108, 1060, 500, 10, "rgba(8, 10, 14, 0.82)");
    strokeRoundedRect(110, 108, 1060, 500, 10, "rgba(255,255,255,0.1)");
    fillRoundedRect(140, 144, 220, 34, 17, "rgba(255,255,255,0.06)");
    setText(15, 700, accent);
    ctx.fillText(badge, 160, 166);
    drawTextBlock(title, 140, 250, 760, 54, 62, 2, 800, palette.text);
    lines.slice(0, 4).forEach((line, index) => {
      fillRoundedRect(144, 332 + index * 60, 512, 40, 8, "rgba(255,255,255,0.05)");
      setText(18, 700, index % 2 ? accent : palette.text);
      ctx.fillText(line, 168, 358 + index * 60);
    });
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(734, 418);
    ctx.bezierCurveTo(820, 320, 934, 494, 1088, 296);
    ctx.stroke();
    ctx.restore();
  }

  function drawCaption(beat, progress, captionKey = "documentary", accent) {
    const preset = captionPresets[captionKey] || captionPresets.documentary;
    const alphaIn = clamp(progress / 0.14, 0, 1);
    const alphaOut = clamp((1 - progress) / 0.12, 0, 1);
    const alpha = Math.min(alphaIn, alphaOut);
    if (alpha <= 0) return;

    const text = beat.captionText || beat.scene?.caption || beat.text;
    ctx.save();
    ctx.globalAlpha = alpha;
    const center = preset.position === "center";
    const x = center ? 160 : 96;
    const y = center ? 534 : preset.position === "bottom" ? 642 : 594;
    const w = center ? 960 : 1088;
    const h = center ? 84 : 56;
    if (preset.box) {
      fillRoundedRect(x, y, w, h, 10, "rgba(6, 8, 12, 0.78)");
      strokeRoundedRect(x, y, w, h, 10, "rgba(255,255,255,0.1)");
      fillRoundedRect(x, y, 4, h, 2, accent);
    }
    setText(center ? 34 : 24, preset.weight === "black" ? 800 : preset.weight === "medium" ? 500 : 700, palette.text);
    if (center) {
      ctx.textAlign = "center";
      drawTextBlock(text, canvas.width / 2 - 420, y + 48, 840, 34, 40, 1, preset.weight === "black" ? 800 : 700, palette.text);
      ctx.textAlign = "left";
    } else {
      drawTextBlock(text, x + (preset.box ? 24 : 0), y + 34, w - 42, 24, 28, 1, preset.weight === "medium" ? 500 : 700, palette.text);
    }
    ctx.restore();
  }

  function drawHeader(beat, time, duration, accent) {
    fillRoundedRect(44, 28, 1192, 52, 10, "rgba(7, 10, 14, 0.62)");
    strokeRoundedRect(44, 28, 1192, 52, 10, "rgba(255,255,255,0.08)");
    setText(22, 800, palette.text);
    ctx.fillText("SEVAL", 68, 61);
    setText(14, 700, palette.dim);
    ctx.fillText("Modular AI Video Studio", 150, 61);
    ctx.textAlign = "right";
    setText(16, 700, palette.muted);
    ctx.fillText(`${formatTime(time)} / ${formatTime(duration)}`, 1210, 61);
    ctx.textAlign = "left";
    fillRoundedRect(68, 72, 280 * ((time % 6) / 6), 4, 2, accent);
    if (beat) {
      fillRoundedRect(1012, 92, 170, 32, 16, "rgba(7,10,14,0.62)");
      setText(14, 700, accent);
      ctx.fillText((normalizedVisual(beat) || "scene").toUpperCase(), 1030, 113);
    }
  }

  function renderScene(beat, progress, media, options) {
    const scene = safeScene(beat);
    const accent = options.accent || "#9ad1ff";
    const hasMedia = drawMediaBackground(media, progress);
    if (hasMedia) drawMediaOverlay(accent, normalizedVisual(beat) === "hook" ? 0.9 : 0.7);
    const visual = normalizedVisual(beat);

    if (visual === "hook") {
      sceneHook(beat, scene, progress, accent);
      return;
    }
    if (visual === "focus") {
      sceneFocus(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "process") {
      sceneProcess(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "stats") {
      sceneStats(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "timeline") {
      sceneTimeline(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "split") {
      sceneSplit(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "board") {
      sceneBoard(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "quote") {
      sceneQuote(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "summary") {
      sceneSummary(beat, scene, progress, accent, hasMedia);
      return;
    }
    if (visual === "html") {
      sceneHtml(beat, scene, progress, accent, hasMedia);
      return;
    }
    sceneHero(beat, scene, progress, accent, hasMedia);
  }

  function drawFrame(beats, time = 0, videoPool = new Map(), options = {}) {
    const duration = totalDuration(beats) || 1;
    const safeTime = clamp(time, 0, duration);
    const beat = activeBeatAt(beats, safeTime);
    const progress = beat ? clamp((safeTime - beat.start) / Math.max(0.1, beat.duration), 0, 1) : 0;
    const accent = options.accent || "#8ec5ff";
    const mediaKey = beat?.media?.previewUrl;
    const media = mediaKey ? videoPool.get(mediaKey) : null;

    drawBackdrop(safeTime, accent);
    if (beat) renderScene(beat, progress, media, options);
    drawHeader(beat, safeTime, duration, accent);
    if (beat) drawCaption(beat, progress, options.caption, accent);
    hooks.onFrame?.(beat, safeTime, duration);
  }

  return { drawFrame };
}
