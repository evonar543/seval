import { captionPresets } from "./scriptTemplates.js";
import { activeBeatAt, clamp, formatTime, totalDuration } from "./storyboard.js";

const palette = {
  bg: "#10120f",
  map: "#2f3a28",
  map2: "#435333",
  water: "#173342",
  grid: "rgba(242, 241, 232, 0.08)",
  text: "#f2f1e8",
  muted: "#b7bcae",
  green: "#8abd5f",
  amber: "#e5b95b",
  red: "#d65a4a",
  blue: "#64a6d9",
  black: "#080908"
};

export function createRenderer(canvas, hooks = {}) {
  const ctx = canvas.getContext("2d");

  function roundedRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function grid(time) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    const offset = (time * 18) % 64;
    for (let x = -offset; x < canvas.width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = offset; y < canvas.height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function map() {
    ctx.save();
    ctx.fillStyle = palette.water;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1280, 0);
    ctx.lineTo(1280, 255);
    ctx.bezierCurveTo(1010, 220, 850, 330, 640, 292);
    ctx.bezierCurveTo(420, 252, 220, 300, 0, 232);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.map;
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.bezierCurveTo(210, 330, 425, 280, 632, 324);
    ctx.bezierCurveTo(890, 380, 1010, 260, 1280, 310);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.map2;
    ctx.beginPath();
    ctx.moveTo(85, 510);
    ctx.bezierCurveTo(245, 420, 372, 480, 535, 430);
    ctx.bezierCurveTo(695, 382, 832, 470, 1000, 405);
    ctx.bezierCurveTo(1095, 368, 1192, 410, 1278, 390);
    ctx.lineTo(1280, 720);
    ctx.lineTo(68, 720);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function arrow(from, to, progress, color = palette.amber) {
    const x1 = from.x * canvas.width;
    const y1 = from.y * canvas.height;
    const x2 = to.x * canvas.width;
    const y2 = to.y * canvas.height;
    const eased = 1 - Math.pow(1 - progress, 3);
    const xm = x1 + (x2 - x1) * eased;
    const ym = y1 + (y2 - y1) * eased;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 90, xm, ym);
    ctx.stroke();
    ctx.translate(xm, ym);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-24, -13);
    ctx.lineTo(-18, 0);
    ctx.lineTo(-24, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function unit(x, y, label, color, shape = "rect") {
    const px = x * canvas.width;
    const py = y * canvas.height;
    ctx.save();
    ctx.fillStyle = "rgba(8, 9, 8, 0.72)";
    roundedRect(px - 50, py - 26, 100, 52, 8);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    roundedRect(px - 50, py - 26, 100, 52, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    if (shape === "plane") {
      ctx.beginPath();
      ctx.moveTo(px + 21, py);
      ctx.lineTo(px - 24, py - 15);
      ctx.lineTo(px - 15, py);
      ctx.lineTo(px - 24, py + 15);
      ctx.closePath();
      ctx.fill();
    } else if (shape === "ship") {
      ctx.beginPath();
      ctx.moveTo(px - 24, py + 8);
      ctx.lineTo(px + 22, py + 8);
      ctx.lineTo(px + 10, py + 20);
      ctx.lineTo(px - 16, py + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(px - 6, py - 10, 20, 16);
    } else if (shape === "radar") {
      ctx.beginPath();
      ctx.arc(px, py + 4, 18, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py + 4);
      ctx.lineTo(px + 22, py - 16);
      ctx.stroke();
    } else {
      ctx.fillRect(px - 22, py - 10, 44, 20);
      ctx.fillRect(px - 8, py - 20, 22, 10);
    }
    ctx.fillStyle = palette.text;
    ctx.font = "700 18px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, px, py + 46);
    ctx.restore();
  }

  function radar(cx, cy, progress) {
    const px = cx * canvas.width;
    const py = cy * canvas.height;
    ctx.save();
    ctx.strokeStyle = palette.green;
    ctx.lineWidth = 3;
    for (let i = 1; i <= 4; i += 1) {
      ctx.globalAlpha = 0.16 + i * 0.08;
      ctx.beginPath();
      ctx.arc(px, py, i * 42, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.86;
    ctx.translate(px, py);
    ctx.rotate(progress * Math.PI * 2);
    ctx.fillStyle = "rgba(138, 189, 95, 0.26)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 180, -0.08, 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function wrapText(text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = text.split(" ");
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
    lines.slice(0, maxLines).forEach((item, index) => {
      ctx.fillText(item, x, y + index * lineHeight);
    });
  }

  function keywords(text, count = 5) {
    return text
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 4)
      .slice(0, count);
  }

  function centerText(text, y, size = 64, maxWidth = 980, maxLines = 3) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = palette.text;
    ctx.font = `900 ${size}px Segoe UI, sans-serif`;
    const words = text.split(" ");
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
    lines.slice(0, maxLines).forEach((item, index) => {
      ctx.fillText(item, canvas.width / 2, y + index * size * 1.08);
    });
    ctx.restore();
  }

  function blackHook(beat, progress, accent) {
    ctx.fillStyle = "#050604";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, canvas.width * progress, 8);
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.arc(640, 360, 90 + i * 70 + progress * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    centerText(beat.text.replace(/^I will be talking about this:\s*/i, ""), 248, 62, 1040, 4);
    ctx.fillStyle = palette.muted;
    ctx.font = "800 22px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SEVAL EXPLAINER", 640, 506);
    ctx.textAlign = "left";
  }

  function explainPanel(beat, progress, accent) {
    map();
    ctx.fillStyle = "rgba(8, 9, 8, 0.78)";
    roundedRect(84, 128, 1112, 390, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    roundedRect(84, 128, 1112, 390, 8);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = "900 34px Segoe UI, sans-serif";
    ctx.fillText("THE IDEA", 126, 194);
    ctx.fillStyle = palette.text;
    ctx.font = "900 50px Segoe UI, sans-serif";
    wrapText(beat.text, 126, 270, 720, 58, 4);
    arrow({ x: 0.71, y: 0.35 }, { x: 0.88, y: 0.35 + Math.sin(progress * Math.PI) * 0.08 }, progress, accent);
    unit(0.79, 0.5, "FOCUS", accent, "radar");
  }

  function chartScene(beat, progress, accent) {
    ctx.fillStyle = "#090a08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.text;
    ctx.font = "900 42px Segoe UI, sans-serif";
    wrapText(beat.text, 84, 96, 980, 48, 2);
    const labels = keywords(beat.text, 5);
    const values = [0.42, 0.68, 0.54, 0.86, 0.63];
    ctx.strokeStyle = "rgba(242,241,232,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(140, 580);
    ctx.lineTo(1120, 580);
    ctx.lineTo(1120, 230);
    ctx.stroke();
    labels.forEach((label, i) => {
      const x = 180 + i * 178;
      const h = 280 * values[i] * progress;
      ctx.fillStyle = i % 2 ? palette.amber : accent;
      roundedRect(x, 580 - h, 96, h, 8);
      ctx.fill();
      ctx.fillStyle = palette.muted;
      ctx.font = "800 16px Segoe UI, sans-serif";
      ctx.fillText(label.toUpperCase(), x - 12, 620);
    });
  }

  function timelineScene(beat, progress, accent) {
    ctx.fillStyle = "#070807";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    centerText("Timeline", 96, 48, 900, 1);
    ctx.strokeStyle = "rgba(242,241,232,0.22)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(160, 360);
    ctx.lineTo(1120, 360);
    ctx.stroke();
    const words = keywords(beat.text, 5);
    for (let i = 0; i < 5; i += 1) {
      const x = 180 + i * 220;
      const on = progress >= i / 5;
      ctx.fillStyle = on ? accent : "#30352e";
      ctx.beginPath();
      ctx.arc(x, 360, on ? 24 : 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.text;
      ctx.font = "900 24px Segoe UI, sans-serif";
      ctx.fillText(`0${i + 1}`, x - 16, 330);
      ctx.fillStyle = palette.muted;
      ctx.font = "700 18px Segoe UI, sans-serif";
      wrapText(words[i] || "beat", x - 70, 415, 150, 22, 2);
    }
  }

  function comparisonScene(beat, progress, accent) {
    ctx.fillStyle = "#080908";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.text;
    ctx.font = "900 44px Segoe UI, sans-serif";
    wrapText(beat.text, 86, 96, 1100, 50, 2);
    const cards = [
      { x: 110, title: "Option A", color: accent },
      { x: 690, title: "Option B", color: palette.amber }
    ];
    for (const card of cards) {
      ctx.fillStyle = "rgba(242,241,232,0.06)";
      roundedRect(card.x, 230, 480, 310, 8);
      ctx.fill();
      ctx.strokeStyle = card.color;
      roundedRect(card.x, 230, 480, 310, 8);
      ctx.stroke();
      ctx.fillStyle = card.color;
      ctx.font = "900 34px Segoe UI, sans-serif";
      ctx.fillText(card.title, card.x + 34, 292);
      for (let i = 0; i < 3; i += 1) {
        const w = 310 * progress * (0.65 + i * 0.14);
        ctx.fillStyle = i % 2 ? palette.muted : card.color;
        roundedRect(card.x + 42, 350 + i * 48, w, 16, 8);
        ctx.fill();
      }
    }
  }

  function stepsScene(beat, progress, accent) {
    ctx.fillStyle = "#0b0d0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = palette.text;
    ctx.font = "900 42px Segoe UI, sans-serif";
    wrapText(beat.text, 80, 92, 1040, 48, 2);
    const words = keywords(beat.text, 4);
    for (let i = 0; i < 4; i += 1) {
      const x = 95 + i * 292;
      const y = 300 + Math.sin(progress * Math.PI + i) * 10;
      ctx.globalAlpha = progress >= i / 4 ? 1 : 0.36;
      ctx.fillStyle = "rgba(242,241,232,0.07)";
      roundedRect(x, y, 230, 188, 8);
      ctx.fill();
      ctx.strokeStyle = i % 2 ? palette.amber : accent;
      roundedRect(x, y, 230, 188, 8);
      ctx.stroke();
      ctx.fillStyle = i % 2 ? palette.amber : accent;
      ctx.font = "900 42px Segoe UI, sans-serif";
      ctx.fillText(String(i + 1).padStart(2, "0"), x + 24, y + 58);
      ctx.fillStyle = palette.text;
      ctx.font = "900 24px Segoe UI, sans-serif";
      wrapText(words[i] || "Action", x + 24, y + 112, 170, 28, 2);
      ctx.globalAlpha = 1;
    }
  }

  function codeScene(beat, progress, accent) {
    ctx.fillStyle = "#060706";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(242,241,232,0.07)";
    roundedRect(120, 112, 1040, 500, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    roundedRect(120, 112, 1040, 500, 8);
    ctx.stroke();
    ctx.fillStyle = "#151a14";
    roundedRect(120, 112, 1040, 46, 8);
    ctx.fill();
    ctx.fillStyle = palette.red;
    ctx.beginPath();
    ctx.arc(152, 135, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.amber;
    ctx.beginPath();
    ctx.arc(176, 135, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(200, 135, 7, 0, Math.PI * 2);
    ctx.fill();
    const lines = [
      "const idea = script.nextBeat();",
      "const visual = autoPick(idea);",
      "timeline.add({ voice, clip, captions });",
      "render.toCanvas().export('mp4');"
    ];
    ctx.font = "800 30px Consolas, monospace";
    lines.forEach((line, i) => {
      ctx.fillStyle = i / lines.length < progress ? palette.text : "rgba(242,241,232,0.26)";
      ctx.fillText(line, 168, 230 + i * 70);
    });
    ctx.fillStyle = accent;
    ctx.font = "900 28px Segoe UI, sans-serif";
    wrapText(beat.text, 168, 535, 880, 34, 2);
  }

  function quoteScene(beat, progress, accent) {
    ctx.fillStyle = "#090a08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.font = "900 120px Georgia, serif";
    ctx.fillText('"', 120, 210);
    ctx.fillStyle = palette.text;
    ctx.font = "900 54px Segoe UI, sans-serif";
    wrapText(beat.text, 180, 240, 900, 62, 4);
    ctx.fillStyle = palette.muted;
    ctx.font = "800 22px Segoe UI, sans-serif";
    ctx.fillText("Context line", 184, 560 + progress * 10);
  }

  function summaryScene(beat, progress, accent) {
    ctx.fillStyle = "#060706";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    centerText("Takeaway", 105, 52, 900, 1);
    ctx.fillStyle = "rgba(242,241,232,0.07)";
    roundedRect(164, 232, 952, 270, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    roundedRect(164, 232, 952, 270, 8);
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.font = "900 44px Segoe UI, sans-serif";
    wrapText(beat.text, 220, 320, 840, 52, 3);
    ctx.fillStyle = accent;
    ctx.fillRect(220, 468, 840 * progress, 8);
  }

  function htmlScene(beat, progress, accent) {
    const custom = beat.htmlScene || {};
    const title = custom.title || beat.text;
    const badge = custom.badge || "<section class='scene'>";
    const lines = Array.isArray(custom.lines) ? custom.lines.slice(0, 5) : [];
    ctx.fillStyle = "#070807";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(120 + Math.sin(progress * Math.PI * 2) * 10, 130);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundedRect(0, 0, 1040, 460, 8);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.fillStyle = "#11160f";
    roundedRect(34, 36, 972, 86, 8);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = "900 30px Segoe UI, sans-serif";
    ctx.fillText(badge, 62, 90);
    ctx.fillStyle = palette.text;
    ctx.font = "900 48px Segoe UI, sans-serif";
    wrapText(title, 62, 205, 870, 56, 2);
    ctx.font = "800 26px Segoe UI, sans-serif";
    lines.forEach((line, index) => {
      const y = 350 + index * 42;
      ctx.globalAlpha = progress >= index / Math.max(1, lines.length) ? 1 : 0.28;
      ctx.fillStyle = index % 2 ? palette.amber : palette.text;
      ctx.fillText(line, 82, y);
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.amber;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(62, 390);
    ctx.bezierCurveTo(300, 320, 520, 450, 860, 360);
    ctx.stroke();
    ctx.restore();
  }

  function drawStock(video, beat, progress) {
    if (video?.readyState >= 2) {
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight) * (1.02 + progress * 0.04);
      const w = video.videoWidth * scale;
      const h = video.videoHeight * scale;
      const x = (canvas.width - w) / 2 + Math.sin(progress * Math.PI * 2) * 14;
      const y = (canvas.height - h) / 2;
      ctx.drawImage(video, x, y, w, h);
      ctx.fillStyle = "rgba(8, 9, 8, 0.22)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    map();
    unit(beat.from.x, beat.from.y, "CLIP", palette.blue, "rect");
    arrow(beat.from, beat.to, progress, palette.green);
  }

  function generated(beat, progress, time) {
    const accent = palette.accent || palette.green;
    if (beat.visual === "hook") {
      blackHook(beat, progress, accent);
      return;
    }
    if (beat.visual === "imageText" || beat.visual === "arrowExplain") {
      explainPanel(beat, progress, accent);
      return;
    }
    if (beat.visual === "chart") {
      chartScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "timeline") {
      timelineScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "comparison") {
      comparisonScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "steps") {
      stepsScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "code" || beat.visual === "diagram") {
      codeScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "quote") {
      quoteScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "summary") {
      summaryScene(beat, progress, accent);
      return;
    }
    if (beat.visual === "html") {
      htmlScene(beat, progress, accent);
      return;
    }

    map();
    if (beat.visual === "radar") {
      radar(0.32, 0.42, time * 0.22);
      unit(beat.to.x, beat.to.y, "TRACK", palette.red, "plane");
      arrow(beat.from, beat.to, progress, accent);
    } else if (beat.visual === "air") {
      unit(beat.from.x, beat.from.y, "BLUE", palette.blue, "plane");
      unit(beat.to.x, beat.to.y, "RED", palette.red, "plane");
      arrow(beat.from, beat.to, progress, palette.blue);
    } else if (beat.visual === "naval") {
      unit(0.18, 0.34, "FLEET", palette.blue, "ship");
      unit(0.78, 0.41, "COAST", palette.amber, "radar");
      arrow({ x: 0.2, y: 0.34 }, { x: 0.76, y: 0.4 }, progress, palette.amber);
    } else if (beat.visual === "missile") {
      unit(beat.from.x, beat.from.y, "LAUNCH", palette.red, "radar");
      unit(beat.to.x, beat.to.y, "ZONE", palette.amber, "rect");
      arrow(beat.from, beat.to, progress, palette.red);
    } else if (beat.visual === "intel") {
      ctx.fillStyle = "rgba(8, 9, 8, 0.72)";
      roundedRect(132, 152, 1016, 330, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(138, 189, 95, 0.46)";
      roundedRect(132, 152, 1016, 330, 8);
      ctx.stroke();
      ctx.fillStyle = palette.green;
      ctx.font = "900 34px Segoe UI, sans-serif";
      ctx.fillText("INTEL TIMELINE", 174, 214);
      for (let i = 0; i < 5; i += 1) {
        const x = 190 + i * 190;
        const y = 292 + Math.sin(time + i) * 12;
        ctx.fillStyle = i / 4 <= progress ? palette.amber : "rgba(242, 241, 232, 0.22)";
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 20, y - 3, 110, 6);
      }
    } else {
      unit(beat.from.x, beat.from.y, "MOVE", palette.blue, "rect");
      unit(beat.to.x, beat.to.y, "ZONE", palette.amber, "rect");
      arrow(beat.from, beat.to, progress, palette.green);
    }
  }

  function lowerThird(beat, progress, captionKey = "documentary") {
    const preset = captionPresets[captionKey] || captionPresets.documentary;
    const alpha = clamp(progress / 0.18, 0, 1) * clamp((1 - progress) / 0.08, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const isCenter = preset.position === "center";
    const x = isCenter ? 130 : 64;
    const y = isCenter ? 284 : preset.position === "bottom" ? 610 : 548;
    const w = isCenter ? 1020 : 1152;
    const h = isCenter ? 156 : preset.position === "bottom" ? 74 : 124;
    if (preset.box) {
      ctx.fillStyle = "rgba(8, 9, 8, 0.78)";
      roundedRect(x, y, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(229, 185, 91, 0.55)";
      ctx.lineWidth = 2;
      roundedRect(x, y, w, h, 8);
      ctx.stroke();
    }
    ctx.fillStyle = palette.accent || palette.amber;
    ctx.font = "800 18px Segoe UI, sans-serif";
    if (!isCenter) ctx.fillText(`BEAT ${beat.index + 1}`, x + 28, y + 36);
    ctx.fillStyle = palette.text;
    const weight = preset.weight === "black" ? 900 : preset.weight === "medium" ? 600 : 800;
    ctx.font = `${weight} ${isCenter ? 42 : 29}px Segoe UI, sans-serif`;
    if (isCenter) {
      ctx.textAlign = "center";
      wrapText(beat.text, canvas.width / 2, y + 58, 900, 48, 2);
      ctx.textAlign = "left";
    } else {
      wrapText(beat.text, x + 28, y + (preset.position === "bottom" ? 45 : 72), 1060, 33, 3);
    }
    if (beat.media?.title) {
      ctx.fillStyle = palette.muted;
      ctx.font = "700 16px Segoe UI, sans-serif";
      wrapText(`${beat.media.source}: ${beat.media.title}`, x + 28, y + h - 16, 900, 20, 1);
    }
    ctx.restore();
  }

  function header(beat, time, duration) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 9, 8, 0.66)";
    roundedRect(46, 34, 1188, 58, 8);
    ctx.fill();
    ctx.fillStyle = palette.text;
    ctx.font = "900 28px Segoe UI, sans-serif";
    ctx.fillText("SEVAL // PUBLIC FOOTAGE EXPLAINER", 70, 72);
    ctx.fillStyle = palette.muted;
    ctx.font = "700 18px Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${formatTime(time)} / ${formatTime(duration)}`, 1208, 71);
    ctx.textAlign = "left";
    ctx.fillStyle = palette.amber;
    ctx.fillRect(70, 84, 420 * ((time % 6) / 6), 4);
    ctx.fillStyle = palette.green;
    ctx.fillText(beat?.media ? "PUBLIC CLIP" : (beat?.visual || "READY").toUpperCase(), 70, 118);
    ctx.restore();
  }

  function drawFrame(beats, time = 0, videoPool = new Map(), options = {}) {
    palette.accent = options.accent || palette.green;
    const duration = totalDuration(beats) || 1;
    const safeTime = clamp(time, 0, duration);
    const beat = activeBeatAt(beats, safeTime);
    const progress = beat ? clamp((safeTime - beat.start) / Math.max(0.1, beat.duration), 0, 1) : 0;
    grid(safeTime);
    if (beat?.media?.previewUrl && (beat.visual === "stock" || beat.visual === "auto")) {
      drawStock(videoPool.get(beat.media.previewUrl), beat, progress);
    } else if (beat) {
      generated(beat, progress, safeTime);
    }
    header(beat, safeTime, duration);
    if (beat) lowerThird(beat, progress, options.caption);
    hooks.onFrame?.(beat, safeTime, duration);
  }

  return { drawFrame };
}
