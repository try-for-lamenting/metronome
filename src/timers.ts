import { getPersistedTimers, setPersistedTimers } from './persist';
import { isTimerAlarmPlaying, playTimerAlarm, stopTimerAlarm } from './audio';

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
let completedTimerIds: number[] = [];
let activeTimerNotifications = new Map<number, Notification>();
let renderTimers: (() => void) | null = null;
let timerDisplayEls = new Map<number, HTMLElement>();
let onOpenTimerPad: ((value: number, min: number, max: number, onChange: (v: number) => void) => void) | null = null;

export function setOnOpenTimerPad(
  fn: (value: number, min: number, max: number, onChange: (v: number) => void) => void
): void {
  onOpenTimerPad = fn;
}

async function requestNotificationAccessOnLoad(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch {
    // ignore notification permission failures.
  }
}

function renderTimerNotices(): void {
  const stack = document.getElementById('timerDoneStack');
  if (!stack) return;
  stack.replaceChildren();
  for (const timerId of completedTimerIds) {
    const timer = timers.find(t => t.id === timerId);
    if (!timer) continue;

    const card = document.createElement('div');
    card.className = 'timer-done-card';

    const title = document.createElement('div');
    title.className = 'timer-done-title';
    title.textContent = 'Timer Complete';

    const text = document.createElement('div');
    text.className = 'timer-done-text';
    text.textContent = `${timer.name.trim() || `Timer ${timer.id}`} is over.`;

    const actions = document.createElement('div');
    actions.className = 'timer-done-actions';

    const dismiss = document.createElement('button');
    dismiss.className = 'timer-done-dismiss';
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => dismissTimerAlarm(timer.id));

    actions.appendChild(dismiss);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(actions);
    stack.appendChild(card);
  }
}

function removeCompletedTimer(timerId: number): boolean {
  const index = completedTimerIds.indexOf(timerId);
  if (index === -1) return false;
  completedTimerIds.splice(index, 1);
  renderTimerNotices();
  return true;
}

function dismissTimerAlarm(timerId: number, resetTimer = true): void {
  activeTimerNotifications.get(timerId)?.close();
  activeTimerNotifications.delete(timerId);
  const removed = removeCompletedTimer(timerId);
  const timer = timers.find(t => t.id === timerId);
  if (timer && resetTimer) {
    timer.running = false;
    timer.endAtMs = null;
    timer.remainingSec = timer.durationSec;
  }
  if (removed || timer) {
    persistTimers();
    renderTimers?.();
  }
  if (completedTimerIds.length === 0) {
    stopTimerAlarm();
  }
}

async function maybeShowBackgroundNotification(timerId: number, message: string): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (!document.hidden) return;
  if (Notification.permission === 'granted') {
    const notification = new Notification('Timer Complete', {
      body: `${message} Click to dismiss.`,
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      dismissTimerAlarm(timerId);
    };
    notification.onclose = () => {
      if (activeTimerNotifications.get(timerId) === notification) {
        activeTimerNotifications.delete(timerId);
      }
    };
    activeTimerNotifications.set(timerId, notification);
    return;
  }
}

function handleTimerCompletion(timer: TimerItem): void {
  const label = timer.name.trim() || `Timer ${timer.id}`;
  const message = `${label} is over.`;
  if (!completedTimerIds.includes(timer.id)) completedTimerIds.push(timer.id);
  if (!isTimerAlarmPlaying()) playTimerAlarm();
  renderTimerNotices();
  void maybeShowBackgroundNotification(timer.id, message);
  renderTimers?.();
}

function persistTimers(): void {
  setPersistedTimers(timers.map(t => ({
    id: t.id,
    name: t.name,
    durationSec: t.durationSec,
    remainingSec: t.remainingSec,
    running: t.running,
    endAtMs: t.endAtMs,
  })));
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function syncTimerDisplay(timer: TimerItem): void {
  const display = timerDisplayEls.get(timer.id);
  if (!display) return;
  display.textContent = fmt(timer.remainingSec);
}

function syncAllTimerDisplays(): void {
  for (const timer of timers) {
    const display = timerDisplayEls.get(timer.id);
    if (!display) continue;
    display.textContent = fmt(timer.remainingSec);
  }
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
        syncTimerDisplay(t);
        changed = true;
      }
      if (left <= 0) {
        t.running = false;
        t.endAtMs = null;
        t.remainingSec = 0;
        handleTimerCompletion(t);
        changed = true;
      }
    }
    if (changed) {
      persistTimers();
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
    if (completedTimerIds.includes(timer.id)) {
      dismissTimerAlarm(timer.id, false);
    }
    activeTimerNotifications.get(timer.id)?.close();
    activeTimerNotifications.delete(timer.id);
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
  minInput.type = 'text';
  minInput.readOnly = true;
  minInput.inputMode = 'none';
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
  secInput.type = 'text';
  secInput.readOnly = true;
  secInput.inputMode = 'none';
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

  minInput.addEventListener('click', () => {
    onOpenTimerPad?.(parseInt(minInput.value, 10) || 0, 0, 300, value => {
      minInput.value = String(value);
      applyDuration();
    });
  });
  secInput.addEventListener('click', () => {
    onOpenTimerPad?.(parseInt(secInput.value, 10) || 0, 0, 59, value => {
      secInput.value = String(value);
      applyDuration();
    });
  });

  const display = document.createElement('div');
  display.className = 'timer-display';
  display.textContent = fmt(timer.remainingSec);
  timerDisplayEls.set(timer.id, display);

  controls.appendChild(minWrap);
  controls.appendChild(secWrap);
  controls.appendChild(display);

  const actions = document.createElement('div');
  actions.className = 'timer-actions';
  const startPause = document.createElement('button');
  startPause.type = 'button';
  startPause.className = 'timer-btn timer-btn-primary';
  const timerDoneActive = completedTimerIds.includes(timer.id);
  startPause.textContent = timerDoneActive ? (isTimerAlarmPlaying() ? 'Stop Alarm' : 'Dismiss') : (timer.running ? 'Pause' : 'Start');
  startPause.addEventListener('click', () => {
    if (timerDoneActive) {
      dismissTimerAlarm(timer.id);
      return;
    }
    if (timer.running) {
      const now = Date.now();
      timer.remainingSec = timer.endAtMs === null ? timer.remainingSec : Math.max(0, Math.ceil((timer.endAtMs - now) / 1000));
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
    if (completedTimerIds.includes(timer.id)) {
      dismissTimerAlarm(timer.id, false);
    }
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
    timerDisplayEls = new Map();
    list.innerHTML = '';
    for (const t of timers) list.appendChild(buildTimerCard(t, render));
    syncAllTimerDisplays();
  };
  renderTimers = render;
  void requestNotificationAccessOnLoad();

  const saved = getPersistedTimers();
  if (saved.length > 0) {
    const now = Date.now();
    timers = saved.map(s => ({
      id: s.id,
      name: s.name,
      durationSec: s.durationSec,
      remainingSec: s.running && s.endAtMs ? Math.max(0, Math.ceil((s.endAtMs - now) / 1000)) : s.remainingSec,
      running: s.running === true && !!s.endAtMs && s.endAtMs > now,
      endAtMs: s.running === true && !!s.endAtMs && s.endAtMs > now ? s.endAtMs : null,
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
  if (timers.some(t => t.running)) ensureTicker(render);
  renderTimerNotices();
}
