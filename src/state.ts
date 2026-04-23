import type { SubTrack, AutoSession, VisEvent } from './types';

// Tempo & signature
export let bpm = 120;
export let sn = 4; // beats per measure
export let sd = 4; // note value denominator (1,2,4,8,16,32)

// Beat accent states (0–3) per beat column
export let bs: number[] = [];

// Subdivision tracks
export let subTracks: SubTrack[] = [];

// Playback
export let playing = false;
export let curBeat = 0;       // next beat index to schedule
export let nextT = 0;         // next scheduled audio time
export let schID: ReturnType<typeof setTimeout> | null = null;

// Vis queue
export const vq: VisEvent[] = [];

// Audio context
export let actx: AudioContext | null = null;
export let masterGain: GainNode | null = null;
export let masterVol = 1;

// Pendulum
export let pBeatT = 0;
export let pBeatMs = 0;
export let pGoRight = true;

// Disk
export let diskAngleDeg = 0;

// Tap tempo
export const taps: number[] = [];

// Automator
export let autoSessions: AutoSession[] = [];
export let autoRunning = false;
export let autoPaused = false;
export let autoSession: AutoSession | null = null;
export let autoBarCount = 0;
export let autoPhase = 0;
export let autoPhaseBar = 0; // completed measures within current phase period
export let autoBeatInMeasure = 0; // track beat within measure

// Setters
export function setBpm(v: number) { bpm = Math.max(20, Math.min(300, v)); }
export function setSn(v: number) { sn = Math.max(1, Math.min(16, v)); }
export function setSd(v: number) { sd = v; }
export function setBs(arr: number[]) { bs = arr; }
export function setBsAt(i: number, v: number) { bs[i] = v; }
export function setPlaying(v: boolean) { playing = v; }
export function setCurBeat(v: number) { curBeat = v; }
export function setNextT(v: number) { nextT = v; }
export function setSchID(v: ReturnType<typeof setTimeout> | null) { schID = v; }
export function setActx(v: AudioContext) { actx = v; }
export function setMasterGain(v: GainNode) { masterGain = v; }
export function clearMasterGain() { masterGain = null; }
export function setMasterVol(v: number) { masterVol = v; }
export function setPBeatT(v: number) { pBeatT = v; }
export function setPBeatMs(v: number) { pBeatMs = v; }
export function setPGoRight(v: boolean) { pGoRight = v; }
export function setDiskAngleDeg(v: number) { diskAngleDeg = v; }
export function setSubTracks(v: SubTrack[]) { subTracks = v; }
export function setAutoSessions(v: AutoSession[]) { autoSessions = v; }
export function setAutoRunning(v: boolean) { autoRunning = v; }
export function setAutoPaused(v: boolean) { autoPaused = v; }
export function setAutoSession(v: AutoSession | null) { autoSession = v; }
export function setAutoBarCount(v: number) { autoBarCount = v; }
export function setAutoPhase(v: number) { autoPhase = v; }
export function setAutoPhaseBar(v: number) { autoPhaseBar = v; }
export function setAutoBeatInMeasure(v: number) { autoBeatInMeasure = v; }
