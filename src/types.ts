export interface SubTrack {
  div: number;
  states: number[]; // state per division slot.
}

export interface AutoSession {
  name: string;
  startBpm: number;
  endBpm: number;
  period: number; // measure count.
  incr: number;   // bpm step size.
}

export interface VisEvent {
  t: number;
  b: number;
  isSub: boolean;
  di?: number;
  div?: number;
  kind?: 'measure';
}

export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32;
