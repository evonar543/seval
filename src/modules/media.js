export function proxied(url) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function appendProviderKeys(url, keys = {}) {
  if (keys.pexels) url.searchParams.set("pexelsKey", keys.pexels);
  if (keys.pixabay) url.searchParams.set("pixabayKey", keys.pixabay);
  if (keys.dvids) url.searchParams.set("dvidsKey", keys.dvids);
}

export async function searchPublicMedia(query, source = "all", limit = 8, keys = {}) {
  const url = new URL("/api/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  appendProviderKeys(url, keys);
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Public footage search failed.");
  }
  return response.json();
}

export async function searchPublicMusic(query, source = "all", limit = 8) {
  const url = new URL("/api/music/search", window.location.origin);
  url.searchParams.set("q", query);
  url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Music search failed.");
  }
  return response.json();
}

export async function loadProviders() {
  return fetch("/api/providers").then((res) => res.json());
}

export async function autoMatchBeats(beats, source, keys = {}, onProgress = () => {}) {
  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i];
    onProgress(i, beats.length, beat);
    try {
      const data = await searchPublicMedia(beat.stockQuery, source, 4, keys);
      const result = data.results.find((item) => item.previewUrl);
      if (result) {
        beat.media = result;
        beat.visual = "stock";
      }
    } catch {
      continue;
    }
  }
  onProgress(beats.length, beats.length, null);
  return beats;
}

export function createVideoPool(beats) {
  const pool = new Map();
  for (const beat of beats) {
    if (!beat.media?.previewUrl || pool.has(beat.media.previewUrl)) continue;
    const video = document.createElement("video");
    video.src = beat.media.previewUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    pool.set(beat.media.previewUrl, video);
  }
  return pool;
}

export async function startVideoPool(pool) {
  const tasks = [];
  for (const video of pool.values()) {
    tasks.push(
      video
        .play()
        .catch(() => null)
    );
  }
  await Promise.allSettled(tasks);
}
