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
        title: "I will be talking about this:",
        body: "Chicken nuggets.",
        narration:
          "I will be talking about this: chicken nuggets. They look simple, but there is a surprisingly good explainer hiding inside that crispy little bite."
      },
      {
        kind: "steps",
        title: "The Basic Idea",
        body: "Chicken, coating, heat, crunch.",
        narration:
          "A nugget is basically a small piece of chicken with a seasoned coating. The magic happens when heat turns that coating into a crunchy shell."
      },
      {
        kind: "arrows",
        title: "Why They Crunch",
        body: "Steam pushes out. The coating dries. The outside gets crisp.",
        narration:
          "As it cooks, steam moves outward while the breading dries and browns. That is why the outside snaps before the inside does."
      },
      {
        kind: "chart",
        title: "Why People Like Them",
        body: "Fast, salty, crunchy, dip-friendly.",
        narration:
          "Nuggets work because they are fast, salty, crunchy, and easy to dip. That combination is almost engineered for snack cravings."
      },
      {
        kind: "summary",
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
  const title = `drawtext=fontfile='${font}':textfile='${ffPath(titlePath)}':fontcolor=white:fontsize=58:x=82:y=88`;
  const body = `drawtext=fontfile='${font}':textfile='${ffPath(bodyPath)}':fontcolor=white:fontsize=42:x=82:y=500:line_spacing=14`;
  const brand = `drawtext=fontfile='${font}':text='SEVAL EXPLAINER':fontcolor=0xe5b95b:fontsize=24:x=82:y=48`;
  const captionBox = "drawbox=x=64:y=478:w=1152:h=166:color=black@0.58:t=fill";
  const base = [brand, title, captionBox, body];

  if (scene.kind === "hook") {
    return [
      "drawbox=x=0:y=0:w=1280:h=12:color=0x8abd5f:t=fill",
      "drawbox=x=140:y=250:w=1000:h=6:color=0xe5b95b@0.8:t=fill",
      ...base
    ].join(",");
  }

  if (scene.kind === "steps") {
    return [
      ...base,
      "drawbox=x=100:y=230:w=250:h=140:color=0x8abd5f@0.35:t=fill",
      "drawbox=x=395:y=230:w=250:h=140:color=0xe5b95b@0.35:t=fill",
      "drawbox=x=690:y=230:w=250:h=140:color=0x64a6d9@0.35:t=fill",
      "drawbox=x=985:y=230:w=180:h=140:color=0xd65a4a@0.35:t=fill",
      `drawtext=fontfile='${font}':text='1 Chicken':fontcolor=white:fontsize=30:x=132:y=286`,
      `drawtext=fontfile='${font}':text='2 Coating':fontcolor=white:fontsize=30:x=428:y=286`,
      `drawtext=fontfile='${font}':text='3 Heat':fontcolor=white:fontsize=30:x=734:y=286`,
      `drawtext=fontfile='${font}':text='4 Crunch':fontcolor=white:fontsize=30:x=1010:y=286`
    ].join(",");
  }

  if (scene.kind === "arrows") {
    return [
      ...base,
      "drawbox=x=130:y=235:w=210:h=110:color=0xe5b95b@0.55:t=fill",
      "drawbox=x=535:y=235:w=210:h=110:color=0x8abd5f@0.55:t=fill",
      "drawbox=x=940:y=235:w=210:h=110:color=0x64a6d9@0.55:t=fill",
      "drawbox=x=350:y=283:w=170:h=12:color=white@0.85:t=fill",
      "drawbox=x=755:y=283:w=170:h=12:color=white@0.85:t=fill",
      `drawtext=fontfile='${font}':text='Steam':fontcolor=black:fontsize=34:x=180:y=274`,
      `drawtext=fontfile='${font}':text='Dry':fontcolor=black:fontsize=34:x=604:y=274`,
      `drawtext=fontfile='${font}':text='Crisp':fontcolor=black:fontsize=34:x=1004:y=274`
    ].join(",");
  }

  if (scene.kind === "chart") {
    return [
      ...base,
      "drawbox=x=155:y=388:w=110:h=58:color=0x8abd5f:t=fill",
      "drawbox=x=355:y=330:w=110:h=116:color=0xe5b95b:t=fill",
      "drawbox=x=555:y=270:w=110:h=176:color=0x64a6d9:t=fill",
      "drawbox=x=755:y=230:w=110:h=216:color=0xd65a4a:t=fill",
      "drawbox=x=955:y=300:w=110:h=146:color=0xa08cf0:t=fill",
      `drawtext=fontfile='${font}':text='Fast':fontcolor=white:fontsize=24:x=158:y=456`,
      `drawtext=fontfile='${font}':text='Salty':fontcolor=white:fontsize=24:x=357:y=456`,
      `drawtext=fontfile='${font}':text='Crunch':fontcolor=white:fontsize=24:x=552:y=456`,
      `drawtext=fontfile='${font}':text='Dip':fontcolor=white:fontsize=24:x=788:y=456`,
      `drawtext=fontfile='${font}':text='Fun':fontcolor=white:fontsize=24:x=990:y=456`
    ].join(",");
  }

  return [
    ...base,
    "drawbox=x=120:y=215:w=1040:h=210:color=0x8abd5f@0.16:t=fill",
    "drawbox=x=120:y=215:w=1040:h=6:color=0x8abd5f:t=fill"
  ].join(",");
}

async function renderScene(scene, sceneDir, index, voice) {
  const wavPath = await speak(scene, sceneDir, index, voice);
  const dur = await duration(wavPath);
  const { titlePath, bodyPath } = await sceneTextFiles(scene, sceneDir, index);
  const outPath = join(sceneDir, `scene-${index}.mp4`);
  const filter = visualFilters(scene, titlePath, bodyPath);

  await run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${colorFor(scene.kind)}:s=1280x720:r=30:d=${dur.toFixed(3)}`,
    "-i",
    wavPath,
    "-vf",
    filter,
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
  ]);
  return outPath;
}

async function concatScenes(scenePaths, sceneDir, outputPath) {
  const listPath = join(sceneDir, "concat.txt");
  await writeFile(
    listPath,
    scenePaths.map((path) => `file '${path.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"),
    "utf8"
  );
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
  for (let i = 0; i < topic.scenes.length; i += 1) {
    scenePaths.push(await renderScene(topic.scenes[i], sceneDir, i + 1, topic.voice));
  }

  const finalPath = join(outRoot, topic.output);
  await concatScenes(scenePaths, sceneDir, finalPath);
  await writeFile(
    join(outRoot, `${topic.slug}-source-report.txt`),
    [
      "Seval sample source report",
      `Video: ${topic.output}`,
      "Visuals: Native Seval FFmpeg scene renderer",
      "Narration: Windows local text-to-speech",
      "Music: None, narration-only sample",
      "Topic: Chicken nuggets"
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
