import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const projectRoot = join(root, ".seval", "projects");
await mkdir(projectRoot, { recursive: true });

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

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function result(id, content) {
  send({
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: typeof content === "string" ? content : JSON.stringify(content, null, 2)
        }
      ]
    }
  });
}

function error(id, code, message) {
  send({
    jsonrpc: "2.0",
    id,
    error: { code, message }
  });
}

async function searchMedia({ query, source = "all", limit = 6 }) {
  const url = new URL("http://localhost:5177/api/search");
  url.searchParams.set("q", query);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Seval search failed: ${response.status}`);
  return response.json();
}

async function searchMusic({ query, source = "all", limit = 6 }) {
  const url = new URL("http://localhost:5177/api/music/search");
  url.searchParams.set("q", query);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Seval music search failed: ${response.status}`);
  return response.json();
}

async function getJson(path) {
  const response = await fetch(`http://localhost:5177${path}`);
  if (!response.ok) throw new Error(`Seval request failed: ${response.status}`);
  return response.json();
}

async function listProjects() {
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
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function callTool(name, args = {}) {
  if (name === "seval_list_projects") {
    return { projects: await listProjects() };
  }
  if (name === "seval_get_project") {
    return JSON.parse(await readFile(projectPath(args.id), "utf8"));
  }
  if (name === "seval_save_project") {
    const project = args.project || {};
    const projectName = args.name || project.name || "Seval Project";
    const id = slug(args.id || projectName);
    const payload = {
      id,
      name: projectName,
      updatedAt: new Date().toISOString(),
      project
    };
    await writeFile(projectPath(id), JSON.stringify(payload, null, 2), "utf8");
    return { ok: true, id, name: projectName };
  }
  if (name === "seval_delete_project") {
    const id = slug(args.id);
    await rm(projectPath(id), { force: true });
    return { ok: true, id };
  }
  if (name === "seval_search_media") {
    return searchMedia(args);
  }
  if (name === "seval_search_music") {
    return searchMusic(args);
  }
  if (name === "seval_list_providers") {
    return getJson("/api/providers");
  }
  if (name === "seval_tts_engines") {
    return getJson("/api/tts/engines");
  }
  if (name === "seval_integrations") {
    return getJson("/api/integrations");
  }
  if (name === "seval_source_report") {
    const payload = JSON.parse(await readFile(projectPath(args.id), "utf8"));
    const project = payload.project || {};
    return {
      project: payload.name,
      sources: (project.beats || [])
        .filter((beat) => beat.media)
        .map((beat, index) => ({
          beat: index + 1,
          title: beat.media.title,
          source: beat.media.source,
          credit: beat.media.credit,
          license: beat.media.license,
          url: beat.media.pageUrl || beat.media.url
        })),
      music: project.settings?.selectedMusic || null
    };
  }
  if (name === "seval_codex_brief") {
    return {
      brief:
        "Seval is a local modular video studio. Improve presets in src/modules/scriptTemplates.js, scene visuals in src/modules/renderer.js, media providers in src/modules/media.js, and TTS adapters in src/modules/audio.js/server.mjs.",
      run: "npm.cmd start",
      url: "http://localhost:5177"
    };
  }
  throw new Error(`Unknown tool: ${name}`);
}

const tools = [
  {
    name: "seval_list_projects",
    description: "List locally saved Seval projects.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "seval_get_project",
    description: "Get a saved Seval project by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  {
    name: "seval_save_project",
    description: "Save a Seval project JSON document.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        project: { type: "object" }
      },
      required: ["project"]
    }
  },
  {
    name: "seval_delete_project",
    description: "Delete a saved Seval project by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  {
    name: "seval_search_media",
    description: "Search Seval public and optional-key media providers for stock footage.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        source: { type: "string", enum: ["all", "commons", "archive", "nasa", "pexels", "pixabay", "dvids"] },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "seval_search_music",
    description: "Search Seval public music/audio providers for soundtrack tracks.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        source: { type: "string", enum: ["all", "commons", "archive", "nasa"] },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "seval_list_providers",
    description: "List configured Seval video and audio providers.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "seval_tts_engines",
    description: "List Seval TTS engines and optional installer commands.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "seval_integrations",
    description: "Return Seval Codex/MCP integration manifest.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "seval_source_report",
    description: "Create a source/license report for a saved Seval project.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"]
    }
  },
  {
    name: "seval_codex_brief",
    description: "Return a concise Codex development brief for the Seval codebase.",
    inputSchema: { type: "object", properties: {} }
  }
];

const rl = createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  try {
    if (message.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "seval-mcp", version: "0.2.0" }
        }
      });
      return;
    }
    if (message.method === "tools/list") {
      send({ jsonrpc: "2.0", id: message.id, result: { tools } });
      return;
    }
    if (message.method === "tools/call") {
      const output = await callTool(message.params?.name, message.params?.arguments || {});
      result(message.id, output);
      return;
    }
    if (message.id !== undefined) {
      error(message.id, -32601, `Unsupported method: ${message.method}`);
    }
  } catch (err) {
    error(message.id, -32000, err.message || "Tool call failed");
  }
});
