import * as S from './state';
import type { AutoSession } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatTime(secs: number): string {
  if (secs < 60) return Math.round(secs) + 's';
  const m = Math.floor(secs / 60), s = Math.round(secs % 60);
  return `${m}m${s > 0 ? s + 's' : ''}`;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function openAutomator(): void {
  document.getElementById('autoOverlay')!.classList.add('open');
  renderAutoList();
}

export function closeAutomator(): void {
  document.getElementById('autoOverlay')!.classList.remove('open');
}

// ─── List view ───────────────────────────────────────────────────────────────

export function renderAutoList(): void {
  document.getElementById('autoTitle')!.textContent = 'AUTOMATOR';
  const backEl = document.getElementById('autoBack')!;
  backEl.style.display = 'none';
  const c = document.getElementById('autoContent')!;
  c.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'auto-list';
  S.autoSessions.forEach((sess, i) => {
    const item = document.createElement('div');
    item.className = 'auto-item';
    const phases = Math.ceil((sess.endBpm - sess.startBpm) / Math.max(1, sess.incr));
    const totalMeasures = phases * sess.period;
    const secPerMeasure = (60 / ((sess.startBpm + sess.endBpm) / 2)) * S.sn;
    const totalSec = totalMeasures * secPerMeasure;
    item.innerHTML = `<div class="auto-item-name">${sess.name}</div><div class="auto-item-info">${sess.startBpm}→${sess.endBpm} BPM · ${totalMeasures} measures · ~${formatTime(totalSec)}</div>`;
    item.addEventListener('click', () => renderAutoEdit(i));
    list.appendChild(item);
  });
  c.appendChild(list);

  const addBtn = document.createElement('div');
  addBtn.className = 'auto-add-btn';
  addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Session`;
  addBtn.addEventListener('click', () => {
    S.autoSessions.push({ name: 'Session ' + (S.autoSessions.length + 1), startBpm: 80, endBpm: 160, period: 8, incr: 5 });
    renderAutoEdit(S.autoSessions.length - 1);
  });
  c.appendChild(addBtn);
}

// ─── Edit view ────────────────────────────────────────────────────────────────

/** Build a compact numeric stepper: [−] [input] [+] with optional tap row. */
function makeNumStepper(
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void,
  withTap = false
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';

  const row = document.createElement('div');
  row.className = 'num-stepper';

  const dnBtn = document.createElement('button');
  dnBtn.className = 'ns-btn'; dnBtn.textContent = '−'; dnBtn.type = 'button';

  const inp = document.createElement('input');
  inp.type = 'number'; inp.value = String(value); inp.min = String(min); inp.max = String(max);

  const upBtn = document.createElement('button');
  upBtn.className = 'ns-btn'; upBtn.textContent = '+'; upBtn.type = 'button';

  const emit = (v: number) => {
    const clamped = Math.max(min, Math.min(max, v));
    inp.value = String(clamped);
    onChange(clamped);
  };

  dnBtn.addEventListener('click', () => emit((parseInt(inp.value) || value) - step));
  upBtn.addEventListener('click', () => emit((parseInt(inp.value) || value) + step));
  inp.addEventListener('input', () => emit(parseInt(inp.value) || min));

  row.appendChild(dnBtn); row.appendChild(inp); row.appendChild(upBtn);
  wrap.appendChild(row);

  if (withTap) {
    const tapRow = document.createElement('div');
    tapRow.className = 'ns-tap';
    tapRow.textContent = 'TAP';
    const taps: number[] = [];
    tapRow.addEventListener('click', () => {
      const now = Date.now();
      while (taps.length && now - taps[0] > 3000) taps.shift();
      taps.push(now);
      if (taps.length >= 2) {
        let s = 0;
        for (let i = 1; i < taps.length; i++) s += taps[i] - taps[i - 1];
        const tapBpm = Math.max(min, Math.min(max, Math.round(60000 / (s / (taps.length - 1)))));
        emit(tapBpm);
      }
    });
    wrap.appendChild(tapRow);
  }
  return wrap;
}

export function renderAutoEdit(idx: number): void {
  document.getElementById('autoTitle')!.textContent = 'SESSION';
  const backEl = document.getElementById('autoBack')!;
  backEl.style.display = 'flex';
  const sess = S.autoSessions[idx];
  const c = document.getElementById('autoContent')!;
  c.innerHTML = '';

  // Name field
  const nameWrap = document.createElement('div');
  nameWrap.className = 'auto-field full';
  nameWrap.innerHTML = `<label>Session Name</label>`;
  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.value = sess.name;
  nameInp.addEventListener('input', () => { sess.name = nameInp.value; updateEstimate(); });
  nameWrap.appendChild(nameInp);
  c.appendChild(nameWrap);

  // BPM row: start + end side by side
  const bpmRow = document.createElement('div');
  bpmRow.className = 'auto-row';

  const startWrap = document.createElement('div'); startWrap.className = 'auto-field';
  const startLbl = document.createElement('label'); startLbl.textContent = 'Start BPM';
  const startStepper = makeNumStepper(sess.startBpm, 20, 299, 1, v => { sess.startBpm = v; updateEstimate(); }, true);
  startWrap.appendChild(startLbl); startWrap.appendChild(startStepper);

  const endWrap = document.createElement('div'); endWrap.className = 'auto-field';
  const endLbl = document.createElement('label'); endLbl.textContent = 'End BPM';
  const endStepper = makeNumStepper(sess.endBpm, 21, 300, 1, v => { sess.endBpm = v; updateEstimate(); }, true);
  endWrap.appendChild(endLbl); endWrap.appendChild(endStepper);

  bpmRow.appendChild(startWrap); bpmRow.appendChild(endWrap);
  c.appendChild(bpmRow);

  // Period + Increment row
  const piRow = document.createElement('div');
  piRow.className = 'auto-row';

  const periodWrap = document.createElement('div'); periodWrap.className = 'auto-field';
  const periodLbl = document.createElement('label'); periodLbl.textContent = 'Measures / Step';
  const periodStepper = makeNumStepper(sess.period, 1, 256, 1, v => { sess.period = v; updateEstimate(); });
  periodWrap.appendChild(periodLbl); periodWrap.appendChild(periodStepper);

  const incrWrap = document.createElement('div'); incrWrap.className = 'auto-field';
  const incrLbl = document.createElement('label'); incrLbl.textContent = 'BPM Increase';
  const incrStepper = makeNumStepper(sess.incr, 1, 50, 1, v => { sess.incr = v; updateEstimate(); });
  incrWrap.appendChild(incrLbl); incrWrap.appendChild(incrStepper);

  piRow.appendChild(periodWrap); piRow.appendChild(incrWrap);
  c.appendChild(piRow);

  // Error
  const errDiv = document.createElement('div');
  errDiv.className = 'auto-err'; errDiv.style.display = 'none';
  c.appendChild(errDiv);

  // Estimate
  const estDiv = document.createElement('div');
  estDiv.className = 'auto-estimate';
  estDiv.innerHTML = `<div class="auto-estimate-val" id="estVal">—</div><div class="auto-estimate-lbl">Estimated Duration</div>`;
  c.appendChild(estDiv);

  function updateEstimate(): void {
    const phases = Math.max(0, Math.ceil((sess.endBpm - sess.startBpm) / Math.max(1, sess.incr)));
    const totalMeasures = phases * sess.period;
    const secPerMeasure = (60 / Math.max(20, (sess.startBpm + sess.endBpm) / 2)) * S.sn;
    const totalSec = totalMeasures * secPerMeasure;
    const el = document.getElementById('estVal');
    if (el) el.textContent = formatTime(totalSec);
  }
  updateEstimate();

  // Save
  const saveBtn = document.createElement('div');
  saveBtn.className = 'auto-save-btn';
  saveBtn.textContent = 'Start Session';
  saveBtn.addEventListener('click', () => {
    errDiv.style.display = 'none';
    if (sess.startBpm >= sess.endBpm) {
      errDiv.textContent = 'Start BPM must be less than end BPM';
      errDiv.style.display = 'block'; return;
    }
    if (sess.incr <= 0) {
      errDiv.textContent = 'Increment must be > 0';
      errDiv.style.display = 'block'; return;
    }
    closeAutomator();
    startAutomatorSession(idx);
  });
  c.appendChild(saveBtn);

  const delBtn = document.createElement('div');
  delBtn.className = 'auto-del-btn';
  delBtn.textContent = 'Delete Session';
  delBtn.addEventListener('click', () => { S.autoSessions.splice(idx, 1); renderAutoList(); });
  c.appendChild(delBtn);
}

// ─── Runtime ─────────────────────────────────────────────────────────────────

let onStartPlayback: (() => void) | null = null;
export function setOnStartPlayback(fn: () => void): void { onStartPlayback = fn; }

let onTempoApplied: (() => void) | null = null;
export function setOnTempoApplied(fn: () => void): void { onTempoApplied = fn; }

let pendingStartIdx: number | null = null;
let skipBoundaryOnce = false;

function applyAutomatorTempo(bpm: number): void {
  S.setBpm(bpm);
  onTempoApplied?.();
}

function prepareSession(idx: number): void {
  S.setAutoSession(S.autoSessions[idx]);
  S.setAutoPaused(false);
  S.setAutoPhase(0);
  S.setAutoPhaseBar(0);
  S.setAutoBeatInMeasure(0);
  const phases = Math.ceil((S.autoSession!.endBpm - S.autoSession!.startBpm) / S.autoSession!.incr);
  S.setAutoBarCount(phases * S.autoSession!.period);
  document.getElementById('autoHud')!.classList.add('show');
  document.getElementById('hudPause')!.textContent = 'Pause';
  buildHudBars(phases);
}

function activatePreparedSession(): void {
  if (!S.autoSession) return;
  pendingStartIdx = null;
  skipBoundaryOnce = true;
  S.setAutoRunning(true);
  S.setAutoBeatInMeasure(0);
  applyAutomatorTempo(S.autoSession.startBpm);
  updateHud();
}

export function startAutomatorSession(idx: number): void {
  pendingStartIdx = null;
  prepareSession(idx);
  if (S.playing) {
    S.setAutoRunning(false);
    updateHud();
    pendingStartIdx = idx;
    return;
  }

  S.setAutoRunning(false);
  activatePreparedSession();
  if (!S.playing) onStartPlayback?.();
  updateHud();
}

/** Called every completed measure from the scheduler. */
export function onMeasureComplete(): void {
  if (pendingStartIdx !== null) {
    activatePreparedSession();
    return;
  }
  if (!S.autoRunning || S.autoPaused || !S.autoSession) return;
  if (skipBoundaryOnce) {
    skipBoundaryOnce = false;
    return;
  }
  S.setAutoBarCount(S.autoBarCount - 1);
  const completedMeasures = S.autoPhaseBar + 1;

  if (completedMeasures >= S.autoSession.period) {
    S.setAutoPhaseBar(0);
    const nextPhase = S.autoPhase + 1;
    S.setAutoPhase(nextPhase);
    const newBpm = S.autoSession.startBpm + nextPhase * S.autoSession.incr;
    if (newBpm >= S.autoSession.endBpm) {
      applyAutomatorTempo(S.autoSession.endBpm);
      endAutomator();
    } else {
      applyAutomatorTempo(newBpm);
    }
  } else {
    S.setAutoPhaseBar(completedMeasures);
  }
  updateHud();
}

export function endAutomator(): void {
  pendingStartIdx = null;
  skipBoundaryOnce = false;
  S.setAutoRunning(false);
  S.setAutoSession(null);
  document.getElementById('hudPause')!.textContent = 'Pause';
  document.getElementById('autoHud')!.classList.remove('show');
}

function buildHudBars(phases: number): void {
  const viz = document.getElementById('hudBarViz')!;
  viz.innerHTML = '';
  for (let i = 0; i < Math.min(phases, 40); i++) {
    const bar = document.createElement('div');
    bar.className = 'hud-bar';
    const fill = document.createElement('div');
    fill.className = 'hud-bar-fill';
    bar.appendChild(fill);
    viz.appendChild(bar);
  }
}

export function updateHud(): void {
  if (!S.autoSession) return;
  const session = S.autoSession;
  document.getElementById('hudName')!.textContent = session.name.toUpperCase();
  document.getElementById('hudBpm')!.textContent = String(S.bpm);
  document.getElementById('hudBars')!.textContent = String(Math.max(0, S.autoBarCount));
  document.getElementById('hudPhase')!.textContent = String(S.autoPhase + 1);
  const phases = Math.ceil((session.endBpm - session.startBpm) / Math.max(1, session.incr));
  const secPerMeasure = (60 / Math.max(20, (S.bpm + session.endBpm) / 2)) * S.sn;
  const secsLeft = Math.max(0, S.autoBarCount) * secPerMeasure;
  document.getElementById('hudTime')!.textContent = formatTime(secsLeft);

  const viz = document.getElementById('hudBarViz')!;
  const bars = viz.querySelectorAll<HTMLElement>('.hud-bar');
  bars.forEach((bar, i) => {
    const barPhase = Math.floor(i * phases / bars.length);
    const fill = bar.querySelector<HTMLElement>('.hud-bar-fill');
    if (!fill) return;

    const progress = barPhase < S.autoPhase
      ? 1
      : barPhase === S.autoPhase
        ? S.autoPhaseBar / session.period
        : 0;

    fill.style.height = `${progress * 100}%`;
    fill.style.opacity = progress <= 0 ? '0' : String(0.42 + 0.43 * progress);
    bar.classList.toggle('is-active', barPhase === S.autoPhase);
    bar.classList.toggle('is-complete', barPhase < S.autoPhase);
  });
}
