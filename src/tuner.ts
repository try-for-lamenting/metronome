import { ensureAudio, nudgeAudioFromGesture } from './audio';
import * as S from './state';
import { getReferenceTonePrefs, setReferenceTonePrefs } from './persist';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5, 6, 7, 8];
let a4Hz = 440;
let selectedOctave = 4;
let activeOsc: OscillatorNode | null = null;
let activeGain: GainNode | null = null;

function semitoneOffset(note: string, octave: number): number {
  const idx = NOTES.indexOf(note);
  const aIdx = NOTES.indexOf('A');
  return (octave - 4) * 12 + (idx - aIdx);
}

function noteFreq(note: string, octave: number): number {
  return a4Hz * (2 ** (semitoneOffset(note, octave) / 12));
}

function stopTone(): void {
  try { activeOsc?.stop(); } catch { /* no-op */ }
  try { activeOsc?.disconnect(); } catch { /* no-op */ }
  try { activeGain?.disconnect(); } catch { /* no-op */ }
  activeOsc = null;
  activeGain = null;
}

async function playTone(freq: number): Promise<void> {
  nudgeAudioFromGesture();
  const ready = await ensureAudio();
  if (!ready || !S.actx || !S.masterGain) return;

  stopTone();

  const osc = S.actx.createOscillator();
  const gain = S.actx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, S.actx.currentTime);
  gain.gain.setValueAtTime(0.0001, S.actx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, S.actx.currentTime + 0.02);
  osc.connect(gain);
  gain.connect(S.masterGain);
  osc.start();
  activeOsc = osc;
  activeGain = gain;
}

export function initTunerPage(): void {
  const grid = document.getElementById('tunerNoteGrid');
  const a4Input = document.getElementById('a4Input') as HTMLInputElement | null;
  const a4DownBtn = document.getElementById('a4DownBtn');
  const a4UpBtn = document.getElementById('a4UpBtn');
  const octaveRow = document.getElementById('octaveRow');
  const stopBtn = document.getElementById('tunerStopBtn');
  if (!grid || !a4Input || !a4DownBtn || !a4UpBtn || !octaveRow || !stopBtn) return;

  const prefs = getReferenceTonePrefs();
  a4Hz = prefs.a4Hz;
  selectedOctave = OCTAVES.includes(prefs.octave) ? prefs.octave : 4;

  const renderButtons = (): void => {
    grid.innerHTML = '';
    for (const note of NOTES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-btn';
      const freq = noteFreq(note, selectedOctave);
      btn.innerHTML = `<span>${note}${selectedOctave}</span><small>${Math.round(freq)} Hz</small>`;
      btn.addEventListener('click', () => void playTone(freq));
      grid.appendChild(btn);
    }
  };

  const applyA4 = (v: number): void => {
    stopTone();
    a4Hz = Math.max(400, Math.min(480, Math.round(v)));
    a4Input.value = String(a4Hz);
    setReferenceTonePrefs({ a4Hz, octave: selectedOctave });
    renderButtons();
  };

  const renderOctaves = (): void => {
    octaveRow.innerHTML = '';
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
      octaveRow.appendChild(btn);
    }
  };

  a4Input.value = String(a4Hz);
  a4Input.addEventListener('change', () => applyA4(parseInt(a4Input.value || '440', 10) || 440));
  a4DownBtn.addEventListener('click', () => applyA4(a4Hz - 1));
  a4UpBtn.addEventListener('click', () => applyA4(a4Hz + 1));

  stopBtn.addEventListener('click', stopTone);
  renderOctaves();
  renderButtons();
}
