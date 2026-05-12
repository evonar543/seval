import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = "http://127.0.0.1:5177";
const expectedVersion = "0.3.0";

async function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${url}`);
  }
  return response.json();
}

async function ensureServer() {
  try {
    await fetchJson(`${baseUrl}/api/health`);
    const integrations = await fetchJson(`${baseUrl}/api/integrations`).catch(() => null);
    if (integrations?.version === expectedVersion) return null;
    await stopExistingServer();
  } catch {
  }
  const child = spawn("cmd.exe", ["/c", "npm.cmd", "start"], {
    cwd: root,
    windowsHide: true,
    detached: true,
    stdio: "ignore"
  });
  child.unref();
  for (let i = 0; i < 30; i += 1) {
    await wait(1000);
    try {
      await fetchJson(`${baseUrl}/api/health`);
      const integrations = await fetchJson(`${baseUrl}/api/integrations`).catch(() => null);
      if (integrations?.version === expectedVersion) return child.pid;
    } catch {
      continue;
    }
  }
  throw new Error("Seval server did not start in time.");
}

async function stopExistingServer() {
  await new Promise((resolveStop) => {
    const child = spawn("powershell.exe", [
      "-NoProfile",
      "-Command",
      "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*server.mjs*' }; foreach ($proc in $procs) { Stop-Process -Id $proc.ProcessId -Force };"
    ], {
      cwd: root,
      windowsHide: true,
      stdio: "ignore"
    });
    child.on("close", () => resolveStop());
    child.on("error", () => resolveStop());
  });
  await wait(1500);
}

async function main() {
  await ensureServer();

  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"]
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 }
    });
    page.setDefaultTimeout(240000);
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.sevalApp?.renderProjectForAutomation));

    const result = await page.evaluate(async () => {
      return window.sevalApp.renderProjectForAutomation({
        projectName: "Simple Pencil Video",
        filename: "seval-simple-pencil.mp4",
        prompt: "Explain why pencils work, using close-up public images, a clean step layout, and short captions.",
        preset: "explainer",
        style: "explainer",
        length: "short",
        pace: "calm",
        caption: "clean",
        accent: "#89c7ff",
        source: "commons",
        mediaType: "image",
        music: "quiet",
        autoDirect: true,
        autoStock: true
      });
    });

    console.log(JSON.stringify(result, null, 2));
    console.log(resolve(result.saved.path));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
