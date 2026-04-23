import * as S from './state';
import { schedulePersistAppState } from './persist';

// sweep tracking.
let prevSweepAngle = -Math.PI / 2;
let sweepFlashUntil: Map<string, number> = new Map();

function refreshSubdivisionUi(): void {
  renderSubdivTracks();
  drawSubdivCanvas();
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const rgb = color.match(/\d+(\.\d+)?/g);
  if (rgb && rgb.length >= 3) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  return color;
}

export function renderSubdivTracks(): void {
  const list = document.getElementById('subTrackList');
  if (!list) return;
  list.innerHTML = '';

  S.subTracks.forEach((track, ti) => {
    const row = document.createElement('div');
    row.className = 'sub-row';

    // division stepper.
    const stepper = document.createElement('div');
    stepper.className = 'sub-div-stepper';
    const arrows = document.createElement('div');
    arrows.className = 'sub-div-arrows';
    const upBtn = document.createElement('div');
    upBtn.className = 'sub-step-btn'; upBtn.textContent = '▲';
    upBtn.addEventListener('click', () => {
      if (track.div >= 16) return;
      track.div++;
      track.states.push(1);
      schedulePersistAppState();
      refreshSubdivisionUi();
    });
    const numLbl = document.createElement('div');
    numLbl.className = 'sub-divlbl'; numLbl.textContent = String(track.div);
    const dnBtn = document.createElement('div');
    dnBtn.className = 'sub-step-btn'; dnBtn.textContent = '▼';
    dnBtn.addEventListener('click', () => {
      if (track.div <= 2) return;
      track.div--;
      track.states = track.states.slice(0, track.div);
      schedulePersistAppState();
      refreshSubdivisionUi();
    });
    arrows.appendChild(upBtn);
    arrows.appendChild(dnBtn);
    stepper.appendChild(arrows);
    stepper.appendChild(numLbl);
    row.appendChild(stepper);

    const beats = document.createElement('div');
    beats.className = 'sub-beats';
    for (let d = 0; d < track.div; d++) {
      const dot = document.createElement('div');
      if (d === 0) {
        dot.className = 'sb sbM';
        dot.innerHTML = '<svg viewBox="0 0 10 10" width="10" height="10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>';
      } else {
        const st = track.states[d] || 0;
        dot.className = `sb sb${st}`;
        dot.addEventListener('click', () => {
          track.states[d] = (track.states[d] + 1) % 4;
          schedulePersistAppState();
          refreshSubdivisionUi();
        });
      }
      beats.appendChild(dot);
    }
    row.appendChild(beats);

    const del = document.createElement('div');
    del.className = 'sub-del';
    del.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    del.addEventListener('click', () => {
      S.subTracks.splice(ti, 1);
      schedulePersistAppState();
      refreshSubdivisionUi();
      document.getElementById('sddisp')!.textContent = String(S.subTracks.length);
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

export function handleSubdivCanvasClick(e: MouseEvent): void {
  const canvas = document.getElementById('subdivCanvas') as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const sz = canvas.width;
  const cx = sz / 2, cy = sz / 2;
  const maxR = sz * 0.42, minR = sz * 0.14;
  const n = S.subTracks.length;
  if (n === 0) return;

  let closest: { ti: number; d: number } | null = null;
  let closestDist = 999;
  for (let ti = 0; ti < n; ti++) {
    const track = S.subTracks[ti];
    const frac = n === 1 ? 0.5 : ti / (n - 1);
    const r = minR + frac * (maxR - minR);
    for (let d = 1; d < track.div; d++) {
      const angle = (d / track.div) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r, py = cy + Math.sin(angle) * r;
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < closestDist) { closestDist = dist; closest = { ti, d }; }
    }
  }
  if (closest && closestDist < 28) {
    const { ti, d } = closest;
    S.subTracks[ti].states[d] = (S.subTracks[ti].states[d] + 1) % 4;
    schedulePersistAppState();
    refreshSubdivisionUi();
  }
}

// animate the sweep and catch crossings.
export function animateSubdivSweep(): void {
  if (!S.playing || !document.getElementById('subdivOverlay')?.classList.contains('open')) return;
  const beatDur = 60 / S.bpm;
  const now = S.actx?.currentTime ?? 0;
  // nextt is the next beat time.
  const lastBeatT = S.nextT - beatDur;
  const elapsed = Math.max(0, now - lastBeatT);
  const frac = (elapsed % beatDur) / beatDur;
  const angle = -Math.PI / 2 + frac * Math.PI * 2;

  // check crossings.
  detectSweepCrossings(prevSweepAngle, angle);
  prevSweepAngle = angle;

  drawSubdivCanvasWithSweep(angle);
}

function angleBetween(prev: number, curr: number, target: number): boolean {
  // normalize angles.
  const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const p = norm(prev), c = norm(curr), t = norm(target);
  if (p <= c) return p <= t && t < c;
  // wraparound.
  return t >= p || t < c;
}

function detectSweepCrossings(prev: number, curr: number): void {
  const n = S.subTracks.length;
  if (n === 0) return;
  const sz = getCanvasSize();
  const maxR = sz * 0.42, minR = sz * 0.14;

  for (let ti = 0; ti < n; ti++) {
    const track = S.subTracks[ti];
    const frac = n === 1 ? 0.5 : ti / (n - 1);
    const r = minR + frac * (maxR - minR);
    for (let d = 0; d < track.div; d++) {
      const dotAngle = (d / track.div) * Math.PI * 2 - Math.PI / 2;
      if (angleBetween(prev, curr, dotAngle)) {
        const key = `${ti}:${d}`;
        sweepFlashUntil.set(key, performance.now() + 100);
      }
    }
  }
}

function getCanvasSize(): number {
  const canvas = document.getElementById('subdivCanvas') as HTMLCanvasElement | null;
  return canvas?.width ?? 340;
}

export function drawSubdivCanvas(): void {
  drawSubdivCanvasWithSweep(null);
}

// draw the subdivision dot.
function drawPieDot(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, dotR: number,
  state: number, isMain: boolean
): void {
  const cy = cssVar('--cy');
  const tx = cssVar('--tx');
  const tx2 = cssVar('--tx2');
  if (isMain) {
    // main beat marker.
    ctx.beginPath(); ctx.arc(px, py, dotR + 3, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(cy, 0.12); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(cy, 0.32);
    ctx.strokeStyle = withAlpha(cy, 0.88); ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = cy;
    ctx.shadowBlur = 10; ctx.shadowColor = cy; ctx.fill(); ctx.shadowBlur = 0;
    return;
  }

  // fill fractions by state.
  const FRACTIONS = [0, 1 / 3, 2 / 3, 1];
  const FILL_COLS = [
    'transparent',
    withAlpha(cy, 0.46),
    withAlpha(cy, 0.72),
    cy,
  ];
  const STROKE_COLS = [
    withAlpha(tx2, 0.72),
    withAlpha(cy, 0.54),
    withAlpha(cy, 0.76),
    withAlpha(cy, 0.88),
  ];
  const GLOWS = [0, 0, 8, 16];

  const frac = FRACTIONS[state];
  const fillCol = FILL_COLS[state];
  const strokeCol = STROKE_COLS[state];
  const glow = GLOWS[state];

  // outer ring.
  ctx.beginPath(); ctx.arc(px, py, dotR, 0, Math.PI * 2);
  ctx.strokeStyle = strokeCol; ctx.lineWidth = 1.8;
  if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = strokeCol; }
  ctx.stroke(); ctx.shadowBlur = 0;

  if (frac > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, dotR - 1, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = fillCol;
    if (glow > 0) { ctx.shadowBlur = glow; ctx.shadowColor = strokeCol; }
    ctx.fill(); ctx.shadowBlur = 0;
  }
}

function drawSubdivCanvasWithSweep(sweepAngle: number | null): void {
  const canvas = document.getElementById('subdivCanvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const sz = canvas.offsetWidth || 340;
  if (canvas.width !== sz) { canvas.width = sz; canvas.height = sz; }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, sz, sz);

  const cx = sz / 2, cy = sz / 2;
  const maxR = sz * 0.42, minR = sz * 0.14;
  const n = S.subTracks.length;

  if (n === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(cssVar('--cy'), 0.2); ctx.lineWidth = 1; ctx.stroke();
    // start dot.
    ctx.beginPath(); ctx.arc(cx, cy - maxR, 7, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--cy');
    ctx.shadowBlur = 12; ctx.shadowColor = cssVar('--cy'); ctx.fill(); ctx.shadowBlur = 0;
    return;
  }

  for (let ti = 0; ti < n; ti++) {
    const track = S.subTracks[ti];
    const frac = n === 1 ? 0.5 : ti / (n - 1);
    const r = minR + frac * (maxR - minR);
    const hue = 180 + ti * 22;

    // sweep line.
    if (sweepAngle !== null && S.playing) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
      ctx.strokeStyle = withAlpha(cssVar('--cy'), 0.3);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // circle ring.
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(cssVar('--tx2'), 0.32); ctx.lineWidth = 1.2; ctx.stroke();

    // dots.
    const dotR = Math.max(9, sz * 0.028);
    for (let d = 0; d < track.div; d++) {
      const angle = (d / track.div) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;

      // sweep flash.
      const key = `${ti}:${d}`;
      const flashExp = sweepFlashUntil.get(key);
      const isFlashing = flashExp !== undefined && performance.now() < flashExp;

      if (isFlashing) {
        ctx.save();
        ctx.beginPath(); ctx.arc(px, py, dotR + 5, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(cssVar('--tx'), 0.3);
        ctx.fill(); ctx.restore();
      }

      drawPieDot(ctx, px, py, dotR, d === 0 ? 3 : (track.states[d] || 0), d === 0);

      // beat label.
      if (d > 0) {
        const labelR = dotR + 15;
        const lx = px + Math.cos(angle) * labelR, ly = py + Math.sin(angle) * labelR;
        ctx.fillStyle = withAlpha(cssVar('--tx'), 0.82);
        ctx.font = `bold ${Math.max(11, sz * 0.04)}px 'Rajdhani',sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(d + 1), lx, ly);
      }
    }
  }
}

export function resetSweepAngle(): void {
  prevSweepAngle = -Math.PI / 2;
}
