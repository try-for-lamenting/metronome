import * as S from './state';
import type { AutoSession, MetronomePreset, NoteValue, SubTrack } from './types';

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
  subTracks?: SubTrack[];
  presets?: MetronomePreset[];
  autoSessions?: AutoSession[];
  timers?: PersistedTimer[];
  referenceTones?: ReferenceTonePrefs;
  theme?: string;
}

let persistedTimers: PersistedTimer[] = [];
let referenceTonePrefs: ReferenceTonePrefs = { a4Hz: 440, octave: 4 };
let persistedThemeName = 'deep-cyan';

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

function sanitizeSubTracks(raw: unknown): SubTrack[] {
  if (!Array.isArray(raw)) return [];
  const out: SubTrack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const div = clampInt(obj.div, 2, 16);
    if (div === null) continue;
    const rawStates = Array.isArray(obj.states) ? obj.states : [];
    const states = Array.from({ length: div }, (_, i) => {
      const value = clampInt(rawStates[i], 0, 3);
      return value ?? (i === 0 ? 0 : 1);
    });
    out.push({ div, states });
  }
  return out;
}

function sanitizePresets(raw: unknown): MetronomePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: MetronomePreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const sn = clampInt(obj.sn, 1, 16);
    const sd = clampInt(obj.sd, 1, 32);
    const bpm = clampInt(obj.bpm, 20, 300);
    if (sn === null || sd === null || bpm === null || !VALID_DENS.includes(sd as NoteValue)) continue;
    out.push({
      name: (typeof obj.name === 'string' && obj.name.trim()) ? obj.name.slice(0, 80) : `Preset ${out.length + 1}`,
      bpm,
      sn,
      sd: sd as NoteValue,
      bs: normalizeBeats(sn, obj.bs),
      subTracks: sanitizeSubTracks(obj.subTracks),
    });
  }
  return out;
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
    S.setSubTracks(sanitizeSubTracks(parsed.subTracks));
    S.setPresets(sanitizePresets(parsed.presets));

    const autoSessions = sanitizeSessions(parsed.autoSessions);
    if (autoSessions.length) S.setAutoSessions(autoSessions);

    persistedTimers = sanitizeTimers(parsed.timers);
    referenceTonePrefs = sanitizeReferenceTonePrefs(parsed.referenceTones);
    persistedThemeName = typeof parsed.theme === 'string' && parsed.theme.trim() ? parsed.theme.trim() : 'deep-cyan';
  } catch {
    // ignore broken storage.
  }
}

export function persistAppStateNow(): void {
  try {
    const payload: PersistedState = {
      bpm: S.bpm,
      sn: S.sn,
      sd: S.sd,
      bs: S.bs.slice(0, S.sn).map(v => Math.max(0, Math.min(3, Math.round(v)))),
      subTracks: sanitizeSubTracks(S.subTracks),
      presets: sanitizePresets(S.presets),
      autoSessions: sanitizeSessions(S.autoSessions),
      timers: sanitizeTimers(persistedTimers),
      referenceTones: sanitizeReferenceTonePrefs(referenceTonePrefs),
      theme: persistedThemeName,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore write failures.
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

export function getPersistedTheme(): string {
  return persistedThemeName;
}

export function setPersistedTheme(themeName: string): void {
  persistedThemeName = themeName || 'deep-cyan';
  schedulePersistAppState();
}

export function schedulePersistAppState(delayMs = 120): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistAppStateNow();
  }, delayMs);
}
