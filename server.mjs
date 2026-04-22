import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

const root = process.cwd();
const publicRoot = root;
const tmpRoot = join(root, ".seval", "tmp");
const projectRoot = join(root, ".seval", "projects");
const port = Number(process.env.PORT || 5177);
const agent = "Seval/0.1 local public-media builder";
const allowedProxyHosts = new Set([
  "archive.org",
  "cdn.pixabay.com",
  "dvidshub.net",
  "images-assets.nasa.gov",
  "images.pexels.com",
  "static.dvidshub.net",
  "video.dvidshub.net",
  "videos.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org"
]);

const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".mp4", "video/mp4"]
]);

await mkdir(tmpRoot, { recursive: true });
await mkdir(projectRoot, { recursive: true });

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
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(new Error(`${command} exited ${code}\n${stderr || stdout}`));
      }
    });
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function slug(input) {
  return String(input || "seval-project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "seval-project";
}

function projectPath(id) {
  return join(projectRoot, `${slug(id)}.json`);
}

function readBody(req, limit = 300 * 1024 * 1024) {
  return new Promise((resolveRead, rejectRead) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        rejectRead(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveRead(Buffer.concat(chunks)));
    req.on("error", rejectRead);
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": agent,
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function fetchJsonWithHeaders(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": agent,
      Accept: "application/json",
      ...headers
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status}: ${url}`);
  }
  return response.json();
}

function mediaResult(item) {
  const direct = item.source === "Wikimedia Commons";
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    description: item.description || "",
    credit: item.credit || item.source,
    license: item.license || "Check source license",
    pageUrl: item.pageUrl || item.url,
    url: item.url,
    previewUrl: direct ? item.url : `/api/proxy?url=${encodeURIComponent(item.url)}`,
    thumb: item.thumb ? (direct ? item.thumb : `/api/proxy?url=${encodeURIComponent(item.thumb)}`) : "",
    mime: item.mime || "video/mp4"
  };
}

function providerKeys(url) {
  return {
    pexels: String(url.searchParams.get("pexelsKey") || process.env.PEXELS_API_KEY || "").trim(),
    pixabay: String(url.searchParams.get("pixabayKey") || process.env.PIXABAY_API_KEY || "").trim(),
    dvids: String(url.searchParams.get("dvidsKey") || process.env.DVIDS_API_KEY || "").trim()
  };
}

function rankResults(results, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return [...results].sort((a, b) => {
    const score = (item) => {
      const haystack = `${item.title} ${item.description} ${item.source}`.toLowerCase();
      const termScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 3 : 0), 0);
      const sourceBoost =
        item.source.includes("Pexels") || item.source.includes("Pixabay")
          ? 4
          : item.source.includes("NASA")
            ? 3
            : item.source.includes("Wikimedia")
              ? 2
              : 1;
      return termScore + sourceBoost;
    };
    return score(b) - score(a);
  });
}

async function searchCommons(query, limit = 8) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `filetype:video ${query}`);
  url.searchParams.set("gsrlimit", String(limit * 2));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "640");

  const data = await fetchJson(url);
  const pages = Object.values(data.query?.pages || {});
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || !String(info.mime || "").startsWith("video/")) return null;
      const meta = info.extmetadata || {};
      return mediaResult({
        id: `commons:${page.pageid}`,
        source: "Wikimedia Commons",
        title: String(page.title || "").replace(/^File:/, ""),
        description: meta.ImageDescription?.value?.replace(/<[^>]*>/g, "") || "",
        credit: meta.Artist?.value?.replace(/<[^>]*>/g, "") || "Wikimedia Commons contributor",
        license: meta.LicenseShortName?.value || "Commons license",
        pageUrl: meta.ObjectName?.value
          ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`
          : `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        url: info.url,
        thumb: info.thumburl || "",
        mime: info.mime
      });
    })
    .filter(Boolean)
    .slice(0, limit);
}

function archiveFileUrl(identifier, name) {
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${name
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function searchArchive(query, limit = 8) {
  const searchUrl = new URL("https://archive.org/advancedsearch.php");
  searchUrl.searchParams.set("q", `(${query}) AND mediatype:movies`);
  searchUrl.searchParams.append("fl[]", "identifier");
  searchUrl.searchParams.append("fl[]", "title");
  searchUrl.searchParams.append("fl[]", "description");
  searchUrl.searchParams.append("fl[]", "licenseurl");
  searchUrl.searchParams.set("rows", String(limit));
  searchUrl.searchParams.set("page", "1");
  searchUrl.searchParams.set("output", "json");

  const data = await fetchJson(searchUrl);
  const docs = data.response?.docs || [];
  const results = [];
  for (const doc of docs) {
    if (!doc.identifier) continue;
    try {
      const meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
      const files = meta.files || [];
      const file =
        files.find((entry) => entry.format === "MPEG4" && /\.mp4$/i.test(entry.name || "")) ||
        files.find((entry) => /\.mp4$/i.test(entry.name || "")) ||
        files.find((entry) => /\.(webm|ogv|ogg)$/i.test(entry.name || ""));
      if (!file?.name) continue;
      results.push(
        mediaResult({
          id: `archive:${doc.identifier}:${file.name}`,
          source: "Internet Archive",
          title: doc.title || meta.metadata?.title || doc.identifier,
          description: String(doc.description || meta.metadata?.description || "").replace(/<[^>]*>/g, ""),
          credit: meta.metadata?.creator || "Internet Archive contributor",
          license: doc.licenseurl || meta.metadata?.licenseurl || "Check archive item rights",
          pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
          url: archiveFileUrl(doc.identifier, file.name),
          thumb: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
          mime: /\.webm$/i.test(file.name) ? "video/webm" : /\.ogv|\.ogg$/i.test(file.name) ? "video/ogg" : "video/mp4"
        })
      );
    } catch {
      continue;
    }
  }
  return results.slice(0, limit);
}

async function searchNasa(query, limit = 8) {
  const searchUrl = new URL("https://images-api.nasa.gov/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("media_type", "video");
  searchUrl.searchParams.set("page_size", String(limit));
  const data = await fetchJson(searchUrl);
  const items = data.collection?.items || [];
  const results = [];

  for (const item of items) {
    const meta = item.data?.[0] || {};
    const links = item.links || [];
    const collectionHref = item.href;
    if (!collectionHref) continue;
    try {
      const files = await fetchJson(collectionHref.replaceAll(" ", "%20"));
      const file =
        files.find((href) => /~medium\.mp4$/i.test(href)) ||
        files.find((href) => /~large\.mp4$/i.test(href)) ||
        files.find((href) => /~small\.mp4$/i.test(href)) ||
        files.find((href) => /\.mp4$/i.test(href));
      if (!file) continue;
      const nasaId = meta.nasa_id || meta.title || randomUUID();
      results.push(
        mediaResult({
          id: `nasa:${nasaId}`,
          source: "NASA Image and Video Library",
          title: meta.title || "NASA video",
          description: meta.description || "",
          credit: meta.center || "NASA",
          license: "NASA media guidelines",
          pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
          url: file.replace("http://", "https://").replaceAll(" ", "%20"),
          thumb: links.find((link) => link.render === "image")?.href || "",
          mime: "video/mp4"
        })
      );
    } catch {
      continue;
    }
  }
  return results.slice(0, limit);
}

async function searchPexels(query, limit = 8, key = "") {
  if (!key) return [];
  const searchUrl = new URL("https://api.pexels.com/videos/search");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("per_page", String(Math.max(1, Math.min(15, limit))));
  searchUrl.searchParams.set("orientation", "landscape");
  const data = await fetchJsonWithHeaders(searchUrl, { Authorization: key });
  return (data.videos || [])
    .map((video) => {
      const files = [...(video.video_files || [])].filter((file) => file.file_type === "video/mp4" && file.link);
      files.sort((a, b) => Math.abs((a.width || 1280) - 1920) - Math.abs((b.width || 1280) - 1920));
      const file = files[0];
      if (!file) return null;
      return mediaResult({
        id: `pexels:${video.id}`,
        source: "Pexels",
        title: video.user?.name ? `Pexels video by ${video.user.name}` : `Pexels video ${video.id}`,
        description: video.url || "",
        credit: video.user?.name || "Pexels contributor",
        license: "Pexels license",
        pageUrl: video.url,
        url: file.link,
        thumb: video.image || video.video_pictures?.[0]?.picture || "",
        mime: "video/mp4"
      });
    })
    .filter(Boolean);
}

async function searchPixabay(query, limit = 8, key = "") {
  if (!key) return [];
  const searchUrl = new URL("https://pixabay.com/api/videos/");
  searchUrl.searchParams.set("key", key);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("per_page", String(Math.max(3, Math.min(20, limit))));
  searchUrl.searchParams.set("safesearch", "true");
  searchUrl.searchParams.set("video_type", "all");
  const data = await fetchJson(searchUrl);
  return (data.hits || [])
    .map((hit) => {
      const file = hit.videos?.medium || hit.videos?.small || hit.videos?.large || hit.videos?.tiny;
      if (!file?.url) return null;
      return mediaResult({
        id: `pixabay:${hit.id}`,
        source: "Pixabay",
        title: hit.tags ? `Pixabay: ${hit.tags}` : `Pixabay video ${hit.id}`,
        description: hit.tags || "",
        credit: hit.user || "Pixabay contributor",
        license: "Pixabay Content License",
        pageUrl: hit.pageURL,
        url: file.url,
        thumb: file.thumbnail || "",
        mime: "video/mp4"
      });
    })
    .filter(Boolean);
}

async function searchDvids(query, limit = 8, key = "") {
  if (!key) return [];
  const searchUrl = new URL("https://api.dvidshub.net/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("max_results", String(Math.max(1, Math.min(20, limit))));
  searchUrl.searchParams.set("api_key", key);
  const data = await fetchJson(searchUrl);
  const raw = data.results || data.items || data.data || [];
  return raw
    .map((item) => {
      const asset = item.asset || item;
      const videoUrl =
        asset.url ||
        asset.media_url ||
        asset.download_url ||
        asset.video_url ||
        asset.path ||
        asset.preview;
      if (!videoUrl || !/\.mp4|video/i.test(String(videoUrl))) return null;
      const pageUrl = asset.web_url || asset.url_public || asset.permalink || asset.link || videoUrl;
      return mediaResult({
        id: `dvids:${asset.id || asset.asset_id || randomUUID()}`,
        source: "DVIDS",
        title: asset.title || "DVIDS video",
        description: asset.description || asset.caption || "",
        credit: asset.credit || asset.unit_name || "DVIDS",
        license: "DVIDS usage guidelines",
        pageUrl,
        url: String(videoUrl).replace("http://", "https://"),
        thumb: asset.thumbnail || asset.image || asset.preview_image || "",
        mime: "video/mp4"
      });
    })
    .filter(Boolean);
}

async function searchCommonsAudio(query, limit = 8) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `filetype:audio ${query}`);
  url.searchParams.set("gsrlimit", String(limit * 2));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  const data = await fetchJson(url);
  const pages = Object.values(data.query?.pages || {});
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || !String(info.mime || "").startsWith("audio/")) return null;
      const meta = info.extmetadata || {};
      return {
        id: `commons-audio:${page.pageid}`,
        source: "Wikimedia Commons",
        title: String(page.title || "").replace(/^File:/, ""),
        credit: meta.Artist?.value?.replace(/<[^>]*>/g, "") || "Wikimedia Commons contributor",
        license: meta.LicenseShortName?.value || "Commons license",
        pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
        url: info.url,
        previewUrl: info.url,
        mime: info.mime
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

async function searchArchiveAudio(query, limit = 8) {
  const searchUrl = new URL("https://archive.org/advancedsearch.php");
  searchUrl.searchParams.set("q", `(${query}) AND mediatype:audio`);
  searchUrl.searchParams.append("fl[]", "identifier");
  searchUrl.searchParams.append("fl[]", "title");
  searchUrl.searchParams.append("fl[]", "description");
  searchUrl.searchParams.append("fl[]", "licenseurl");
  searchUrl.searchParams.set("rows", String(limit));
  searchUrl.searchParams.set("output", "json");
  const data = await fetchJson(searchUrl);
  const docs = data.response?.docs || [];
  const results = [];
  for (const doc of docs) {
    try {
      const meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
      const file =
        (meta.files || []).find((entry) => /\.(mp3|ogg|wav|m4a)$/i.test(entry.name || "") && !/_64kb\.mp3$/i.test(entry.name || "")) ||
        (meta.files || []).find((entry) => /\.(mp3|ogg|wav|m4a)$/i.test(entry.name || ""));
      if (!file?.name) continue;
      const fileUrl = archiveFileUrl(doc.identifier, file.name);
      results.push({
        id: `archive-audio:${doc.identifier}:${file.name}`,
        source: "Internet Archive",
        title: doc.title || meta.metadata?.title || doc.identifier,
        credit: meta.metadata?.creator || "Internet Archive contributor",
        license: doc.licenseurl || meta.metadata?.licenseurl || "Check archive item rights",
        pageUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
        url: fileUrl,
        previewUrl: `/api/proxy?url=${encodeURIComponent(fileUrl)}`,
        mime: /\.ogg$/i.test(file.name) ? "audio/ogg" : /\.wav$/i.test(file.name) ? "audio/wav" : "audio/mpeg"
      });
    } catch {
      continue;
    }
  }
  return results.slice(0, limit);
}

async function searchNasaAudio(query, limit = 8) {
  const searchUrl = new URL("https://images-api.nasa.gov/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("media_type", "audio");
  searchUrl.searchParams.set("page_size", String(limit));
  const data = await fetchJson(searchUrl);
  const items = data.collection?.items || [];
  const results = [];
  for (const item of items) {
    const meta = item.data?.[0] || {};
    if (!item.href) continue;
    try {
      const files = await fetchJson(item.href.replaceAll(" ", "%20"));
      const file = files.find((href) => /\.(mp3|wav|m4a)$/i.test(href));
      if (!file) continue;
      const nasaId = meta.nasa_id || meta.title || randomUUID();
      const fileUrl = file.replace("http://", "https://").replaceAll(" ", "%20");
      results.push({
        id: `nasa-audio:${nasaId}`,
        source: "NASA Audio",
        title: meta.title || "NASA audio",
        credit: meta.center || "NASA",
        license: "NASA media guidelines",
        pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
        url: fileUrl,
        previewUrl: `/api/proxy?url=${encodeURIComponent(fileUrl)}`,
        mime: /\.wav$/i.test(fileUrl) ? "audio/wav" : "audio/mpeg"
      });
    } catch {
      continue;
    }
  }
  return results.slice(0, limit);
}

async function handleSearch(req, res, url) {
  const query = String(url.searchParams.get("q") || "").trim();
  const source = String(url.searchParams.get("source") || "all");
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit") || 8)));
  const keys = providerKeys(url);
  if (!query) {
    json(res, 400, { error: "Search query is required." });
    return;
  }

  const tasks = [];
  if (source === "all" || source === "commons") tasks.push(searchCommons(query, limit));
  if (source === "all" || source === "archive") tasks.push(searchArchive(query, limit));
  if (source === "all" || source === "nasa") tasks.push(searchNasa(query, limit));
  if (source === "all" || source === "pexels") tasks.push(searchPexels(query, limit, keys.pexels));
  if (source === "all" || source === "pixabay") tasks.push(searchPixabay(query, limit, keys.pixabay));
  if (source === "all" || source === "dvids") tasks.push(searchDvids(query, limit, keys.dvids));
  const settled = await Promise.allSettled(tasks);
  const results = settled.flatMap((item) => (item.status === "fulfilled" ? item.value : []));
  const warnings = settled
    .filter((item) => item.status === "rejected")
    .map((item) => item.reason?.message || "Provider failed");
  json(res, 200, { query, source, warnings, results: rankResults(results, query).slice(0, limit * 3) });
}

async function handleMusicSearch(req, res, url) {
  const query = String(url.searchParams.get("q") || "").trim();
  const source = String(url.searchParams.get("source") || "all");
  const limit = Math.max(1, Math.min(12, Number(url.searchParams.get("limit") || 8)));
  if (!query) {
    json(res, 400, { error: "Music search query is required." });
    return;
  }
  const tasks = [];
  if (source === "all" || source === "commons") tasks.push(searchCommonsAudio(query, limit));
  if (source === "all" || source === "archive") tasks.push(searchArchiveAudio(query, limit));
  if (source === "all" || source === "nasa") tasks.push(searchNasaAudio(query, limit));
  const settled = await Promise.allSettled(tasks);
  const results = settled.flatMap((item) => (item.status === "fulfilled" ? item.value : []));
  const warnings = settled
    .filter((item) => item.status === "rejected")
    .map((item) => item.reason?.message || "Provider failed");
  json(res, 200, { query, source, warnings, results: rankResults(results, query).slice(0, limit * 3) });
}

async function handleProviders(_req, res) {
  json(res, 200, {
    providers: [
      { id: "commons", name: "Wikimedia Commons", requiresKey: false, media: ["video", "audio"] },
      { id: "archive", name: "Internet Archive", requiresKey: false, media: ["video", "audio"] },
      { id: "nasa", name: "NASA Image and Video Library", requiresKey: false, media: ["video", "audio"] },
      { id: "pexels", name: "Pexels", requiresKey: true, configured: Boolean(process.env.PEXELS_API_KEY), media: ["video"] },
      { id: "pixabay", name: "Pixabay", requiresKey: true, configured: Boolean(process.env.PIXABAY_API_KEY), media: ["video"] },
      { id: "dvids", name: "DVIDS", requiresKey: true, configured: Boolean(process.env.DVIDS_API_KEY), media: ["video"] }
    ]
  });
}

function integrationManifest() {
  return {
    name: "Seval",
    version: "0.2.0",
    description: "Local modular video studio for scripted explainer videos.",
    server: `http://localhost:${port}`,
    mcp: {
      command: "node",
      args: ["tools/mcp-server.mjs"],
      cwd: root,
      transport: "stdio"
    },
    codex: {
      suggestedTasks: [
        "Improve a Seval preset or scene renderer.",
        "Create a new video preset from a topic and save it as a project.",
        "Search public media for each beat and produce a source list.",
        "Add a new local provider module or TTS adapter."
      ],
      projectFiles: [
        "src/modules/scriptTemplates.js",
        "src/modules/renderer.js",
        "src/modules/media.js",
        "src/modules/audio.js",
        "tools/mcp-server.mjs"
      ]
    },
    tools: [
      {
        name: "seval.searchMedia",
        description: "Search public and optional-key video sources for a beat query.",
        endpoint: "/api/search?q={query}&source=all"
      },
      {
        name: "seval.searchMusic",
        description: "Search public audio/music sources for a soundtrack.",
        endpoint: "/api/music/search?q={query}&source=all"
      },
      {
        name: "seval.providers",
        description: "List source providers and key requirements.",
        endpoint: "/api/providers"
      },
      {
        name: "seval.integrations",
        description: "Return the Codex/MCP integration manifest.",
        endpoint: "/api/integrations"
      },
      {
        name: "seval.saveProject",
        description: "Save a complete Seval project JSON document.",
        endpoint: "/api/projects"
      },
      {
        name: "seval.tts",
        description: "Render narration with Windows SAPI or an OpenAI-compatible local TTS endpoint.",
        endpoint: "/api/tts"
      }
    ]
  };
}

async function handleIntegrations(_req, res) {
  json(res, 200, integrationManifest());
}

async function handleProjects(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/projects") {
    const files = await readdir(projectRoot).catch(() => []);
    const projects = [];
    for (const file of files.filter((name) => name.endsWith(".json"))) {
      try {
        const data = JSON.parse(await readFile(join(projectRoot, file), "utf8"));
        projects.push({
          id: data.id || file.replace(/\.json$/, ""),
          name: data.name || file.replace(/\.json$/, ""),
          updatedAt: data.updatedAt || "",
          beats: data.project?.beats?.length || 0
        });
      } catch {
        continue;
      }
    }
    projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    json(res, 200, { projects });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const body = JSON.parse((await readBody(req, 30 * 1024 * 1024)).toString("utf8") || "{}");
    const name = String(body.name || body.project?.name || "Seval Project").trim();
    const id = slug(body.id || name);
    const payload = {
      id,
      name,
      updatedAt: new Date().toISOString(),
      project: body.project || body
    };
    await writeFile(projectPath(id), JSON.stringify(payload, null, 2), "utf8");
    json(res, 200, { ok: true, id, name: payload.name, updatedAt: payload.updatedAt });
    return true;
  }

  const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (match && req.method === "GET") {
    const id = slug(decodeURIComponent(match[1]));
    const payload = JSON.parse(await readFile(projectPath(id), "utf8"));
    json(res, 200, payload);
    return true;
  }

  if (match && req.method === "DELETE") {
    const id = slug(decodeURIComponent(match[1]));
    await rm(projectPath(id), { force: true });
    json(res, 200, { ok: true, id });
    return true;
  }

  return false;
}

async function handleProxy(req, res, url) {
  const raw = url.searchParams.get("url");
  if (!raw) {
    json(res, 400, { error: "URL is required." });
    return;
  }
  const target = new URL(raw);
  if (!["https:", "http:"].includes(target.protocol) || !allowedProxyHosts.has(target.hostname)) {
    json(res, 403, { error: "This media host is not allowed." });
    return;
  }

  const headers = {
    "User-Agent": agent
  };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = await fetch(target, { headers });
  const responseHeaders = {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Content-Length": upstream.headers.get("content-length"),
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    "Content-Range": upstream.headers.get("content-range"),
    "Cache-Control": "public, max-age=3600"
  };
  for (const [key, value] of Object.entries(responseHeaders)) {
    if (!value) delete responseHeaders[key];
  }
  res.writeHead(upstream.status, responseHeaders);
  if (!upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body).pipe(res);
}

async function sendFile(res, filePath) {
  const fileStat = await stat(filePath);
  const type = mime.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": fileStat.size
  });
  createReadStream(filePath).pipe(res);
}

async function handleTts(req, res) {
  const body = await readBody(req, 4 * 1024 * 1024);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const text = String(payload.text || "").trim();
  if (!text) {
    json(res, 400, { error: "Text is required." });
    return;
  }
  const engine = String(payload.engine || "windows");
  if (engine === "openai") {
    await handleOpenAiTts(payload, text, res);
    return;
  }

  const id = randomUUID();
  const textPath = join(tmpRoot, `${id}.txt`);
  const wavPath = join(tmpRoot, `${id}.wav`);
  const rate = Math.max(-10, Math.min(10, Number(payload.rate ?? 0)));
  const voice = String(payload.voice || "");

  await writeFile(textPath, text, "utf8");
  try {
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
      String(rate),
      "-Voice",
      voice
    ]);
    await sendFile(res, wavPath);
  } finally {
    await rm(textPath, { force: true }).catch(() => {});
    setTimeout(() => rm(wavPath, { force: true }).catch(() => {}), 30_000);
  }
}

async function handleOpenAiTts(payload, text, res) {
  const endpoint = String(payload.endpoint || "").trim();
  if (!endpoint) {
    json(res, 400, { error: "A local TTS endpoint is required." });
    return;
  }
  const target = new URL(endpoint);
  if (!["http:", "https:"].includes(target.protocol)) {
    json(res, 400, { error: "Unsupported TTS endpoint protocol." });
    return;
  }
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/wav,audio/mpeg,audio/*"
    },
    body: JSON.stringify({
      model: payload.model || "kokoro",
      input: text,
      voice: payload.aiVoice || payload.voice || "af_heart",
      response_format: "wav"
    })
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    json(res, 502, { error: `Local TTS failed: ${response.status} ${errorText}` });
    return;
  }
  const audio = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    "Content-Type": response.headers.get("content-type") || "audio/wav",
    "Content-Length": audio.length
  });
  res.end(audio);
}

async function pythonImportStatus(moduleName, pythonPath = "python") {
  try {
    await run(pythonPath, ["-c", `import ${moduleName}`]);
    return true;
  } catch {
    return false;
  }
}

async function handleTtsEngines(_req, res) {
  const kokoroPython = join(root, ".seval", "tts", "kokoro", "Scripts", "python.exe");
  const chatterboxPython = join(root, ".seval", "tts", "chatterbox-turbo", "Scripts", "python.exe");
  const kokoro =
    (await pythonImportStatus("kokoro_onnx")) ||
    (await pythonImportStatus("kokoro")) ||
    (await pythonImportStatus("kokoro_onnx", kokoroPython)) ||
    (await pythonImportStatus("kokoro", kokoroPython));
  const chatterbox =
    (await pythonImportStatus("chatterbox")) ||
    (await pythonImportStatus("chatterbox", chatterboxPython));
  json(res, 200, {
    engines: [
      {
        id: "windows",
        name: "Windows SAPI",
        installed: true,
        kind: "native",
        notes: "Fast built-in Windows voices."
      },
      {
        id: "openai",
        name: "OpenAI-compatible local TTS",
        installed: false,
        kind: "http",
        notes: "Use this for Kokoro, Chatterbox, Speaches, or any local server with /v1/audio/speech."
      },
      {
        id: "kokoro",
        name: "Kokoro",
        installed: kokoro,
        kind: "optional-python",
        command: "powershell -ExecutionPolicy Bypass -File tools\\tts\\install-kokoro.ps1",
        notes: "Good lightweight local TTS option. Can be served through an OpenAI-compatible endpoint."
      },
      {
        id: "chatterbox-turbo",
        name: "Chatterbox-Turbo",
        installed: chatterbox,
        kind: "optional-python",
        command: "powershell -ExecutionPolicy Bypass -File tools\\tts\\install-chatterbox-turbo.ps1",
        notes: "Higher-quality local TTS option. Heavier than Kokoro and may need GPU/extra dependencies."
      }
    ]
  });
}

async function handleVoices(_req, res) {
  const result = await run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(root, "tools", "voices.ps1")
  ]);
  json(res, 200, JSON.parse(result.stdout || "[]"));
}

async function handleConvert(req, res) {
  const input = await readBody(req);
  if (!input.length) {
    json(res, 400, { error: "A WebM upload is required." });
    return;
  }

  const id = randomUUID();
  const inPath = join(tmpRoot, `${id}.webm`);
  const outPath = join(tmpRoot, `${id}.mp4`);
  await writeFile(inPath, input);

  try {
    await run("ffmpeg", [
      "-y",
      "-i",
      inPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outPath
    ]);
    await sendFile(res, outPath);
  } finally {
    await rm(inPath, { force: true }).catch(() => {});
    setTimeout(() => rm(outPath, { force: true }).catch(() => {}), 60_000);
  }
}

async function handleHealth(_req, res) {
  const checks = {};
  for (const command of ["node", "ffmpeg"]) {
    try {
      const args = command === "ffmpeg" ? ["-version"] : ["--version"];
      const result = await run(command, args);
      checks[command] = (result.stdout || result.stderr).split(/\r?\n/)[0];
    } catch (error) {
      checks[command] = `missing: ${error.message}`;
    }
  }
  try {
    const result = await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "$PSVersionTable.PSVersion.ToString()"
    ]);
    checks["powershell.exe"] = `PowerShell ${result.stdout.trim()}`;
  } catch (error) {
    checks["powershell.exe"] = `missing: ${error.message}`;
  }
  json(res, 200, { ok: true, checks });
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      await handleHealth(req, res);
      return;
    }
    if (url.pathname === "/api/projects" || url.pathname.startsWith("/api/projects/")) {
      if (await handleProjects(req, res, url)) return;
    }
    if (req.method === "GET" && url.pathname === "/api/integrations") {
      await handleIntegrations(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/search") {
      await handleSearch(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/music/search") {
      await handleMusicSearch(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/providers") {
      await handleProviders(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/proxy") {
      await handleProxy(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/voices") {
      await handleVoices(req, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/tts/engines") {
      await handleTtsEngines(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/tts") {
      await handleTts(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/convert") {
      await handleConvert(req, res);
      return;
    }

    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    if (requested !== "/index.html" && !requested.startsWith("/src/")) {
      json(res, 404, { error: "Not found" });
      return;
    }
    const resolved = resolve(publicRoot, `.${normalize(requested)}`);
    if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${sep}`)) {
      json(res, 403, { error: "Forbidden" });
      return;
    }
    await sendFile(res, resolved);
  } catch (error) {
    if (error.code === "ENOENT") {
      await sendFile(res, join(publicRoot, "index.html")).catch(() => {
        json(res, 404, { error: "Not found" });
      });
      return;
    }
    console.error(error);
    json(res, 500, { error: error.message || "Server error" });
  }
}

createServer(route).listen(port, () => {
  console.log(`Seval is running at http://localhost:${port}`);
});
