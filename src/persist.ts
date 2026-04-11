import * as S from './state';
import type { AutoSession, NoteValue } from './types';

const STORAGE_KEY = 'metronome.app.v1';
const VALID_DENS: NoteValue[] = [1, 2, 4, 8, 16, 32];
let saveTimer: ReturnType<typeof setTimeout> | null = null;

interface PersistedState {
  bpm?: number;
  sn?: number;
  sd?: number;
  bs?: number[];
  autoSessions?: AutoSession[];
}

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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write failures.
  }
}

export function schedulePersistAppState(delayMs = 120): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistAppStateNow();
  }, delayMs);
}
