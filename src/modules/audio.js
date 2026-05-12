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

function createNoiseBuffer(audioContext, duration = 0.12) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function scheduleNoiseHit(audioContext, destination, buffer, start, gainValue, filterFrequency = 3200) {
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = filterFrequency;
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  source.connect(filter).connect(gain).connect(destination);
  source.start(start);
  source.stop(start + 0.14);
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
    const bpm = 96;
    const beatLength = 60 / bpm;
    const chords = [
      [bed.base, bed.base * 1.25, bed.base * 1.5],
      [bed.base * 0.9, bed.base * 1.2, bed.base * 1.42],
      [bed.base * 0.82, bed.base * 1.1, bed.base * 1.34],
      [bed.base * 0.96, bed.base * 1.2, bed.base * 1.5]
    ];
    const melody = [1.5, 1.68, 1.88, 2.24, 1.88, 1.68, 1.5, 1.12];
    const noiseBuffer = createNoiseBuffer(audioContext);

    for (let time = 0, step = 0; time < duration + 0.3; time += beatLength / 2, step += 1) {
      const chord = chords[Math.floor(time / (beatLength * 4)) % chords.length];
      createTone(audioContext, destination, now + time, beatLength * 1.6, chord[0] / 2, bed.gain * 0.9, "triangle");
      createTone(audioContext, destination, now + time, beatLength * 1.4, chord[1], bed.gain * 0.32, "sine");
      createTone(audioContext, destination, now + time, beatLength * 1.2, chord[2], bed.gain * 0.22, "sine");
      createTone(audioContext, destination, now + time, beatLength * 0.28, bed.base * melody[step % melody.length], bed.gain * 0.85, "triangle");
      if (step % 2 === 0) createTone(audioContext, destination, now + time, 0.18, bed.base * 0.68, bed.gain * 1.3, "sawtooth");
      if (step % 4 === 2) scheduleNoiseHit(audioContext, destination, noiseBuffer, now + time, bed.gain * 1.4, 1700);
      scheduleNoiseHit(audioContext, destination, noiseBuffer, now + time + beatLength / 4, bed.gain * 0.35, 5000);
    }
  }

  const pulse = audioContext.createOscillator();
  const pulseGain = audioContext.createGain();
  pulse.type = "square";
  pulse.frequency.value = bed.pulse;
  pulseGain.gain.value = bed.gain * 0.08;
  pulse.connect(pulseGain).connect(destination);
  pulse.start(now);
  pulse.stop(now + duration + 0.5);

  for (const beat of beats) {
    const start = now + beat.start + 0.08;
    createTone(audioContext, destination, start, 0.15, bed.pulse + beat.index * 8, 0.022);
    if (["hero", "focus", "stats", "timeline", "summary"].includes(beat.visual)) {
      createTone(audioContext, destination, start + beat.duration * 0.62, 0.22, bed.base * 0.72, 0.028, "triangle");
    }
  }
}
