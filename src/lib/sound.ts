/**
 * Generates an authentic 3-note phone message notification sound (PCM WAV data URI).
 */
let cachedAudioUri: string | null = null;

function getPhoneSoundDataUri(): string {
  if (cachedAudioUri) return cachedAudioUri;

  const sampleRate = 44100;
  // 3-note ascending phone chime sequence: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1568Hz)
  const notes = [
    { freq: 1046.5, delay: 0.0, dur: 0.12, vol: 0.45 },
    { freq: 1318.5, delay: 0.07, dur: 0.14, vol: 0.5 },
    { freq: 1568.0, delay: 0.14, dur: 0.28, vol: 0.6 },
  ];
  const totalSecs = 0.45;
  const numSamples = Math.floor(sampleRate * totalSecs);
  const buffer = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    for (const note of notes) {
      if (t >= note.delay && t < note.delay + note.dur) {
        const localT = t - note.delay;
        const env = Math.exp(-localT * 16); // Exponential decay like a marimba / bell pop
        // Fundamental sine + soft 2nd harmonic (triangle-like)
        const wave =
          Math.sin(2 * Math.PI * note.freq * localT) +
          0.3 * Math.sin(4 * Math.PI * note.freq * localT);
        sample += wave * env * note.vol;
      }
    }
    buffer[i] = Math.max(-32768, Math.min(32767, Math.floor(sample * 16384)));
  }

  // Create WAV header
  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);
  const dataSize = numSamples * 2;

  // RIFF descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  const bytes = new Uint8Array(44 + dataSize);
  bytes.set(new Uint8Array(wavHeader), 0);
  bytes.set(new Uint8Array(buffer.buffer), 44);

  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  cachedAudioUri = "data:audio/wav;base64," + btoa(binary);
  return cachedAudioUri;
}

/**
 * Plays an authentic phone message notification sound when a message arrives.
 */
export function playNotificationSound() {
  try {
    const audioUri = getPhoneSoundDataUri();
    const audio = new Audio(audioUri);
    audio.volume = 0.7;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // Fallback to Web Audio API if HTML5 Audio fails
        playWebAudioFallback();
      });
    }
  } catch (err) {
    playWebAudioFallback();
  }
}

function playWebAudioFallback() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const notes = [
      { freq: 1046.5, start: 0.0, dur: 0.12 },
      { freq: 1318.5, start: 0.07, dur: 0.14 },
      { freq: 1568.0, start: 0.14, dur: 0.28 },
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.3, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (err) {
    console.debug("Could not play notification sound:", err);
  }
}
