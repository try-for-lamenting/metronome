import * as S from './state';
import type { VisEvent } from './types';

const LOOK = 25;
const AHEAD = 0.12;
const START_DELAY = 0.12;

let audioUnlockPromise: Promise<boolean> | null = null;
let audioPrimed = false;
let unlockListenersInstalled = false;
let keepAliveSource: AudioBufferSourceNode | null = null;
let outputSuppressed = false;

function ensureAudioGraph(): AudioContext {
  if (!S.actx || S.actx.state === 'closed') {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    S.setActx(ctx);
    audioPrimed = false;
    keepAliveSource = null;
  }
  if (!S.masterGain || S.masterGain.context !== S.actx) {
    const g = S.actx!.createGain();
    g.gain.value = outputSuppressed ? 0 : S.masterVol;
    g.connect(S.actx!.destination);
    S.setMasterGain(g);
  }
  return S.actx!;
}

function applyOutputLevel(): void {
  if (!S.actx || !S.masterGain) return;
  const now = S.actx.currentTime;
  S.masterGain.gain.cancelScheduledValues(now);
  S.masterGain.gain.setValueAtTime(outputSuppressed ? 0 : S.masterVol, now);
}

export function activateAudioOutput(): void {
  outputSuppressed = false;
  applyOutputLevel();
}

export function suppressAudioOutput(): void {
  outputSuppressed = true;
  applyOutputLevel();
}

export function refreshAudioOutputLevel(): void {
  applyOutputLevel();
}

function startKeepAlive(ctx: AudioContext): void {
  if (keepAliveSource) return;
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    keepAliveSource = src;
  } catch {
  }
}

function stopKeepAlive(): void {
  if (!keepAliveSource) return;
  try { keepAliveSource.stop(); } catch { /* already stopped */ }
  keepAliveSource = null;
}

function primeAudio(ctx: AudioContext): void {
  if (audioPrimed || !S.masterGain) return;
  // Play a brief audible-to-iOS click (very low gain but not 0.00001 which
  // iOS ignores). This activates the hardware audio session on first unlock.
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.02)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Tiny ramp-up/down so it's not a click artifact, but loud enough for iOS
  // to register as real audio and activate the session.
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = 0.001 * Math.sin(Math.PI * t); // near-silent half-sine
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 1;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(S.masterGain);
  source.start();
  source.stop(ctx.currentTime + 0.02);
  audioPrimed = true;
}
export function nudgeAudioFromGesture(): void {
  if ('audioSession' in navigator) {
    (navigator as any).audioSession.type = 'playback';
  }

  const ctx = ensureAudioGraph();
  primeAudio(ctx);
  if (ctx.state !== 'running') {
    void ctx.resume();
  }
}
export async function ensureAudio(): Promise<boolean> {
  const ctx = ensureAudioGraph();
  primeAudio(ctx);
  if (ctx.state !== 'running') {
    if (!audioUnlockPromise) {
      audioUnlockPromise = ctx.resume()
        .then(() => {
          // Don't re-check ctx.state here — on some iOS versions the state
          // hasn't updated synchronously yet even though resume() resolved.
          // If the promise resolved without throwing, the context is running.
          startKeepAlive(ctx);
          primeAudio(ctx);
          return true;
        })
        .catch(() => false)
        .finally(() => {
          audioUnlockPromise = null;
        });
    }
    return await audioUnlockPromise;
  }
  startKeepAlive(ctx);
  return true;
}

export function installAudioUnlock(): void {
  if (unlockListenersInstalled) return;
  unlockListenersInstalled = true;

  const tryUnlock = (): void => {
    nudgeAudioFromGesture();
    void ensureAudio().then(ready => {
      if (!ready) return;
      window.removeEventListener('pointerdown', tryUnlock);
      window.removeEventListener('touchstart', tryUnlock);
      window.removeEventListener('keydown', tryUnlock);
    });
  };

  window.addEventListener('pointerdown', tryUnlock, { passive: true });
  window.addEventListener('touchstart', tryUnlock, { passive: true });
  window.addEventListener('keydown', tryUnlock);
}

let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length * 0.18);
  }
  noiseBuffer = buffer;
  return buffer;
}

function playFilteredNoiseBurst(
  ctx: AudioContext,
  t: number,
  centerFreq: number,
  q: number,
  gainLevel: number,
  decay: number,
  filterType: BiquadFilterType = 'bandpass'
): void {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(centerFreq, t);
  filter.Q.value = q;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.001, gainLevel), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(S.masterGain!);
  source.start(t);
  source.stop(t + decay + 0.02);
}

function playToneBurst(
  ctx: AudioContext,
  t: number,
  freq: number,
  wave: OscillatorType,
  gainLevel: number,
  hold: number,
  decay: number,
  sweep = 1.06,
  detuneCents = 0
): void {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.detune.setValueAtTime(detuneCents, t);
  osc.frequency.setValueAtTime(freq * sweep, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.02, hold * 0.5));

  const preFilter = ctx.createBiquadFilter();
  preFilter.type = 'bandpass';
  preFilter.frequency.setValueAtTime(Math.max(900, freq * 1.55), t);
  preFilter.Q.value = 0.75;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(1650, freq * 2.2), t);
  filter.Q.value = 0.55;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.linearRampToValueAtTime(gainLevel, t + 0.0008);
  gain.gain.exponentialRampToValueAtTime(gainLevel * 0.82, t + hold);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  osc.connect(preFilter);
  preFilter.connect(filter);
  filter.connect(gain);
  gain.connect(S.masterGain!);
  osc.start(t);
  osc.stop(t + decay + 0.02);
}

function beep(t: number, freq: number, vol: number, dur: number): void {
  const ctx = S.actx!;

  // Sharp stick attack.
  playFilteredNoiseBurst(
    ctx, t,
    Math.max(2200, freq * 2.1), 1.1,
    vol * 0.95, Math.min(0.028, dur * 0.24)
  );

  // Defined woodblock body.
  playToneBurst(ctx, t + 0.001, freq, 'triangle',
    vol * 0.68, Math.min(0.04, dur * 0.22), dur + 0.11, 1.035, -8);

  playToneBurst(ctx, t + 0.0014, freq * 1.012, 'triangle',
    vol * 0.27, Math.min(0.046, dur * 0.24), dur + 0.12, 1.02, 11);

  // Small overtone so the knock reads as tuned, but not like a clean note.
  playToneBurst(ctx, t + 0.0015, freq * 1.86, 'sine',
    vol * 0.1, Math.min(0.03, dur * 0.18), dur * 0.82, 1.018, 6);

  // Resonant shell noise around the body pitch.
  playFilteredNoiseBurst(ctx, t + 0.002, freq, 1.7, vol * 0.3, dur + 0.08);

  // Secondary resonance to add body and slight sustain.
  playFilteredNoiseBurst(ctx, t + 0.003, freq * 1.42, 2.1, vol * 0.18, dur + 0.04);

  // Soft low-mid thump so the hit feels solid without sounding melodic.
  playFilteredNoiseBurst(ctx, t + 0.001,
    Math.max(420, freq * 0.62), 1.4, vol * 0.16, Math.min(0.11, dur * 0.7));
}

const MAIN_SND: Record<number, [number, number, number]> = {
  1: [300, 5, 0.26],
  2: [600, 5, 0.26],
  3: [1200, 5, 0.26],
};
const SUB_SND: Record<number, [number, number, number]> = {
  1: [300, 2.5, 0.15],
  2: [600, 2.5, 0.15],
  3: [1200, 2.5, 0.15],
};

function schedBeat(beatTime: number, beatIdx: number, beatDur: number): void {
  const ms = S.bs[beatIdx] || 0;
  if (ms > 0) {
    const [f, v, d] = MAIN_SND[ms];
    beep(beatTime, f, v, d);
  }
  S.vq.push({ t: beatTime, b: beatIdx, isSub: false });

  for (const track of S.subTracks) {
    for (let di = 1; di < track.div; di++) {
      const t = beatTime + (di / track.div) * beatDur;
      const st = track.states[di] || 0;
      if (st > 0) {
        const [f, v, d] = SUB_SND[st];
        beep(t, f, v, d);
      }
      S.vq.push({ t, b: beatIdx, isSub: true, di, div: track.div } as VisEvent);
    }
  }
}

function sched(): void {
  if (!S.playing) return;
  const beatDur = 60 / S.bpm;
  while (S.nextT < S.actx!.currentTime + AHEAD) {
    schedBeat(S.nextT, S.curBeat, beatDur);
    S.setNextT(S.nextT + beatDur);
    S.setCurBeat((S.curBeat + 1) % S.sn);
  }
  S.setSchID(setTimeout(sched, LOOK));
}

export async function startMetronome(): Promise<boolean> {
  activateAudioOutput();
  const ready = await ensureAudio();
  if (!ready || !S.actx) return false;
  S.setPlaying(true);
  S.setCurBeat(0);
  S.setNextT(S.actx.currentTime + START_DELAY);
  S.setAutoBeatInMeasure(0);
  S.vq.length = 0;
  sched();
  return true;
}

export function stopMetronome(): void {
  S.setPlaying(false);
  if (S.schID !== null) {
    clearTimeout(S.schID);
    S.setSchID(null);
  }
  suppressAudioOutput();
  stopKeepAlive();
  S.vq.length = 0;
}
