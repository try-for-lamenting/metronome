import * as S from './state';
import type { VisEvent } from './types';

// scheduler timing.
const AHEAD_FG = 0.12;
const AHEAD_BG = 8.0;
const START_DELAY = 0.12;

let isBackground = false;
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

// keep the session alive on ios.
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
  } catch { /* ignore. */ }
}

function stopKeepAlive(): void {
  if (!keepAliveSource) return;
  try { keepAliveSource.stop(); } catch { /* ignore. */ }
  keepAliveSource = null;
}

// audio priming.
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

// worker clock, keep scheduling alive in the background.
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

// sound synthesis.
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
  1: [300, 4, 0.26],
  2: [600, 4, 0.26],
  3: [1200, 4, 0.26],
};
const SUB_SND: Record<number, [number, number, number]> = {
  1: [300, 2, 0.15],
  2: [600, 2, 0.15],
  3: [1200, 2, 0.15],
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

// core scheduler.
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

// public api.
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
  // clear the old timeout.
  if (S.schID !== null) { clearTimeout(S.schID); S.setSchID(null); }
  // drop the gain node to cancel queued audio.
  if (S.masterGain) {
    try { S.masterGain.disconnect(); } catch { /* ignore. */ }
    S.clearMasterGain();
  }
  stopKeepAlive();
  S.vq.length = 0;
}

// fill extra audio before the app hides.
export function onAppBackground(): void {
  if (!S.playing) return;
  isBackground = true;
  sched();
}

// resume and resync when the app returns.
export function onAppForeground(): Promise<void> {
  if (!S.playing || !S.actx) return Promise.resolve();
  isBackground = false;
  const resync = (): void => {
    const now = S.actx!.currentTime;
    // keep future events so the visuals stay in step.
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
