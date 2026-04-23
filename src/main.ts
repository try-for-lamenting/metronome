import './style.css';
import * as S from './state';
import {
  installAudioUnlock,
  nudgeAudioFromGesture,
  refreshAudioOutputLevel,
  startMetronome,
  stopMetronome,
  onAppBackground,
  onAppForeground,
} from './audio';

import { renderGrid, refreshGrid, flashCol } from './grid';
import { pendBeat, pendToEdge, startPendulum } from './pendulum';
import { drawDisk, setupDiskDrag } from './disk';
import {
  renderSubdivTracks, drawSubdivCanvas,
  animateSubdivSweep, handleSubdivCanvasClick, resetSweepAngle,
} from './subdivisions';
import {
  openAutomator, closeAutomator, renderAutoList, renderAutoEdit,
  startAutomatorSession, endAutomator, onMeasureComplete, updateHud,
  setOnStartPlayback, setOnTempoApplied,
} from './automator';
import { openSig, closeSig, openSubdiv, closeSubdiv, sigChange, renderAccents } from './dialogs';
import { largeBpmNoteIcon } from './glyphs';
import { loadPersistedAppState, schedulePersistAppState } from './persist';
import { initTunerPage, setTunerPageActive } from './tuner';
import { initTimersPage } from './timers';

// tempo names.
const TN: [number, number, string][] = [
  [20, 40, 'Grave'], [40, 60, 'Largo'], [60, 66, 'Larghetto'], [66, 76, 'Adagio'],
  [76, 108, 'Andante'], [108, 120, 'Moderato'], [120, 156, 'Allegro'], [156, 176, 'Vivace'],
  [176, 200, 'Presto'], [200, 999, 'Prestissimo'],
];
function tname(b: number): string {
  for (const [a, c, n] of TN) if (b >= a && b < c) return n;
  return '';
}

function renderVolumeIcon(level: number): void {
  const icon = document.getElementById('volIcon');
  if (!icon) return;

  const waveCount = level <= 0
    ? 0
    : level < 0.34
      ? 1
      : level < 0.67
        ? 2
        : 3;

  const waves = [
    '<path d="M13.6 10.1a2.8 2.8 0 0 1 0 3.8"/>',
    '<path d="M16.2 8.2a5.4 5.4 0 0 1 0 7.6"/>',
    '<path d="M19.1 5.4a9.2 9.2 0 0 1 0 13.2"/>',
  ].slice(0, waveCount).join('');

  const muted = waveCount === 0
    ? '<path d="M15 9l6 6"/><path d="M21 9l-6 6"/>'
    : '';

  icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>${waves}${muted}`;
}

const BASE_THEME: Record<string, string> = {
  '--bg': '#07101a',
  '--sur': '#0c1826',
  '--sur2': '#111f30',
  '--bdr': '#1a2d42',
  '--cy': '#00c8e0',
  '--cy2': 'rgba(0, 200, 224, .25)',
  '--pk': '#c04870',
  '--pk2': '#7a2e50',
  '--tx': '#b8d4ec',
  '--tx2': '#4a6880',
  '--tx3': '#1e3248',
  '--canvas-bg': '#06101a',
  '--bs0': '#05070c',
  '--bs1': '#3a1428',
  '--bs2': '#722050',
  '--bs3': '#b83868',
  '--active-ink': '#f3fbff',
  '--flash-ink': '#f3fbff',
  '--cell-flash-glow-alpha': '0.24',
  '--cell-flash-fill-alpha': '0.24',
  '--cell-flash-line-alpha': '0.42',
  '--cell-flash-tail-alpha': '0.14',
  '--slider-flash-ink': '#f3fbff',
  '--muted-ring': '#1a2d42',
  '--tick-major': '#d7efff',
  '--tick-minor': '#5f829d',
  '--tick-glow': '#00c8e0',
};

const THEMES: Record<string, Record<string, string>> = {
  'deep-cyan': {},
  ember: {
    '--bg': '#160a0d',
    '--sur': '#211015',
    '--sur2': '#2a161c',
    '--bdr': '#4f2828',
    '--cy': '#ff8c42',
    '--cy2': 'rgba(255, 140, 66, .24)',
    '--pk': '#ff4f5f',
    '--pk2': '#8f2436',
    '--tx': '#f0d2ca',
    '--tx2': '#a97f73',
    '--tx3': '#4f342f',
    '--canvas-bg': '#140c0c',
    '--bs0': '#090506',
    '--bs1': '#4a181d',
    '--bs2': '#922932',
    '--bs3': '#ff8c42',
    '--muted-ring': '#4f2828',
    '--tick-major': '#ffd8c0',
    '--tick-minor': '#a97f73',
    '--tick-glow': '#ff8c42',
  },
  aurora: {
    '--bg': '#0a1020',
    '--sur': '#11192d',
    '--sur2': '#16233c',
    '--bdr': '#294066',
    '--cy': '#45dbc3',
    '--cy2': 'rgba(69, 219, 195, .22)',
    '--pk': '#8570ff',
    '--pk2': '#4535a6',
    '--tx': '#d5def6',
    '--tx2': '#7d8aad',
    '--tx3': '#2b3656',
    '--canvas-bg': '#09101d',
    '--bs0': '#060913',
    '--bs1': '#183059',
    '--bs2': '#3d4fb0',
    '--bs3': '#7f74ff',
    '--muted-ring': '#294066',
    '--tick-major': '#e7efff',
    '--tick-minor': '#7d8aad',
    '--tick-glow': '#8570ff',
  },
  'midnight-rose': {
    '--bg': '#140d17',
    '--sur': '#1d1320',
    '--sur2': '#271a2c',
    '--bdr': '#483450',
    '--cy': '#69a7ff',
    '--cy2': 'rgba(105, 167, 255, .22)',
    '--pk': '#ff62ab',
    '--pk2': '#9a3c71',
    '--tx': '#f0dced',
    '--tx2': '#a78aa6',
    '--tx3': '#47384b',
    '--canvas-bg': '#120c15',
    '--bs0': '#080509',
    '--bs1': '#2b2357',
    '--bs2': '#7a4ca1',
    '--bs3': '#ff62ab',
    '--muted-ring': '#483450',
    '--tick-major': '#f8e6f7',
    '--tick-minor': '#a78aa6',
    '--tick-glow': '#ff62ab',
  },
  'moss-gold': {
    '--bg': '#101209',
    '--sur': '#171b11',
    '--sur2': '#202615',
    '--bdr': '#404b26',
    '--cy': '#d2c24e',
    '--cy2': 'rgba(210, 194, 78, .22)',
    '--pk': '#4daf74',
    '--pk2': '#2c6843',
    '--tx': '#e9e7cb',
    '--tx2': '#94906d',
    '--tx3': '#3b4129',
    '--canvas-bg': '#0e120a',
    '--bs0': '#080904',
    '--bs1': '#173a20',
    '--bs2': '#2f7d42',
    '--bs3': '#d2c24e',
    '--muted-ring': '#404b26',
    '--tick-major': '#f7f2cf',
    '--tick-minor': '#94906d',
    '--tick-glow': '#d2c24e',
  },
  sunset: {
    '--bg': '#fff3e6',
    '--sur': '#fffaf4',
    '--sur2': '#f0decb',
    '--bdr': '#d7b896',
    '--cy': '#d9862a',
    '--cy2': 'rgba(217, 134, 42, .2)',
    '--pk': '#e86869',
    '--pk2': '#bf7d7b',
    '--tx': '#493327',
    '--tx2': '#8a6a55',
    '--tx3': '#c0a58d',
    '--canvas-bg': '#f4e1cd',
    '--bs0': '#efe4da',
    '--bs1': '#f2c2aa',
    '--bs2': '#ec9385',
    '--bs3': '#d9862a',
    '--active-ink': '#39261b',
    '--flash-ink': '#21140c',
    '--cell-flash-glow-alpha': '0.28',
    '--cell-flash-fill-alpha': '0.28',
    '--cell-flash-line-alpha': '0.52',
    '--cell-flash-tail-alpha': '0.18',
    '--slider-flash-ink': '#21140c',
    '--muted-ring': '#bda184',
    '--tick-major': '#805427',
    '--tick-minor': '#aa876f',
    '--tick-glow': '#d9862a',
  },
  'paper-sky': {
    '--bg': '#edf4fb',
    '--sur': '#ffffff',
    '--sur2': '#dce8f5',
    '--bdr': '#adc4db',
    '--cy': '#2c7fb8',
    '--cy2': 'rgba(44, 127, 184, .22)',
    '--pk': '#ee7b86',
    '--pk2': '#c4939a',
    '--tx': '#163248',
    '--tx2': '#5f7f99',
    '--tx3': '#8da6bc',
    '--canvas-bg': '#ddeaf6',
    '--bs0': '#e7eff7',
    '--bs1': '#d6e5f6',
    '--bs2': '#a8c7eb',
    '--bs3': '#ee7b86',
    '--active-ink': '#143247',
    '--flash-ink': '#0c2030',
    '--cell-flash-glow-alpha': '0.3',
    '--cell-flash-fill-alpha': '0.3',
    '--cell-flash-line-alpha': '0.54',
    '--cell-flash-tail-alpha': '0.18',
    '--slider-flash-ink': '#0c2030',
    '--muted-ring': '#9fb7cf',
    '--tick-major': '#234665',
    '--tick-minor': '#6e8eab',
    '--tick-glow': '#2c7fb8',
  },
  'soft-stone': {
    '--bg': '#f6efe7',
    '--sur': '#fffaf5',
    '--sur2': '#e7ddd2',
    '--bdr': '#c9b8a8',
    '--cy': '#8a5cf6',
    '--cy2': 'rgba(138, 92, 246, .2)',
    '--pk': '#d58a58',
    '--pk2': '#bb8f74',
    '--tx': '#3b2d23',
    '--tx2': '#7b6a5c',
    '--tx3': '#b9aa9c',
    '--canvas-bg': '#e9ded2',
    '--bs0': '#efe8df',
    '--bs1': '#ece0f8',
    '--bs2': '#c8afe8',
    '--bs3': '#d58a58',
    '--active-ink': '#35291f',
    '--flash-ink': '#1f1712',
    '--cell-flash-glow-alpha': '0.28',
    '--cell-flash-fill-alpha': '0.28',
    '--cell-flash-line-alpha': '0.5',
    '--cell-flash-tail-alpha': '0.18',
    '--slider-flash-ink': '#1f1712',
    '--muted-ring': '#bca895',
    '--tick-major': '#4f3c30',
    '--tick-minor': '#8f7a68',
    '--tick-glow': '#8a5cf6',
  },
  'mint-sun': {
    '--bg': '#f2fff4',
    '--sur': '#ffffff',
    '--sur2': '#dcf1e0',
    '--bdr': '#aed2ba',
    '--cy': '#31b77a',
    '--cy2': 'rgba(49, 183, 122, .2)',
    '--pk': '#f0b44e',
    '--pk2': '#d49a48',
    '--tx': '#17382a',
    '--tx2': '#5f7f70',
    '--tx3': '#96b7a4',
    '--canvas-bg': '#dceede',
    '--bs0': '#eaf5e8',
    '--bs1': '#d3eed7',
    '--bs2': '#99db9d',
    '--bs3': '#f0b44e',
    '--active-ink': '#143025',
    '--flash-ink': '#10241c',
    '--cell-flash-glow-alpha': '0.3',
    '--cell-flash-fill-alpha': '0.3',
    '--cell-flash-line-alpha': '0.54',
    '--cell-flash-tail-alpha': '0.18',
    '--slider-flash-ink': '#10241c',
    '--muted-ring': '#99bea6',
    '--tick-major': '#25533f',
    '--tick-minor': '#72917f',
    '--tick-glow': '#31b77a',
  },
  'lemon-ink': {
    '--bg': '#fffce8',
    '--sur': '#fffef7',
    '--sur2': '#f0e8ba',
    '--bdr': '#d3ca8b',
    '--cy': '#345f88',
    '--cy2': 'rgba(52, 95, 136, .18)',
    '--pk': '#d8ab1d',
    '--pk2': '#b78815',
    '--tx': '#273240',
    '--tx2': '#6d7783',
    '--tx3': '#a7ad9a',
    '--canvas-bg': '#efe8be',
    '--bs0': '#f3eed2',
    '--bs1': '#e7df9d',
    '--bs2': '#d6bf53',
    '--bs3': '#345f88',
    '--active-ink': '#1b2632',
    '--flash-ink': '#121a22',
    '--cell-flash-glow-alpha': '0.28',
    '--cell-flash-fill-alpha': '0.28',
    '--cell-flash-line-alpha': '0.52',
    '--cell-flash-tail-alpha': '0.18',
    '--slider-flash-ink': '#121a22',
    '--muted-ring': '#c9bf85',
    '--tick-major': '#30485f',
    '--tick-minor': '#7f8876',
    '--tick-glow': '#345f88',
  },
};

const DARK_THEMES = ['deep-cyan', 'ember', 'aurora', 'midnight-rose', 'moss-gold'] as const;
const LIGHT_THEMES = ['sunset', 'paper-sky', 'soft-stone', 'mint-sun', 'lemon-ink'] as const;
const LIGHT_THEME_SET = new Set<string>(LIGHT_THEMES);
let activeThemeName = 'deep-cyan';
const SUN_ICON = `
  <circle cx="12" cy="12" r="4" />
  <line x1="12" y1="2" x2="12" y2="5" />
  <line x1="12" y1="19" x2="12" y2="22" />
  <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
  <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
  <line x1="2" y1="12" x2="5" y2="12" />
  <line x1="19" y1="12" x2="22" y2="12" />
  <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
  <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
`;
const MOON_ICON = `
  <path d="M20 15.2a8.4 8.4 0 1 1-11.2-11.2a7 7 0 0 0 11.2 11.2z" />
`;

function pickRandomTheme(themeNames: readonly string[], exclude?: string): string {
  const pool = exclude ? themeNames.filter(name => name !== exclude) : [...themeNames];
  const choices = pool.length ? pool : [...themeNames];
  return choices[Math.floor(Math.random() * choices.length)] ?? 'deep-cyan';
}

function resolveTheme(themeName: string): string {
  return THEMES[themeName] ? themeName : 'deep-cyan';
}

function isLightTheme(themeName: string): boolean {
  return LIGHT_THEME_SET.has(themeName);
}

function syncThemeToggleIcon(themeName: string): void {
  const icon = document.getElementById('navThemeToggleIcon');
  if (!icon) return;
  const lightMode = isLightTheme(themeName);
  icon.innerHTML = lightMode ? MOON_ICON : SUN_ICON;
  icon.setAttribute('aria-label', lightMode ? 'switch to a dark theme' : 'switch to a light theme');
}

function showPage(page: 'metronome' | 'themes' | 'tuner' | 'timer'): void {
  document.getElementById('metronomePage')!.classList.toggle('active', page === 'metronome');
  document.getElementById('themesPage')!.classList.toggle('active', page === 'themes');
  document.getElementById('tunerPage')!.classList.toggle('active', page === 'tuner');
  document.getElementById('timerPage')!.classList.toggle('active', page === 'timer');
  document.getElementById('navHome')!.classList.toggle('on', page === 'metronome');
  document.getElementById('navTuner')!.classList.toggle('on', page === 'tuner');
  document.getElementById('navTimer')!.classList.toggle('on', page === 'timer');
  document.getElementById('navThemes')!.classList.toggle('on', page === 'themes');
  setTunerPageActive(page === 'tuner');
  if (page === 'metronome') {
    requestAnimationFrame(() => drawDisk());
  }
}

function applyTheme(themeName: string): void {
  const resolvedThemeName = resolveTheme(themeName);
  activeThemeName = resolvedThemeName;
  const theme = { ...BASE_THEME, ...(THEMES[resolvedThemeName] ?? THEMES['deep-cyan']) };
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.querySelectorAll<HTMLElement>('.theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.theme === resolvedThemeName);
  });
  syncThemeToggleIcon(resolvedThemeName);
  drawDisk();
  updateUI();
}

function toggleDarkLightTheme(): void {
  const nextThemes = LIGHT_THEME_SET.has(activeThemeName) ? DARK_THEMES : LIGHT_THEMES;
  applyTheme(pickRandomTheme(nextThemes, activeThemeName));
}

// ui update.
function updateUI(): void {
  document.getElementById('bnum')!.textContent = String(S.bpm);
  document.getElementById('tlbl')!.textContent = tname(S.bpm);
  const sig = `${S.sn}/${S.sd}`;
  document.getElementById('sigdisp')!.textContent = sig;
  document.getElementById('sigbtn')!.textContent = sig;
  document.getElementById('snv')!.textContent = String(S.sn);
  document.getElementById('sdv')!.textContent = String(S.sd);
  document.getElementById('sddisp')!.textContent = String(S.subTracks.length);
  // bpm note icon.
  const wrap = document.getElementById('noteIcon')!;
  wrap.innerHTML = largeBpmNoteIcon(S.sd);
  wrap.style.color = 'var(--cy)';
  if (updateHud) updateHud();
  schedulePersistAppState();
}

// play state.
async function startPlay(): Promise<void> {
  const started = await startMetronome();
  if (!started) return;
  resetSweepAngle();
  startVis();
  document.getElementById('pp')!.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
  document.getElementById('pbtn')!.classList.add('pl');
  refreshGrid();
}

function stopPlay(): void {
  stopMetronome();
  document.getElementById('pp')!.setAttribute('d', 'M8 5v14l11-7z');
  document.getElementById('pbtn')!.classList.remove('pl');
  pendToEdge();
  refreshGrid();
}

let lastPlayToggleTs = 0;

function togglePlay(): void {
  const now = performance.now();
  if (now - lastPlayToggleTs < 220) return;
  lastPlayToggleTs = now;
  if (S.playing) {
    stopPlay();
    return;
  }
  void startPlay();
}

// automator playback hooks.
setOnStartPlayback(startPlay);
setOnTempoApplied(updateUI);

// visual loop.
let vraf: number | null = null;

function startVis(): void {
  if (vraf) cancelAnimationFrame(vraf);
  visLoop();
}

function visLoop(): void {
  if (!S.playing) { vraf = null; return; }
  if (!S.actx) { vraf = requestAnimationFrame(visLoop); return; }
  const now = S.actx.currentTime;

  for (let i = S.vq.length - 1; i >= 0; i--) {
    const it = S.vq[i];
    if (it.t <= now + 0.018) {
      if (!it.isSub) {
        flashCol(it.b);
        // highlight the beat that just fired.
        refreshGrid(it.b);
        pendBeat();
        if (it.b === 0) onMeasureComplete();
      }
      S.vq.splice(i, 1);
    }
  }
  animateSubdivSweep();
  vraf = requestAnimationFrame(visLoop);
}

// tap tempo.
const taps: number[] = [];
function doTap(): void {
  const now = Date.now();
  while (taps.length && now - taps[0] > 3000) taps.shift();
  taps.push(now);
  if (taps.length >= 2) {
    let s = 0;
    for (let i = 1; i < taps.length; i++) s += taps[i] - taps[i - 1];
    S.setBpm(Math.max(20, Math.min(300, Math.round(60000 / (s / (taps.length - 1))))));
    updateUI();
  }
  if (taps.length > 8) taps.shift();
}

let bpmPadValue = '';

function closeBpmPad(): void {
  document.getElementById('bpmPadOverlay')?.classList.remove('open');
}

function openBpmPad(): void {
  bpmPadValue = String(S.bpm);
  const display = document.getElementById('bpmPadDisplay');
  if (display) display.textContent = bpmPadValue;
  document.getElementById('bpmPadOverlay')?.classList.add('open');
}

function syncBpmPadDisplay(): void {
  const display = document.getElementById('bpmPadDisplay');
  if (!display) return;
  display.textContent = bpmPadValue || '0';
}

function applyBpmPadValue(): void {
  if (!bpmPadValue) return;
  S.setBpm(parseInt(bpmPadValue, 10));
  updateUI();
}

// boot.
function boot(): void {
  S.setBs(Array.from({ length: S.sn }, (_, i) => i === 0 ? 3 : 1));
  loadPersistedAppState();
  installAudioUnlock();
  applyTheme('deep-cyan');
  showPage('metronome');
  initTunerPage();
  initTimersPage();
  renderGrid();
  updateUI();
  drawDisk();
  startPendulum();

  setupDiskDrag(() => updateUI());

  // bpm drag.
  const bnumEl = document.getElementById('bnum')!;
  let bdy: number | null = null, bdstart = S.bpm;
  let bdragged = false;
  let bdownTs = 0;
  bnumEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    bnumEl.setPointerCapture(e.pointerId);
    bdy = e.clientY; bdstart = S.bpm;
    bdragged = false;
    bdownTs = performance.now();
  });
  bnumEl.addEventListener('pointermove', e => {
    if (bdy === null) return;
    if (Math.abs(bdy - e.clientY) > 3) bdragged = true;
    S.setBpm(Math.round(bdstart + (bdy - e.clientY) * 0.55));
    updateUI();
  });
  bnumEl.addEventListener('pointerup', () => {
    const heldMs = performance.now() - bdownTs;
    if (!bdragged && heldMs < 260) openBpmPad();
    bdy = null;
  });
  const bEnd = () => { bdy = null; bdragged = false; };
  bnumEl.addEventListener('pointerup', bEnd);
  bnumEl.addEventListener('pointercancel', bEnd);

  // bpm step buttons.
  document.getElementById('bup')!.addEventListener('click', () => { S.setBpm(S.bpm + 1); updateUI(); });
  document.getElementById('bdn')!.addEventListener('click', () => { S.setBpm(S.bpm - 1); updateUI(); });

  // signature stepper.
  const DENS = [1, 2, 4, 8, 16, 32];
  document.getElementById('snup')!.addEventListener('click', () => { S.setSn(S.sn + 1); sigChange(); updateUI(); });
  document.getElementById('sndn')!.addEventListener('click', () => { S.setSn(S.sn - 1); sigChange(); updateUI(); });
  document.getElementById('sdup')!.addEventListener('click', () => {
    const i = DENS.indexOf(S.sd);
    if (i < DENS.length - 1) { S.setSd(DENS[i + 1]); updateUI(); renderAccents(); }
  });
  document.getElementById('sddn')!.addEventListener('click', () => {
    const i = DENS.indexOf(S.sd);
    if (i > 0) { S.setSd(DENS[i - 1]); updateUI(); renderAccents(); }
  });

  // play button.
  const pbtn = document.getElementById('pbtn')!;
  const onPlayPress = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    nudgeAudioFromGesture();
    togglePlay();
  };
  pbtn.addEventListener('pointerdown', e => e.stopPropagation());
  pbtn.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  pbtn.addEventListener('pointerup', onPlayPress);
  pbtn.addEventListener('touchend', onPlayPress, { passive: false });
  pbtn.addEventListener('click', onPlayPress);
  pbtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') onPlayPress(e);
  });

  // tap.
  document.getElementById('tapbtn')!.addEventListener('click', doTap);

  // bpm numpad.
  document.getElementById('bpmPadOverlay')!.addEventListener('click', e => {
    if (e.target === document.getElementById('bpmPadOverlay')) closeBpmPad();
  });
  document.getElementById('bpmPad')!.addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll<HTMLElement>('.bpm-pad-key[data-digit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const digit = btn.dataset.digit ?? '';
      if (!digit) return;
      if (bpmPadValue === '0') bpmPadValue = digit;
      else if (bpmPadValue.length < 3) bpmPadValue += digit;
      syncBpmPadDisplay();
    });
  });
  document.getElementById('bpmPadClear')!.addEventListener('click', () => {
    bpmPadValue = '';
    syncBpmPadDisplay();
  });
  document.getElementById('bpmPadBack')!.addEventListener('click', () => {
    bpmPadValue = bpmPadValue.slice(0, -1);
    syncBpmPadDisplay();
  });
  document.getElementById('bpmPadOk')!.addEventListener('click', () => {
    applyBpmPadValue();
    closeBpmPad();
  });

  // signature dialog.
  document.getElementById('sigbtn')!.addEventListener('click', openSig);
  document.getElementById('sigdisp')!.addEventListener('click', openSig);
  document.getElementById('sigClose')!.addEventListener('click', closeSig);
  document.getElementById('sigOverlay')!.addEventListener('click', e => { if (e.target === document.getElementById('sigOverlay')) closeSig(); });
  document.getElementById('openSubdiv')!.addEventListener('click', () => { closeSig(); openSubdiv(); renderSubdivTracks(); setTimeout(drawSubdivCanvas, 60); });
  document.getElementById('sddisp')!.addEventListener('click', () => { openSubdiv(); renderSubdivTracks(); setTimeout(drawSubdivCanvas, 60); });

  // subdivision dialog.
  document.getElementById('backToSig')!.addEventListener('click', () => { closeSubdiv(); openSig(); });
  document.getElementById('subdivClose')!.addEventListener('click', closeSubdiv);
  document.getElementById('subdivOverlay')!.addEventListener('click', e => { if (e.target === document.getElementById('subdivOverlay')) closeSubdiv(); });
  document.getElementById('subdivCanvas')!.addEventListener('click', handleSubdivCanvasClick);
  document.getElementById('addTrackBtn')!.addEventListener('click', () => {
    const div = 3;
    const states = Array(div).fill(0);
    for (let i = 1; i < div; i++) states[i] = 1;
    S.subTracks.push({ div, states });
    schedulePersistAppState();
    renderSubdivTracks(); drawSubdivCanvas();
    updateUI();
  });

  // volume.
  const volPopup = document.getElementById('volPopup')!;
  document.getElementById('tico-vol')!.addEventListener('click', e => { e.stopPropagation(); volPopup.classList.toggle('open'); });
  document.addEventListener('click', () => volPopup.classList.remove('open'));
  volPopup.addEventListener('click', e => e.stopPropagation());
  const volSlider = document.getElementById('volSlider') as HTMLInputElement;
  const volLbl = document.getElementById('volLbl')!;
  renderVolumeIcon(parseInt(volSlider.value) / 100);
  volSlider.addEventListener('input', () => {
    S.setMasterVol(parseInt(volSlider.value) / 100);
    refreshAudioOutputLevel();
    volLbl.textContent = Math.round(S.masterVol * 100) + '%';
    renderVolumeIcon(S.masterVol);
  });

  // automator.
  document.getElementById('tico-timer')!.addEventListener('click', openAutomator);
  document.getElementById('autoClose')!.addEventListener('click', closeAutomator);
  document.getElementById('autoOverlay')!.addEventListener('click', e => { if (e.target === document.getElementById('autoOverlay')) closeAutomator(); });
  document.getElementById('autoBack')!.addEventListener('click', renderAutoList);
  document.getElementById('hudPause')!.addEventListener('click', () => {
    S.setAutoPaused(!S.autoPaused);
    document.getElementById('hudPause')!.textContent = S.autoPaused ? 'Resume' : 'Pause';
  });
  document.getElementById('hudEnd')!.addEventListener('click', endAutomator);

  // page nav.
  document.getElementById('navHome')!.addEventListener('click', () => showPage('metronome'));
  document.getElementById('navTuner')!.addEventListener('click', () => showPage('tuner'));
  document.getElementById('navTimer')!.addEventListener('click', () => showPage('timer'));
  document.getElementById('navThemeToggle')!.addEventListener('click', toggleDarkLightTheme);
  document.getElementById('navThemes')!.addEventListener('click', () => showPage('themes'));
  document.querySelectorAll<HTMLElement>('.theme-card').forEach(card => {
    card.addEventListener('click', () => applyTheme(card.dataset.theme || 'deep-cyan'));
  });

  window.addEventListener('resize', () => { drawDisk(); drawSubdivCanvas(); });

  // ios background handling.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      onAppBackground();
    } else {
      // wait for audio before restarting visuals.
      void onAppForeground().then(() => {
        if (S.playing) startVis();
      });
    }
  });
}

window.addEventListener('load', boot);
