import { activateAudioOutput, ensureAudio, nudgeAudioFromGesture } from './audio';
import * as S from './state';
import { getReferenceTonePrefs, setReferenceTonePrefs } from './persist';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [3, 4, 5, 6, 7];
const DETECT_MIN_FREQ = 55;
const DETECT_MAX_FREQ = 1400;
const DETECT_MIN_RMS = 0.004;
const DETECT_EDGE_THRESHOLD = 0.007;
const DETECT_CLARITY_MIN = 0.1;

let a4Hz = 440;
let selectedOctave = 4;
let activeOsc: OscillatorNode | null = null;
let activeGain: GainNode | null = null;
let activeNoteKey = '';
let tunerPageActive = false;
let smoothedFrequency = 0;
let liveTunerRunning = false;
let liveTunerRaf: number | null = null;
let liveTunerLastTick = 0;
let liveTunerStream: MediaStream | null = null;
let liveTunerCtx: AudioContext | null = null;
let liveTunerAnalyser: AnalyserNode | null = null;
let liveTunerSource: MediaStreamAudioSourceNode | null = null;
let liveTunerBuffer: Float32Array<ArrayBuffer> | null = null;

interface TunerRefs {
  grid: HTMLElement;
  a4Input: HTMLInputElement;
  a4DownBtn: HTMLElement;
  a4UpBtn: HTMLElement;
  octaveRow: HTMLElement;
  referenceToneStatus: HTMLElement;
  liveTunerToggleBtn: HTMLButtonElement;
  liveTunerState: HTMLElement;
  liveTunerNote: HTMLElement;
  liveTunerOctave: HTMLElement;
  liveTunerFreq: HTMLElement;
  liveTunerTarget: HTMLElement;
  liveTunerCents: HTMLElement;
  liveTunerHint: HTMLElement;
  liveTunerNeedle: HTMLElement;
  liveTunerSignalFill: HTMLElement;
  liveTunerOrb: HTMLElement;
}

let refs: TunerRefs | null = null;

function semitoneOffset(note: string, octave: number): number {
  const idx = NOTES.indexOf(note);
  const aIdx = NOTES.indexOf('A');
  return (octave - 4) * 12 + (idx - aIdx);
}

function noteFreq(note: string, octave: number): number {
  return a4Hz * (2 ** (semitoneOffset(note, octave) / 12));
}

function describeDetectedPitch(freq: number): {
  note: string;
  octave: number;
  targetFreq: number;
  cents: number;
} {
  const midi = Math.round(69 + 12 * Math.log2(freq / a4Hz));
  const noteIndex = ((midi % 12) + 12) % 12;
  const note = NOTES[noteIndex];
  const octave = Math.floor(midi / 12) - 1;
  const targetFreq = a4Hz * (2 ** ((midi - 69) / 12));
  const cents = 1200 * Math.log2(freq / targetFreq);
  return { note, octave, targetFreq, cents };
}

function clearActiveNoteButtons(): void {
  document.querySelectorAll<HTMLElement>('.note-btn.is-on').forEach(btn => btn.classList.remove('is-on'));
}

function updateReferenceToneStatus(label = 'Idle', active = false): void {
  if (!refs) return;
  refs.referenceToneStatus.textContent = label;
  refs.referenceToneStatus.classList.toggle('is-active', active);
}

function stopTone(): void {
  try { activeOsc?.stop(); } catch { /* no-op */ }
  try { activeOsc?.disconnect(); } catch { /* no-op */ }
  try { activeGain?.disconnect(); } catch { /* no-op */ }
  activeOsc = null;
  activeGain = null;
  activeNoteKey = '';
  clearActiveNoteButtons();
  updateReferenceToneStatus();
}

async function playTone(note: string, octave: number, noteKey: string): Promise<void> {
  if (activeNoteKey === noteKey) {
    stopTone();
    return;
  }

  activateAudioOutput();
  nudgeAudioFromGesture();
  const ready = await ensureAudio();
  if (!ready || !S.actx || !S.masterGain) return;

  stopTone();

  const freq = noteFreq(note, octave);
  const osc = S.actx.createOscillator();
  const gain = S.actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, S.actx.currentTime);
  gain.gain.setValueAtTime(0.0001, S.actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, S.actx.currentTime + 0.02);
  osc.connect(gain);
  gain.connect(S.masterGain);
  osc.start();
  activeOsc = osc;
  activeGain = gain;
  activeNoteKey = noteKey;

  clearActiveNoteButtons();
  document.querySelector<HTMLElement>(`.note-btn[data-note-key="${noteKey}"]`)?.classList.add('is-on');
  updateReferenceToneStatus(`${note}${octave} • ${freq.toFixed(1)} Hz`, true);
}

function setLiveTunerSignal(level: number): void {
  if (!refs) return;
  refs.liveTunerSignalFill.style.width = `${Math.max(6, Math.min(100, level))}%`;
}

function setLiveTunerValueActivity(active: boolean): void {
  if (!refs) return;
  const inactive = !active;
  refs.liveTunerNote.classList.toggle('is-inactive', inactive);
  refs.liveTunerOctave.classList.toggle('is-inactive', inactive);
  refs.liveTunerFreq.classList.toggle('is-inactive', inactive);
  refs.liveTunerTarget.classList.toggle('is-inactive', inactive);
  refs.liveTunerCents.classList.toggle('is-inactive', inactive);
}

function resetLiveTunerDisplay(message = 'Start the tuner, then play a steady note near your phone.', state = 'Mic off', error = false): void {
  if (!refs) return;
  refs.liveTunerState.textContent = state;
  refs.liveTunerState.classList.toggle('is-live', liveTunerRunning && !error);
  refs.liveTunerState.classList.toggle('is-error', error);
  refs.liveTunerNote.textContent = '--';
  refs.liveTunerOctave.textContent = '—';
  refs.liveTunerFreq.textContent = '0.0 Hz';
  refs.liveTunerTarget.textContent = '--';
  refs.liveTunerCents.textContent = '--';
  refs.liveTunerHint.textContent = message;
  refs.liveTunerNeedle.style.setProperty('--needle-shift', '0px');
  refs.liveTunerOrb.classList.remove('has-signal', 'is-in-tune');
  setLiveTunerValueActivity(false);
  setLiveTunerSignal(6);
}

function updateLiveTunerPitch(freq: number, rms: number): void {
  if (!refs) return;
  const pitch = describeDetectedPitch(freq);
  const cents = Math.max(-50, Math.min(50, pitch.cents));
  const isInTune = Math.abs(pitch.cents) < 5;
  const driftText = Math.abs(pitch.cents) < 0.5
    ? 'In tune'
    : `${pitch.cents < 0 ? '-' : '+'}${Math.abs(pitch.cents).toFixed(1)}¢`;

  refs.liveTunerNote.textContent = pitch.note;
  refs.liveTunerOctave.textContent = String(pitch.octave);
  refs.liveTunerFreq.textContent = `${freq.toFixed(1)} Hz`;
  refs.liveTunerTarget.textContent = `${pitch.targetFreq.toFixed(1)} Hz target`;
  refs.liveTunerCents.textContent = driftText;
  refs.liveTunerHint.textContent = isInTune
    ? 'Locked in. Hold steady.'
    : pitch.cents < 0
      ? 'Tune slightly higher.'
      : 'Tune slightly lower.';
  refs.liveTunerNeedle.style.setProperty('--needle-shift', `${cents * 1.75}px`);
  refs.liveTunerOrb.classList.add('has-signal');
  refs.liveTunerOrb.classList.toggle('is-in-tune', isInTune);
  refs.liveTunerState.textContent = 'Listening';
  refs.liveTunerState.classList.add('is-live');
  refs.liveTunerState.classList.remove('is-error');
  setLiveTunerValueActivity(true);
  setLiveTunerSignal(Math.max(10, Math.min(100, rms * 840)));
}

function updateLiveTunerNoPitch(rms: number): void {
  if (!refs) return;
  const hasHeldPitch = smoothedFrequency > 0;
  refs.liveTunerState.textContent = 'Listening';
  refs.liveTunerState.classList.add('is-live');
  refs.liveTunerState.classList.remove('is-error');
  if (hasHeldPitch) {
    refs.liveTunerHint.textContent = rms > 0.01
      ? 'Try a steadier, clearer note.'
      : 'Waiting for a note...';
    refs.liveTunerOrb.classList.remove('has-signal', 'is-in-tune');
    setLiveTunerValueActivity(false);
  } else {
    refs.liveTunerNote.textContent = '--';
    refs.liveTunerOctave.textContent = '—';
    refs.liveTunerFreq.textContent = '0.0 Hz';
    refs.liveTunerTarget.textContent = '--';
    refs.liveTunerCents.textContent = '--';
    refs.liveTunerHint.textContent = rms > 0.01
      ? 'Try a steadier, clearer note.'
      : 'Waiting for a note...';
    refs.liveTunerNeedle.style.setProperty('--needle-shift', '0px');
    refs.liveTunerOrb.classList.remove('has-signal', 'is-in-tune');
    setLiveTunerValueActivity(false);
  }
  setLiveTunerSignal(Math.max(6, Math.min(55, rms * 840)));
}

function analyzeBuffer(data: Float32Array, sampleRate: number): { frequency: number | null; rms: number } {
  const size = data.length;
  let sumSquares = 0;
  for (let i = 0; i < size; i++) {
    sumSquares += data[i] * data[i];
  }
  const rms = Math.sqrt(sumSquares / size);
  if (rms < DETECT_MIN_RMS) return { frequency: null, rms };

  let start = 0;
  let end = size - 1;
  const threshold = Math.max(DETECT_EDGE_THRESHOLD, rms * 0.28);
  while (start < size / 2 && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;

  const trimmed = data.subarray(start, end + 1);
  if (trimmed.length < 72) return { frequency: null, rms };

  const correlations = new Float32Array(trimmed.length);
  for (let lag = 0; lag < trimmed.length; lag++) {
    let corr = 0;
    for (let i = 0; i < trimmed.length - lag; i++) {
      corr += trimmed[i] * trimmed[i + lag];
    }
    correlations[lag] = corr;
  }

  let offset = 0;
  while (offset + 1 < correlations.length && correlations[offset] > correlations[offset + 1]) {
    offset++;
  }

  let bestOffset = -1;
  let bestCorrelation = -Infinity;
  for (let i = offset; i < correlations.length; i++) {
    if (correlations[i] > bestCorrelation) {
      bestCorrelation = correlations[i];
      bestOffset = i;
    }
  }

  if (bestOffset < 2 || correlations[0] <= 0) return { frequency: null, rms };

  let refinedOffset = bestOffset;
  const c0 = correlations[bestOffset - 1];
  const c1 = correlations[bestOffset];
  const c2 = correlations[bestOffset + 1] ?? c1;
  const divisor = c0 + c2 - 2 * c1;
  if (divisor !== 0) {
    refinedOffset = bestOffset - (c2 - c0) / (2 * divisor);
  }

  const frequency = sampleRate / refinedOffset;
  const clarity = bestCorrelation / correlations[0];
  if (!Number.isFinite(frequency) || frequency < DETECT_MIN_FREQ || frequency > DETECT_MAX_FREQ || clarity < DETECT_CLARITY_MIN) {
    return { frequency: null, rms };
  }

  return { frequency, rms };
}

function tickLiveTuner(ts: number): void {
  if (!liveTunerRunning || !liveTunerAnalyser || !liveTunerCtx || !liveTunerBuffer) return;
  if (ts - liveTunerLastTick < 45) {
    liveTunerRaf = window.requestAnimationFrame(tickLiveTuner);
    return;
  }

  liveTunerLastTick = ts;
  liveTunerAnalyser.getFloatTimeDomainData(liveTunerBuffer);
  const { frequency, rms } = analyzeBuffer(liveTunerBuffer, liveTunerCtx.sampleRate);

  if (frequency) {
    smoothedFrequency = smoothedFrequency > 0
      ? smoothedFrequency * 0.78 + frequency * 0.22
      : frequency;
    updateLiveTunerPitch(smoothedFrequency, rms);
  } else {
    updateLiveTunerNoPitch(rms);
  }

  liveTunerRaf = window.requestAnimationFrame(tickLiveTuner);
}

function cleanUpLiveTuner(): void {
  if (liveTunerRaf !== null) {
    cancelAnimationFrame(liveTunerRaf);
    liveTunerRaf = null;
  }
  try { liveTunerSource?.disconnect(); } catch { /* no-op */ }
  try { liveTunerAnalyser?.disconnect(); } catch { /* no-op */ }
  liveTunerStream?.getTracks().forEach(track => track.stop());
  if (liveTunerCtx && liveTunerCtx.state !== 'closed') {
    void liveTunerCtx.close();
  }

  liveTunerStream = null;
  liveTunerCtx = null;
  liveTunerAnalyser = null;
  liveTunerSource = null;
  liveTunerBuffer = null;
  liveTunerLastTick = 0;
  smoothedFrequency = 0;
  liveTunerRunning = false;
}

function stopLiveTuner(resetMessage = 'Start the tuner, then play a steady note near your phone.'): void {
  cleanUpLiveTuner();
  if (!refs) return;
  refs.liveTunerToggleBtn.textContent = 'Start Mic';
  resetLiveTunerDisplay(resetMessage);
  try {
    if ('audioSession' in navigator) {
      (navigator as any).audioSession.type = 'playback';
    }
  } catch {
  }
}

async function startLiveTuner(): Promise<void> {
  if (!refs || liveTunerRunning) return;
  stopTone();
  refs.liveTunerToggleBtn.textContent = 'Stop Mic';
  refs.liveTunerState.textContent = 'Starting';
  refs.liveTunerState.classList.add('is-live');
  refs.liveTunerState.classList.remove('is-error');
  refs.liveTunerHint.textContent = 'Requesting microphone access...';

  if (!navigator.mediaDevices?.getUserMedia) {
    refs.liveTunerToggleBtn.textContent = 'Start Mic';
    resetLiveTunerDisplay('This browser does not support microphone tuning.', 'Unavailable', true);
    return;
  }

  try {
    if ('audioSession' in navigator) {
      (navigator as any).audioSession.type = 'play-and-record';
    }
  } catch {
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) throw new Error('AudioContext unavailable');

    const ctx: AudioContext = new AudioCtor();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.08;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    liveTunerStream = stream;
    liveTunerCtx = ctx;
    liveTunerAnalyser = analyser;
    liveTunerSource = source;
    liveTunerBuffer = new Float32Array(analyser.fftSize) as Float32Array<ArrayBuffer>;
    liveTunerRunning = true;
    liveTunerLastTick = 0;
    smoothedFrequency = 0;

    refs.liveTunerState.textContent = 'Listening';
    refs.liveTunerState.classList.add('is-live');
    refs.liveTunerHint.textContent = 'Play one steady note close to your phone.';
    liveTunerRaf = window.requestAnimationFrame(tickLiveTuner);
  } catch {
    cleanUpLiveTuner();
    refs.liveTunerToggleBtn.textContent = 'Start Mic';
    resetLiveTunerDisplay('Microphone access was denied or unavailable.', 'Mic blocked', true);
    try {
      if ('audioSession' in navigator) {
        (navigator as any).audioSession.type = 'playback';
      }
    } catch {
    }
  }
}

function renderButtons(): void {
  if (!refs) return;
  refs.grid.innerHTML = '';
  for (const note of NOTES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'note-btn';
    const noteKey = `${note}-${selectedOctave}`;
    btn.dataset.noteKey = noteKey;
    const freq = noteFreq(note, selectedOctave);
    btn.innerHTML = `<span>${note}${selectedOctave}</span><small>${freq.toFixed(1)} Hz</small>`;
    if (noteKey === activeNoteKey) btn.classList.add('is-on');
    btn.addEventListener('click', () => void playTone(note, selectedOctave, noteKey));
    refs.grid.appendChild(btn);
  }
}

function renderOctaves(): void {
  if (!refs) return;
  refs.octaveRow.innerHTML = '';
  for (const octave of OCTAVES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `octave-btn${octave === selectedOctave ? ' is-on' : ''}`;
    btn.textContent = `Oct ${octave}`;
    btn.addEventListener('click', () => {
      stopTone();
      selectedOctave = octave;
      setReferenceTonePrefs({ a4Hz, octave: selectedOctave });
      renderOctaves();
      renderButtons();
    });
    refs.octaveRow.appendChild(btn);
  }
}

function applyA4(value: number): void {
  if (!refs) return;
  stopTone();
  a4Hz = Math.max(400, Math.min(480, Math.round(value)));
  refs.a4Input.value = String(a4Hz);
  setReferenceTonePrefs({ a4Hz, octave: selectedOctave });
  renderButtons();
}

export function setTunerPageActive(active: boolean): void {
  tunerPageActive = active;
  if (!active && liveTunerRunning) {
    stopLiveTuner('Microphone tuner paused.');
  }
  if (!active && activeOsc) {
    stopTone();
  }
}

export function initTunerPage(): void {
  const grid = document.getElementById('tunerNoteGrid');
  const a4Input = document.getElementById('a4Input') as HTMLInputElement | null;
  const a4DownBtn = document.getElementById('a4DownBtn');
  const a4UpBtn = document.getElementById('a4UpBtn');
  const octaveRow = document.getElementById('octaveRow');
  const referenceToneStatus = document.getElementById('referenceToneStatus');
  const liveTunerToggleBtn = document.getElementById('liveTunerToggleBtn') as HTMLButtonElement | null;
  const liveTunerState = document.getElementById('liveTunerState');
  const liveTunerNote = document.getElementById('liveTunerNote');
  const liveTunerOctave = document.getElementById('liveTunerOctave');
  const liveTunerFreq = document.getElementById('liveTunerFreq');
  const liveTunerTarget = document.getElementById('liveTunerTarget');
  const liveTunerCents = document.getElementById('liveTunerCents');
  const liveTunerHint = document.getElementById('liveTunerHint');
  const liveTunerNeedle = document.getElementById('liveTunerNeedle');
  const liveTunerSignalFill = document.getElementById('liveTunerSignalFill');
  const liveTunerOrb = document.getElementById('liveTunerOrb');

  if (
    !grid || !a4Input || !a4DownBtn || !a4UpBtn || !octaveRow ||
    !referenceToneStatus || !liveTunerToggleBtn || !liveTunerState || !liveTunerNote ||
    !liveTunerOctave || !liveTunerFreq || !liveTunerTarget || !liveTunerCents ||
    !liveTunerHint || !liveTunerNeedle || !liveTunerSignalFill || !liveTunerOrb
  ) {
    return;
  }

  refs = {
    grid,
    a4Input,
    a4DownBtn,
    a4UpBtn,
    octaveRow,
    referenceToneStatus,
    liveTunerToggleBtn,
    liveTunerState,
    liveTunerNote,
    liveTunerOctave,
    liveTunerFreq,
    liveTunerTarget,
    liveTunerCents,
    liveTunerHint,
    liveTunerNeedle,
    liveTunerSignalFill,
    liveTunerOrb,
  };

  const prefs = getReferenceTonePrefs();
  a4Hz = prefs.a4Hz;
  selectedOctave = OCTAVES.includes(prefs.octave) ? prefs.octave : 4;
  refs.a4Input.value = String(a4Hz);

  refs.a4Input.addEventListener('change', () => applyA4(parseInt(refs!.a4Input.value || '440', 10) || 440));
  refs.a4DownBtn.addEventListener('click', () => applyA4(a4Hz - 1));
  refs.a4UpBtn.addEventListener('click', () => applyA4(a4Hz + 1));
  refs.liveTunerToggleBtn.addEventListener('click', () => {
    if (liveTunerRunning) {
      stopLiveTuner();
      return;
    }
    void startLiveTuner();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && liveTunerRunning) {
      stopLiveTuner('Microphone tuner paused.');
    }
  });

  window.addEventListener('pagehide', () => {
    if (liveTunerRunning) stopLiveTuner('Microphone tuner paused.');
  });

  renderOctaves();
  renderButtons();
  updateReferenceToneStatus();
  resetLiveTunerDisplay();
  if (!tunerPageActive && liveTunerRunning) {
    stopLiveTuner('Microphone tuner paused.');
  }
}
