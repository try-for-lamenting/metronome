import { getPersistedTimers, setPersistedTimers } from './persist';

interface TimerItem {
  id: number;
  name: string;
  durationSec: number;
  remainingSec: number;
  running: boolean;
  endAtMs: number | null;
}

let timers: TimerItem[] = [];
let nextId = 1;
let tickHandle: ReturnType<typeof setInterval> | null = null;

function persistTimers(): void {
  setPersistedTimers(timers.map(t => ({
    id: t.id,
    name: t.name,
    durationSec: t.durationSec,
    remainingSec: t.remainingSec,
  })));
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function ensureTicker(render: () => void): void {
  if (tickHandle !== null) return;
  tickHandle = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const t of timers) {
      if (!t.running || t.endAtMs === null) continue;
      const left = Math.max(0, Math.round((t.endAtMs - now) / 1000));
      if (left !== t.remainingSec) {
        t.remainingSec = left;
        changed = true;
      }
      if (left <= 0) {
        t.running = false;
        t.endAtMs = null;
        changed = true;
      }
    }
    if (changed) {
      persistTimers();
      render();
    }
    if (!timers.some(t => t.running) && tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }, 250);
}

function buildTimerCard(timer: TimerItem, render: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'timer-card';

  const top = document.createElement('div');
  top.className = 'timer-top-row';
  const name = document.createElement('input');
  name.className = 'timer-name';
  name.type = 'text';
  name.maxLength = 48;
  name.value = timer.name;
  name.placeholder = 'Timer name';
  name.addEventListener('input', () => {
    timer.name = name.value;
    persistTimers();
  });
  const del = document.createElement('button');
  del.className = 'timer-del';
  del.type = 'button';
  del.textContent = 'Delete';
  del.addEventListener('click', () => {
    timers = timers.filter(t => t.id !== timer.id);
    persistTimers();
    render();
  });
  top.appendChild(name);
  top.appendChild(del);

  const controls = document.createElement('div');
  controls.className = 'timer-controls';
  const minWrap = document.createElement('div');
  minWrap.className = 'timer-field';
  const minLbl = document.createElement('label');
  minLbl.className = 'timer-field-lbl';
  minLbl.textContent = 'Minutes';
  const minInput = document.createElement('input');
  minInput.className = 'timer-num';
  minInput.type = 'number';
  minInput.min = '0';
  minInput.max = '300';
  minInput.value = String(Math.floor(timer.durationSec / 60));
  minWrap.appendChild(minLbl);
  minWrap.appendChild(minInput);

  const secWrap = document.createElement('div');
  secWrap.className = 'timer-field';
  const secLbl = document.createElement('label');
  secLbl.className = 'timer-field-lbl';
  secLbl.textContent = 'Seconds';
  const secInput = document.createElement('input');
  secInput.className = 'timer-num';
  secInput.type = 'number';
  secInput.min = '0';
  secInput.max = '59';
  secInput.value = String(timer.durationSec % 60);

  secWrap.appendChild(secLbl);
  secWrap.appendChild(secInput);

  const applyDuration = (): void => {
    const mm = Math.max(0, Math.min(300, parseInt(minInput.value || '0', 10) || 0));
    const ss = Math.max(0, Math.min(59, parseInt(secInput.value || '0', 10) || 0));
    timer.durationSec = mm * 60 + ss;
    if (!timer.running) timer.remainingSec = timer.durationSec;
    persistTimers();
    render();
  };
  minInput.addEventListener('change', applyDuration);
  secInput.addEventListener('change', applyDuration);

  const display = document.createElement('div');
  display.className = 'timer-display';
  display.textContent = fmt(timer.remainingSec);

  controls.appendChild(minWrap);
  controls.appendChild(secWrap);
  controls.appendChild(display);

  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  const startPause = document.createElement('button');
  startPause.type = 'button';
  startPause.className = 'timer-btn timer-btn-primary';
  startPause.textContent = timer.running ? 'Pause' : 'Start';
  startPause.addEventListener('click', () => {
    if (timer.running) {
      timer.running = false;
      timer.endAtMs = null;
      persistTimers();
      render();
      return;
    }
    if (timer.remainingSec <= 0) timer.remainingSec = Math.max(1, timer.durationSec);
    timer.running = true;
    timer.endAtMs = Date.now() + timer.remainingSec * 1000;
    ensureTicker(render);
    persistTimers();
    render();
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'timer-btn';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    timer.running = false;
    timer.endAtMs = null;
    timer.remainingSec = timer.durationSec;
    persistTimers();
    render();
  });

  actions.appendChild(startPause);
  actions.appendChild(reset);

  card.appendChild(top);
  card.appendChild(controls);
  card.appendChild(actions);
  return card;
}

export function initTimersPage(): void {
  const list = document.getElementById('timerList');
  const addBtn = document.getElementById('addTimerBtn');
  if (!list || !addBtn) return;

  const render = (): void => {
    list.innerHTML = '';
    for (const t of timers) list.appendChild(buildTimerCard(t, render));
  };

  const saved = getPersistedTimers();
  if (saved.length > 0) {
    timers = saved.map(s => ({
      id: s.id,
      name: s.name,
      durationSec: s.durationSec,
      remainingSec: s.remainingSec,
      running: false,
      endAtMs: null,
    }));
    nextId = timers.reduce((mx, t) => Math.max(mx, t.id), 0) + 1;
  }

  addBtn.addEventListener('click', () => {
    const durationSec = 5 * 60;
    timers.push({
      id: nextId++,
      name: `Timer ${timers.length + 1}`,
      durationSec,
      remainingSec: durationSec,
      running: false,
      endAtMs: null,
    });
    persistTimers();
    render();
  });

  if (timers.length === 0) {
    const durationSec = 5 * 60;
    timers.push({
      id: nextId++,
      name: 'Timer 1',
      durationSec,
      remainingSec: durationSec,
      running: false,
      endAtMs: null,
    });
    persistTimers();
  }

  render();
}
