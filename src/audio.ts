import * as S from './state';
import type { VisEvent } from './types';

// ─── Scheduler timing constants ───────────────────────────────────────────────
// AHEAD_FG: small foreground lookahead keeps visual latency tight.
// AHEAD_BG: iOS throttles Web Workers to ~1 Hz when backgrounded; 8 s of
//           lookahead means each throttled tick refills ~7 s of buffer.
const AHEAD_FG = 0.12;
const AHEAD_BG = 8.0;
const START_DELAY = 0.12;

// ─── State ────────────────────────────────────────────────────────────────────
let isBackground = false;
let audioUnlockPromise: Promise<boolean> | null = null;
let audioPrimed = false;
let unlockListenersInstalled = false;
let keepAliveSource: AudioBufferSourceNode | null = null;
let outputSuppressed = false;

// ─── Audio graph ──────────────────────────────────────────────────────────────
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

// ─── Keep-alive ───────────────────────────────────────────────────────────────
// A 2-second looping buffer of near-inaudible noise (~-100 dBFS) connected
// directly to destination (not through masterGain). iOS keeps the audio
// session alive as long as it sees continuous audio activity on the context;
// the previous 1-sample buffer was too short to register as active playback.
function startKeepAlive(ctx: AudioContext): void {
  if (keepAliveSource) return;
  try {
    const bufLen = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 1e-5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    keepAliveSource = src;
  } catch { /* ignore */ }
}

function stopKeepAlive(): void {
  if (!keepAliveSource) return;
  try { keepAliveSource.stop(); } catch { /* already stopped */ }
  keepAliveSource = null;
}

// ─── Audio priming ────────────────────────────────────────────────────────────
function primeAudio(ctx: AudioContext): void {
  if (audioPrimed || !S.masterGain) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.02)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = 0.001 * Math.sin(Math.PI * t);
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
          startKeepAlive(ctx);
          primeAudio(ctx);
          return true;
        })
        .catch(() => false)
        .finally(() => { audioUnlockPromise = null; });
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

// ─── Web Worker scheduler clock ───────────────────────────────────────────────
// A Web Worker running setInterval is throttled less aggressively by iOS than
// a main-thread setTimeout chain. Even throttled to ~1 Hz, each tick calls
// sched() which fills AHEAD_BG seconds of audio, so we always stay ahead.
const WORKER_SRC = `
var iv = null;
self.onmessage = function(e) {
  if (e.data === 'start') { clearInterval(iv); iv = setInterval(function(){ self.postMessage(0); }, 25); }
  else if (e.data === 'stop') { clearInterval(iv); iv = null; }
};
`;

let schedWorker: Worker | null = null;

function getSchedWorker(): Worker {
  if (schedWorker) return schedWorker;
  const blob = new Blob([WORKER_SRC], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);
  URL.revokeObjectURL(url);
  w.onmessage = () => { if (S.playing) sched(); };
  schedWorker = w;
  return w;
}

function startSchedWorker(): void {
  getSchedWorker().postMessage('start');
}

function stopSchedWorker(): void {
  schedWorker?.postMessage('stop');
}

// ─── Sound synthesis ──────────────────────────────────────────────────────────
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

  playFilteredNoiseBurst(
    ctx, t,
    Math.max(2200, freq * 2.1), 1.1,
    vol * 0.95, Math.min(0.028, dur * 0.24)
  );
  playToneBurst(ctx, t + 0.001, freq, 'triangle',
    vol * 0.68, Math.min(0.04, dur * 0.22), dur + 0.11, 1.035, -8);
  playToneBurst(ctx, t + 0.0014, freq * 1.012, 'triangle',
    vol * 0.27, Math.min(0.046, dur * 0.24), dur + 0.12, 1.02, 11);
  playToneBurst(ctx, t + 0.0015, freq * 1.86, 'sine',
    vol * 0.1, Math.min(0.03, dur * 0.18), dur * 0.82, 1.018, 6);
  playFilteredNoiseBurst(ctx, t + 0.002, freq, 1.7, vol * 0.3, dur + 0.08);
  playFilteredNoiseBurst(ctx, t + 0.003, freq * 1.42, 2.1, vol * 0.18, dur + 0.04);
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

// ─── Core scheduler ───────────────────────────────────────────────────────────
// Called by the Web Worker on every tick (~25 ms foreground, ~1 Hz background).
// Pure lookahead fill — timing comes entirely from the worker.
function sched(): void {
  if (!S.playing || !S.actx) return;
  const ahead = isBackground ? AHEAD_BG : AHEAD_FG;
  const beatDur = 60 / S.bpm;
  while (S.nextT < S.actx.currentTime + ahead) {
    schedBeat(S.nextT, S.curBeat, beatDur);
    S.setNextT(S.nextT + beatDur);
    S.setCurBeat((S.curBeat + 1) % S.sn);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function startMetronome(): Promise<boolean> {
  activateAudioOutput();
  const ready = await ensureAudio();
  if (!ready || !S.actx) return false;
  S.setPlaying(true);
  S.setCurBeat(0);
  S.setNextT(S.actx.currentTime + START_DELAY);
  S.setAutoBeatInMeasure(0);
  S.vq.length = 0;
  startSchedWorker();
  return true;
}

export function stopMetronome(): void {
  S.setPlaying(false);
  stopSchedWorker();
  // Clear any legacy timeout handle.
  if (S.schID !== null) { clearTimeout(S.schID); S.setSchID(null); }
  // Disconnect masterGain and null it. This orphans every pre-scheduled
  // AudioNode connected through it — a hard cancel of all future audio.
  // ensureAudioGraph() creates a fresh GainNode on the next startMetronome().
  if (S.masterGain) {
    try { S.masterGain.disconnect(); } catch { /* ignore */ }
    S.clearMasterGain();
  }
  stopKeepAlive();
  S.vq.length = 0;
}

/**
 * Called on visibilitychange → hidden.
 * Pre-schedules AHEAD_BG seconds immediately before iOS can suspend the context.
 * The worker continues firing (throttled) and refills the buffer on each tick.
 */
export function onAppBackground(): void {
  if (!S.playing) return;
  isBackground = true;
  sched();
}

/**
 * Called on visibilitychange → visible.
 * Resumes the AudioContext, flushes stale visual events, re-syncs nextT,
 * and triggers an immediate refill in case the pre-scheduled window expired.
 * Returns a Promise that resolves once the context is running and rescheduled,
 * so the caller can safely restart animation loops after audio is live.
 */
export function onAppForeground(): Promise<void> {
  if (!S.playing || !S.actx) return Promise.resolve();
  isBackground = false;
  const resync = (): void => {
    const now = S.actx!.currentTime;
    // Only discard past visual events. Future ones correspond to beats already
    // committed in the Web Audio timeline — keeping them means the bar starts
    // animating immediately on return rather than waiting for the next sched() fill.
    for (let i = S.vq.length - 1; i >= 0; i--) {
      if (S.vq[i].t < now) S.vq.splice(i, 1);
    }
    if (S.nextT <= now) S.setNextT(now + 0.05);
    sched();
  };
  if (S.actx.state !== 'running') {
    return S.actx.resume().then(resync).catch(resync);
  }
  resync();
  return Promise.resolve();
}
