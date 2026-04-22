import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const outRoot = join(root, ".seval", "renders");
const font = "C\\:/Windows/Fonts/arial.ttf";

const topics = {
  "chicken-nuggets": {
    slug: "chicken-nuggets",
    name: "Chicken Nuggets",
    output: "seval-chicken-nuggets.mp4",
    voice: "Microsoft David Desktop",
    scenes: [
      {
        kind: "hook",
        imageQuery: "chicken nuggets",
        title: "I will be talking about this:",
        body: "Chicken nuggets.",
        narration:
          "I will be talking about this: chicken nuggets. They look simple, but there is a surprisingly good explainer hiding inside that crispy little bite."
      },
      {
        kind: "steps",
        imageQuery: "chicken nuggets sauce",
        title: "The Basic Idea",
        body: "Chicken, coating, heat, crunch.",
        narration:
          "A nugget is basically a small piece of chicken with a seasoned coating. The magic happens when heat turns that coating into a crunchy shell."
      },
      {
        kind: "arrows",
        imageQuery: "fried chicken nuggets",
        title: "Why They Crunch",
        body: "Steam pushes out. The coating dries. The outside gets crisp.",
        narration:
          "As it cooks, steam moves outward while the breading dries and browns. That is why the outside snaps before the inside does."
      },
      {
        kind: "chart",
        imageQuery: "chicken nuggets meal",
        title: "Why People Like Them",
        body: "Fast, salty, crunchy, dip-friendly.",
        narration:
          "Nuggets work because they are fast, salty, crunchy, and easy to dip. That combination is almost engineered for snack cravings."
      },
      {
        kind: "summary",
        imageQuery: "chicken nuggets",
        title: "The Takeaway",
        body: "A tiny food with a full story: texture, timing, and sauce.",
        narration:
          "So the takeaway is simple: chicken nuggets are not just random bites. They are a tiny food story about texture, timing, seasoning, and sauce."
      }
    ]
  }
};

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true,
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${command} exited ${code}\n${stderr || stdout}`));
    });
  });
}

function ffPath(path) {
  const normalized = resolve(path).replace(/\\/g, "/");
  return normalized.replace(/^([A-Za-z]):/, (_match, drive) => `${drive}\\:`);
}

function colorFor(kind) {
  return {
    hook: "0x050505",
    steps: "0x11160f",
    arrows: "0x0d1214",
    chart: "0x0d0f12",
    summary: "0x080908"
  }[kind] || "0x080908";
}

function extensionForMime(mime = "") {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function searchCommonsImage(query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `filetype:image ${query}`);
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Seval sample renderer",
      Accept: "application/json"
    }
  });
  if (!response.ok) return null;
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !String(info.mime || "").startsWith("image/")) continue;
    return {
      url: info.url,
      title: String(page.title || "").replace(/^File:/, ""),
      mime: info.mime,
      credit: info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, "") || "Wikimedia Commons contributor",
      license: info.extmetadata?.LicenseShortName?.value || "Commons license",
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title || "").replaceAll(" ", "_"))}`
    };
  }
  return null;
}

async function downloadImage(image, sceneDir, index) {
  if (!image?.url) return null;
  const response = await fetch(image.url, { headers: { "User-Agent": "Seval sample renderer" } });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const outPath = join(sceneDir, `scene-${index}-image.${extensionForMime(image.mime)}`);
  await writeFile(outPath, buffer);
  return outPath;
}

async function duration(path) {
  const result = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path
  ]);
  return Math.max(2.8, Number(result.stdout.trim()) + 0.3);
}

async function speak(scene, sceneDir, index, voice) {
  const textPath = join(sceneDir, `scene-${index}-narration.txt`);
  const wavPath = join(sceneDir, `scene-${index}-voice.wav`);
  await writeFile(textPath, scene.narration, "utf8");
  await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(root, "tools", "speak.ps1"),
    "-TextPath",
    textPath,
    "-OutPath",
    wavPath,
    "-Rate",
    "1",
    "-Voice",
    voice
  ]);
  return wavPath;
}

async function sceneTextFiles(scene, sceneDir, index) {
  const titlePath = join(sceneDir, `scene-${index}-title.txt`);
  const bodyPath = join(sceneDir, `scene-${index}-body.txt`);
  await writeFile(titlePath, scene.title, "utf8");
  await writeFile(bodyPath, scene.body, "utf8");
  return { titlePath, bodyPath };
}

function visualFilters(scene, titlePath, bodyPath) {
  const titleX = "82-34*lt(t\\,0.55)*(1-t/0.55)";
  const bodyY = "500+28*lt(t\\,0.55)*(1-t/0.55)";
  const title = `drawtext=fontfile='${font}':textfile='${ffPath(titlePath)}':fontcolor=white:fontsize=58:x='${titleX}':y=88:alpha='min(1,t/0.45)'`;
  const body = `drawtext=fontfile='${font}':textfile='${ffPath(bodyPath)}':fontcolor=white:fontsize=42:x=82:y='${bodyY}':line_spacing=14:alpha='min(1,t/0.55)'`;
  const brand = `drawtext=fontfile='${font}':text='SEVAL EXPLAINER':fontcolor=0xe5b95b:fontsize=24:x=82:y=48:alpha='0.72+0.2*sin(t*3)'`;
  const captionBox = "drawbox=x=64:y=478:w=1152:h=166:color=black@0.56:t=fill";
  const motionGrid = [
    "drawgrid=width=80:height=80:thickness=1:color=white@0.055",
    "drawbox=x='-220+mod(t*90\\,1500)':y=0:w=160:h=720:color=white@0.035:t=fill",
    "drawbox=x=0:y='mod(t*44\\,760)-40':w=1280:h=3:color=0xe5b95b@0.24:t=fill"
  ];
  const base = [brand, title, captionBox, body];

  if (scene.kind === "hook") {
    return [
      ...motionGrid,
      "drawbox=x=0:y=0:w=1280:h=12:color=0x8abd5f:t=fill",
      "drawbox=x=140:y=250:w='1000*min(1,t/1.1)':h=6:color=0xe5b95b@0.8:t=fill",
      "drawbox=x='590+sin(t*2.7)*28':y=310:w=100:h=100:color=0xe5b95b@0.24:t=fill",
      "drawbox=x='630+cos(t*2.1)*32':y=338:w=165:h=48:color=0x8abd5f@0.20:t=fill",
      ...base
    ].join(",");
  }

  if (scene.kind === "steps") {
    return [
      ...motionGrid,
      ...base,
      "drawbox=x='100-70*lt(t\\,0.6)*(1-t/0.6)':y=230:w=250:h=140:color=0x8abd5f@0.42:t=fill",
      "drawbox=x='395-70*lt(t\\,0.85)*(1-t/0.85)':y=230:w=250:h=140:color=0xe5b95b@0.42:t=fill",
      "drawbox=x='690-70*lt(t\\,1.1)*(1-t/1.1)':y=230:w=250:h=140:color=0x64a6d9@0.42:t=fill",
      "drawbox=x='985-70*lt(t\\,1.35)*(1-t/1.35)':y=230:w=180:h=140:color=0xd65a4a@0.42:t=fill",
      `drawtext=fontfile='${font}':text='1 Chicken':fontcolor=white:fontsize=30:x=132:y='286+sin(t*3)*3'`,
      `drawtext=fontfile='${font}':text='2 Coating':fontcolor=white:fontsize=30:x=428:y='286+sin(t*3+1)*3'`,
      `drawtext=fontfile='${font}':text='3 Heat':fontcolor=white:fontsize=30:x=734:y='286+sin(t*3+2)*3'`,
      `drawtext=fontfile='${font}':text='4 Crunch':fontcolor=white:fontsize=30:x=1010:y='286+sin(t*3+3)*3'`
    ].join(",");
  }

  if (scene.kind === "arrows") {
    return [
      ...motionGrid,
      ...base,
      "drawbox=x=130:y='235+sin(t*2)*7':w=210:h=110:color=0xe5b95b@0.58:t=fill",
      "drawbox=x=535:y='235+sin(t*2+1.2)*7':w=210:h=110:color=0x8abd5f@0.58:t=fill",
      "drawbox=x=940:y='235+sin(t*2+2.4)*7':w=210:h=110:color=0x64a6d9@0.58:t=fill",
      "drawbox=x=350:y=283:w='170*min(1,t/0.8)':h=12:color=white@0.85:t=fill",
      "drawbox=x=755:y=283:w='170*min(1,max(0,t-0.45)/0.8)':h=12:color=white@0.85:t=fill",
      `drawtext=fontfile='${font}':text='Steam':fontcolor=black:fontsize=34:x=180:y=274`,
      `drawtext=fontfile='${font}':text='Dry':fontcolor=black:fontsize=34:x=604:y=274`,
      `drawtext=fontfile='${font}':text='Crisp':fontcolor=black:fontsize=34:x=1004:y=274`
    ].join(",");
  }

  if (scene.kind === "chart") {
    return [
      ...motionGrid,
      ...base,
      "drawbox=x=155:y='446-58*min(1,t/1.0)':w=110:h='58*min(1,t/1.0)':color=0x8abd5f:t=fill",
      "drawbox=x=355:y='446-116*min(1,t/1.2)':w=110:h='116*min(1,t/1.2)':color=0xe5b95b:t=fill",
      "drawbox=x=555:y='446-176*min(1,t/1.4)':w=110:h='176*min(1,t/1.4)':color=0x64a6d9:t=fill",
      "drawbox=x=755:y='446-216*min(1,t/1.6)':w=110:h='216*min(1,t/1.6)':color=0xd65a4a:t=fill",
      "drawbox=x=955:y='446-146*min(1,t/1.8)':w=110:h='146*min(1,t/1.8)':color=0xa08cf0:t=fill",
      `drawtext=fontfile='${font}':text='Fast':fontcolor=white:fontsize=24:x=158:y=456`,
      `drawtext=fontfile='${font}':text='Salty':fontcolor=white:fontsize=24:x=357:y=456`,
      `drawtext=fontfile='${font}':text='Crunch':fontcolor=white:fontsize=24:x=552:y=456`,
      `drawtext=fontfile='${font}':text='Dip':fontcolor=white:fontsize=24:x=788:y=456`,
      `drawtext=fontfile='${font}':text='Fun':fontcolor=white:fontsize=24:x=990:y=456`
    ].join(",");
  }

  return [
    ...motionGrid,
    ...base,
    "drawbox=x=120:y='215+sin(t*1.7)*8':w=1040:h=210:color=0x8abd5f@0.16:t=fill",
    "drawbox=x=120:y=215:w='1040*min(1,t/1.2)':h=6:color=0x8abd5f:t=fill"
  ].join(",");
}

async function makeMusicBed(sceneDir, durationSeconds) {
  const outPath = join(sceneDir, "music-bed.wav");
  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=82:duration=${durationSeconds.toFixed(3)}:sample_rate=44100`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=164:duration=${durationSeconds.toFixed(3)}:sample_rate=44100`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=246:duration=${durationSeconds.toFixed(3)}:sample_rate=44100`,
    "-filter_complex",
    "[0:a]volume=0.12,afade=t=in:st=0:d=1.2,afade=t=out:st=0:d=1.2[a0];[1:a]volume=0.045,atrim=0:999,afade=t=in:st=0:d=1.4[a1];[2:a]volume=0.025,afade=t=in:st=0:d=2[a2];[a0][a1][a2]amix=inputs=3:duration=longest,alimiter=limit=0.45",
    outPath
  ]);
  return outPath;
}

async function renderScene(scene, sceneDir, index, voice, imagePath = null) {
  const wavPath = await speak(scene, sceneDir, index, voice);
  const dur = await duration(wavPath);
  const { titlePath, bodyPath } = await sceneTextFiles(scene, sceneDir, index);
  const outPath = join(sceneDir, `scene-${index}.mp4`);
  const filter = visualFilters(scene, titlePath, bodyPath);

  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${colorFor(scene.kind)}:s=1280x720:r=30:d=${dur.toFixed(3)}`
  ];
  if (imagePath) {
    args.push("-loop", "1", "-i", imagePath);
  }
  args.push("-i", wavPath);
  if (imagePath) {
    const audioIndex = 2;
    args.push(
      "-filter_complex",
      `[1:v]scale=1480:-1,crop=1280:720:(iw-1280)/2:(ih-720)/2,format=rgba,colorchannelmixer=aa=0.58[photo];[0:v][photo]overlay=x='-28+28*sin(t*0.5)':y='-10+10*cos(t*0.7)',${filter}[v]`,
      "-map",
      "[v]",
      "-map",
      `${audioIndex}:a`
    );
  } else {
    args.push("-vf", filter);
  }
  args.push(
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    outPath
  );
  await run("ffmpeg", args);
  return outPath;
}

async function concatScenes(scenePaths, sceneDir, outputPath) {
  const listPath = join(sceneDir, "concat.txt");
  await writeFile(
    listPath,
    scenePaths.map((path) => `file '${path.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
  const noMusicPath = join(sceneDir, "no-music.mp4");
  await run("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    noMusicPath
  ]);
  const dur = Number((await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    noMusicPath
  ])).stdout.trim());
  const musicPath = await makeMusicBed(sceneDir, dur);
  await run("ffmpeg", [
    "-y",
    "-i",
    noMusicPath,
    "-i",
    musicPath,
    "-filter_complex",
    "[0:a]volume=1.0[a0];[1:a]volume=0.32[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[aout]",
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath
  ]);
}

async function main() {
  const key = process.argv[2] || "chicken-nuggets";
  const topic = topics[key];
  if (!topic) {
    throw new Error(`Unknown sample topic: ${key}`);
  }

  const sceneDir = join(outRoot, `${topic.slug}-${randomUUID().slice(0, 8)}`);
  await mkdir(sceneDir, { recursive: true });
  const scenePaths = [];
  const sourceLines = [];
  for (let i = 0; i < topic.scenes.length; i += 1) {
    const scene = topic.scenes[i];
    const image = await searchCommonsImage(scene.imageQuery || topic.name).catch(() => null);
    const imagePath = await downloadImage(image, sceneDir, i + 1).catch(() => null);
    if (image) {
      sourceLines.push(
        `${i + 1}. ${image.title}`,
        `   Source: Wikimedia Commons`,
        `   Credit: ${image.credit}`,
        `   License: ${image.license}`,
        `   URL: ${image.pageUrl}`,
        ""
      );
    }
    scenePaths.push(await renderScene(scene, sceneDir, i + 1, topic.voice, imagePath));
  }

  const finalPath = join(outRoot, topic.output);
  await concatScenes(scenePaths, sceneDir, finalPath);
  await writeFile(
    join(outRoot, `${topic.slug}-source-report.txt`),
    [
      "Seval sample source report",
      `Video: ${topic.output}`,
      "Visuals: Native Seval FFmpeg scene renderer",
      "Images: Public Wikimedia Commons images searched per scene",
      "Narration: Windows local text-to-speech",
      "Music: Original generated Seval sine-layer music bed",
      "Animation: FFmpeg expressions for moving panels, kinetic text, chart growth, arrows, and background sweeps",
      "Topic: Chicken nuggets",
      "",
      "Image sources:",
      ...sourceLines
    ].join("\n"),
    "utf8"
  );
  await rm(sceneDir, { recursive: true, force: true });
  console.log(finalPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
