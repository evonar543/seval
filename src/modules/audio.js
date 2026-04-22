import { musicBeds } from "./scriptTemplates.js";

export async function loadVoices(select) {
  try {
    const voices = await fetch("/api/voices").then((res) => res.json());
    for (const voice of voices) {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.culture})`;
      select.append(option);
    }
  } catch {
    select.replaceChildren(new Option("Default Windows voice", ""));
  }
}

export async function tts(
  text,
  {
    voice = "",
    pace = "dramatic",
    engine = "windows",
    endpoint = "",
    model = "",
    aiVoice = ""
  } = {}
) {
  const rate = pace === "fast" ? 2 : pace === "calm" ? -1 : 1;
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, rate, voice, engine, endpoint, model, aiVoice })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Could not create narration.");
  }
  return response.arrayBuffer();
}

export async function fetchAudioBuffer(audioContext, track) {
  if (!track) return null;
  if (track.arrayBuffer) {
    return audioContext.decodeAudioData(track.arrayBuffer.slice(0));
  }
  const url = track.previewUrl || track.url;
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not fetch music track.");
  const buffer = await response.arrayBuffer();
  return audioContext.decodeAudioData(buffer);
}

function createTone(audioContext, destination, start, duration, frequency, gainValue, type = "sine") {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = type;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export function addMusicAndSoundDesign(audioContext, destination, beats, duration, bedKey = "tension", decodedMusic = null) {
  const bed = musicBeds[bedKey] || musicBeds.tension;
  const now = audioContext.currentTime;

  if (decodedMusic) {
    const music = audioContext.createBufferSource();
    const musicGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    music.buffer = decodedMusic;
    music.loop = decodedMusic.duration < duration;
    musicGain.gain.setValueAtTime(0.0001, now);
    musicGain.gain.exponentialRampToValueAtTime(0.105, now + 0.75);
    musicGain.gain.setValueAtTime(0.105, now + Math.max(1, duration - 1.3));
    musicGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    filter.type = "highpass";
    filter.frequency.value = 90;
    music.connect(filter).connect(musicGain).connect(destination);
    music.start(now, 0);
    music.stop(now + duration + 0.25);
  } else {
    const bass = audioContext.createOscillator();
    const bassGain = audioContext.createGain();
    bass.type = "triangle";
    bass.frequency.value = bed.base;
    bassGain.gain.value = bed.gain;
    bass.connect(bassGain).connect(destination);
    bass.start(now);
    bass.stop(now + duration + 0.5);
  }

  const pulse = audioContext.createOscillator();
  const pulseGain = audioContext.createGain();
  pulse.type = "square";
  pulse.frequency.value = bed.pulse;
  pulseGain.gain.value = bed.gain * 0.18;
  pulse.connect(pulseGain).connect(destination);
  pulse.start(now);
  pulse.stop(now + duration + 0.5);

  for (const beat of beats) {
    const start = now + beat.start + 0.08;
    createTone(audioContext, destination, start, 0.16, bed.pulse + beat.index * 8, 0.028);
    if (["missile", "air", "naval", "stock"].includes(beat.visual)) {
      createTone(audioContext, destination, start + beat.duration * 0.62, 0.28, 76, 0.045, "sawtooth");
    }
  }
}
