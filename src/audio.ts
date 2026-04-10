import * as S from './state';
import type { VisEvent } from './types';

const LOOK = 25;
const AHEAD = 0.12;

export function ensureAudio(): void {
  if (!S.actx) {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    S.setActx(ctx);
  }
  if (S.actx!.state === 'suspended') S.actx!.resume();
  if (!S.masterGain) {
    const g = S.actx!.createGain();
    g.gain.value = S.masterVol;
    g.connect(S.actx!.destination);
    S.setMasterGain(g);
  }
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
    ctx,
    t,
    Math.max(2200, freq * 2.1),
    1.1,
    vol * 0.95,
    Math.min(0.028, dur * 0.24)
  );

  // Defined woodblock body.
  playToneBurst(
    ctx,
    t + 0.001,
    freq,
    'triangle',
    vol * 0.68,
    Math.min(0.04, dur * 0.22),
    dur + 0.11,
    1.035,
    -8
  );

  playToneBurst(
    ctx,
    t + 0.0014,
    freq * 1.012,
    'triangle',
    vol * 0.27,
    Math.min(0.046, dur * 0.24),
    dur + 0.12,
    1.02,
    11
  );

  // Small overtone so the knock reads as tuned, but not like a clean note.
  playToneBurst(
    ctx,
    t + 0.0015,
    freq * 1.86,
    'sine',
    vol * 0.1,
    Math.min(0.03, dur * 0.18),
    dur * 0.82,
    1.018,
    6
  );

  // Resonant shell noise around the body pitch.
  playFilteredNoiseBurst(
    ctx,
    t + 0.002,
    freq,
    1.7,
    vol * 0.3,
    dur + 0.08
  );

  // Secondary resonance to add body and slight sustain.
  playFilteredNoiseBurst(
    ctx,
    t + 0.003,
    freq * 1.42,
    2.1,
    vol * 0.18,
    dur + 0.04
  );

  // Soft low-mid thump so the hit feels solid without sounding melodic.
  playFilteredNoiseBurst(
    ctx,
    t + 0.001,
    Math.max(420, freq * 0.62),
    1.4,
    vol * 0.16,
    Math.min(0.11, dur * 0.7)
  );
}

const MAIN_SND: Record<number, [number, number, number]> = {
  1: [600, 2, 0.26],
  2: [800, 2, 0.26],
  3: [1200, 2, 0.26],
};
const SUB_SND: Record<number, [number, number, number]> = {
  1: [570, 0.8, 0.15],
  2: [750, 0.8, 0.15],
  3: [1150, 0.8, 0.15],
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

export function startMetronome(): void {
  ensureAudio();
  S.setPlaying(true);
  S.setCurBeat(0);
  S.setNextT(S.actx!.currentTime + 0.05);
  S.setAutoBeatInMeasure(0);
  S.vq.length = 0;
  sched();
}

export function stopMetronome(): void {
  S.setPlaying(false);
  if (S.schID !== null) {
    clearTimeout(S.schID);
    S.setSchID(null);
  }
  S.vq.length = 0;
}
