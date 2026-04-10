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
  const accent = cssVar('--cy');
  const tickMajor = cssVar('--tick-major') || tx;
  const tickMinor = cssVar('--tick-minor') || tx2;
  const tickGlow = cssVar('--tick-glow') || accent;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(S.diskAngleDeg * Math.PI / 180);
  ctx.translate(-cx, -cy);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const maj = i % 5 === 0;
    const outerR = R - (maj ? 1 : 2);
    const innerR = R - (maj ? 12 : 9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
    ctx.lineTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
    ctx.strokeStyle = maj ? withAlpha(tickMajor, 0.7) : withAlpha(tickMinor, 0.5);
    ctx.lineWidth = maj ? 2.2 : 1.5;
    ctx.lineCap = 'round';
    ctx.shadowBlur = maj ? 4 : 2;
    ctx.shadowColor = maj ? withAlpha(tickGlow, 0.2) : withAlpha(tickGlow, 0.12);
    ctx.stroke();
  }
  ctx.restore();
  ctx.shadowBlur = 0;
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
  let activeTarget: HTMLElement | null = null;
  let dragLast: number | null = null;
  let dragBpmStart = 120;
  let dragTotal = 0;

  const updateRotationDrag = (e: PointerEvent): void => {
    if (!activeTarget || dragLast === null) return;
    e.preventDefault();
    const c = diskCtr();
    const a = getAng(c.x, c.y, e.clientX, e.clientY);
    let delta = a - dragLast;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    dragTotal += delta;
    S.setDiskAngleDeg(S.diskAngleDeg + delta * 180 / Math.PI);
    drawDisk();
    const db = (dragTotal / (Math.PI * 2)) * 24;
    const nb = Math.max(20, Math.min(300, Math.round(dragBpmStart + db)));
    S.setBpm(nb);
    onBpmChange(nb);
    dragLast = a;
  };

  const endRotationDrag = (): void => {
    activeTarget = null;
    dragLast = null;
  };

  const beginRotationDrag = (target: HTMLElement, e: PointerEvent): void => {
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    activeTarget = target;
    dragBpmStart = S.bpm;
    dragTotal = 0;
    const c = diskCtr();
    dragLast = getAng(c.x, c.y, e.clientX, e.clientY);
  };

  rim.addEventListener('pointerdown', e => {
    const c = diskCtr();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const innerRadius = document.getElementById('dkout')!.offsetWidth * 0.40;
    if (dist < innerRadius) return;
    beginRotationDrag(rim, e);
  });

  rim.addEventListener('pointermove', updateRotationDrag);
  rim.addEventListener('pointerup', endRotationDrag);
  rim.addEventListener('pointercancel', endRotationDrag);

  inner.addEventListener('pointerdown', e => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('#pbtn, #sal, #sar')) return;
    beginRotationDrag(inner, e);
  });

  inner.addEventListener('pointermove', updateRotationDrag);
  inner.addEventListener('pointerup', endRotationDrag);
  inner.addEventListener('pointercancel', endRotationDrag);
}
