import * as S from './state';
import type { AutoSession, NoteValue } from './types';

const STORAGE_KEY = 'metronome.app.v1';
const VALID_DENS: NoteValue[] = [1, 2, 4, 8, 16, 32];
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface PersistedTimer {
  id: number;
  name: string;
  durationSec: number;
  remainingSec: number;
}

export interface ReferenceTonePrefs {
  a4Hz: number;
  octave: number;
}

interface PersistedState {
  bpm?: number;
  sn?: number;
  sd?: number;
  bs?: number[];
  autoSessions?: AutoSession[];
  timers?: PersistedTimer[];
  referenceTones?: ReferenceTonePrefs;
}

let persistedTimers: PersistedTimer[] = [];
let referenceTonePrefs: ReferenceTonePrefs = { a4Hz: 440, octave: 4 };

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeSessions(raw: unknown): AutoSession[] {
  if (!Array.isArray(raw)) return [];
  const out: AutoSession[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const startBpm = clampInt(obj.startBpm, 20, 299);
    const endBpm = clampInt(obj.endBpm, 21, 300);
    const period = clampInt(obj.period, 1, 256);
    const incr = clampInt(obj.incr, 1, 50);
    if (startBpm === null || endBpm === null || period === null || incr === null) continue;
    out.push({
      name: (typeof obj.name === 'string' && obj.name.trim()) ? obj.name.slice(0, 80) : `Session ${out.length + 1}`,
      startBpm,
      endBpm,
      period,
      incr,
    });
  }
  return out;
}

function normalizeBeats(sn: number, raw: unknown): number[] {
  const beats: number[] = Array.from({ length: sn }, (_, i) => (i === 0 ? 3 : 1));
  if (!Array.isArray(raw)) return beats;
  for (let i = 0; i < sn; i++) {
    const v = clampInt(raw[i], 0, 3);
    beats[i] = v === null ? beats[i] : v;
  }
  return beats;
}

function sanitizeTimers(raw: unknown): PersistedTimer[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedTimer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const id = clampInt(obj.id, 1, 1000000);
    const durationSec = clampInt(obj.durationSec, 1, 300 * 60);
    const remainingSec = clampInt(obj.remainingSec, 0, 300 * 60);
    if (id === null || durationSec === null || remainingSec === null) continue;
    out.push({
      id,
      name: (typeof obj.name === 'string' && obj.name.trim()) ? obj.name.slice(0, 48) : `Timer ${out.length + 1}`,
      durationSec,
      remainingSec,
    });
  }
  return out;
}

function sanitizeReferenceTonePrefs(raw: unknown): ReferenceTonePrefs {
  if (!raw || typeof raw !== 'object') return { a4Hz: 440, octave: 4 };
  const obj = raw as Record<string, unknown>;
  const a4Hz = clampInt(obj.a4Hz, 400, 480);
  const octave = clampInt(obj.octave, 3, 7);
  return {
    a4Hz: a4Hz ?? 440,
    octave: octave ?? 4,
  };
}

export function loadPersistedAppState(): void {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    if (!txt) return;
    const parsed = JSON.parse(txt) as PersistedState;

    const sn = clampInt(parsed.sn, 1, 16);
    if (sn !== null) S.setSn(sn);

    const sdCandidate = clampInt(parsed.sd, 1, 32);
    if (sdCandidate !== null && VALID_DENS.includes(sdCandidate as NoteValue)) {
      S.setSd(sdCandidate as NoteValue);
    }

    const bpm = clampInt(parsed.bpm, 20, 300);
    if (bpm !== null) S.setBpm(bpm);

    S.setBs(normalizeBeats(S.sn, parsed.bs));

    const autoSessions = sanitizeSessions(parsed.autoSessions);
    if (autoSessions.length) S.setAutoSessions(autoSessions);

    persistedTimers = sanitizeTimers(parsed.timers);
    referenceTonePrefs = sanitizeReferenceTonePrefs(parsed.referenceTones);
  } catch {
    // Ignore corrupted or unavailable storage and continue with defaults.
  }
}

export function persistAppStateNow(): void {
  try {
    const payload: PersistedState = {
      bpm: S.bpm,
      sn: S.sn,
      sd: S.sd,
      bs: S.bs.slice(0, S.sn).map(v => Math.max(0, Math.min(3, Math.round(v)))),
      autoSessions: sanitizeSessions(S.autoSessions),
      timers: sanitizeTimers(persistedTimers),
      referenceTones: sanitizeReferenceTonePrefs(referenceTonePrefs),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

export function getPersistedTimers(): PersistedTimer[] {
  return persistedTimers.map(t => ({ ...t }));
}

export function setPersistedTimers(timers: PersistedTimer[]): void {
  persistedTimers = sanitizeTimers(timers);
  schedulePersistAppState();
}

export function getReferenceTonePrefs(): ReferenceTonePrefs {
  return { ...referenceTonePrefs };
}

export function setReferenceTonePrefs(prefs: ReferenceTonePrefs): void {
  referenceTonePrefs = sanitizeReferenceTonePrefs(prefs);
  schedulePersistAppState();
}

export function schedulePersistAppState(delayMs = 120): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistAppStateNow();
  }, delayMs);
}
