import * as S from './state';

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

export function drawDisk(): void {
  const c = document.getElementById('dkc') as HTMLCanvasElement;
  const o = document.getElementById('dkout') as HTMLElement;
  const sz = o.offsetWidth || 220;
  c.width = sz; c.height = sz;
  c.style.width = sz + 'px'; c.style.height = sz + 'px';
  const ctx = c.getContext('2d')!;
  const cx = sz / 2, cy = sz / 2, R = sz / 2 - 1;
  const tx = cssVar('--tx');
  const tx2 = cssVar('--tx2');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(S.diskAngleDeg * Math.PI / 180);
  ctx.translate(-cx, -cy);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const maj = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.lineTo(cx + Math.cos(a) * (R - (maj ? 10 : 5)), cy + Math.sin(a) * (R - (maj ? 10 : 5)));
    ctx.strokeStyle = maj ? withAlpha(tx, 0.28) : withAlpha(tx2, 0.2);
    ctx.lineWidth = maj ? 2 : 1;
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = withAlpha(tx2, 0.14); ctx.lineWidth = 1; ctx.stroke();
}

function diskCtr(): { x: number; y: number } {
  const r = document.getElementById('dkr')!.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function getAng(cx: number, cy: number, ex: number, ey: number): number {
  return Math.atan2(ey - cy, ex - cx);
}

export function setupDiskDrag(onBpmChange: (b: number) => void): void {
  const rim = document.getElementById('dkr')!;
  const inner = document.getElementById('dkin')!;
  let ddrag = false;
  let dlast: number | null = null;
  let dbpmStart = 120;
  let dtotal = 0;
  let idrag = false;
  let istartY = 0;
  let ibpmStart = 120;
  let iangleStart = 0;

  rim.addEventListener('pointerdown', e => {
    const c = diskCtr();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const innerR = document.getElementById('dkout')!.offsetWidth * 0.40;
    if (dist < innerR) return;
    e.preventDefault();
    rim.setPointerCapture(e.pointerId);
    ddrag = true; dbpmStart = S.bpm; dtotal = 0;
    dlast = getAng(c.x, c.y, e.clientX, e.clientY);
  });

  rim.addEventListener('pointermove', e => {
    if (!ddrag || dlast === null) return;
    e.preventDefault();
    const c = diskCtr();
    const a = getAng(c.x, c.y, e.clientX, e.clientY);
    let delta = a - dlast;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    dtotal += delta;
    S.setDiskAngleDeg(S.diskAngleDeg + delta * 180 / Math.PI);
    drawDisk();
    const db = (dtotal / (Math.PI * 2)) * 24;
    const nb = Math.max(20, Math.min(300, Math.round(dbpmStart + db)));
    S.setBpm(nb);
    onBpmChange(nb);
    dlast = a;
  });

  const end = () => { ddrag = false; dlast = null; };
  rim.addEventListener('pointerup', end);
  rim.addEventListener('pointercancel', end);

  inner.addEventListener('pointerdown', e => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('#pbtn, #sal, #sar')) return;
    e.preventDefault();
    inner.setPointerCapture(e.pointerId);
    idrag = true;
    istartY = e.clientY;
    ibpmStart = S.bpm;
    iangleStart = S.diskAngleDeg;
  });

  inner.addEventListener('pointermove', e => {
    if (!idrag) return;
    e.preventDefault();
    const delta = (istartY - e.clientY) * 0.42;
    const nb = Math.max(20, Math.min(300, Math.round(ibpmStart + delta)));
    S.setBpm(nb);
    S.setDiskAngleDeg(iangleStart + (nb - ibpmStart) * 11);
    drawDisk();
    onBpmChange(nb);
  });

  const endInner = () => { idrag = false; };
  inner.addEventListener('pointerup', endInner);
  inner.addEventListener('pointercancel', endInner);
}
