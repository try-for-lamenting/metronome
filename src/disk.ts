import * as S from './state';
import { playWheelTicks } from './audio';

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
  const wrap = o.parentElement as HTMLElement | null;
  const maxSize = parseFloat(cssVar('--wheel-max')) || 420;
  const availW = wrap?.clientWidth ?? o.offsetWidth;
  const availH = wrap?.clientHeight ?? o.offsetHeight;
  if (!availW || !availH) return;
  const sz = Math.max(140, Math.min(availW, availH, maxSize));
  o.style.width = sz + 'px';
  o.style.height = sz + 'px';
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
  const leftArrow = document.getElementById('sal')!;
  const rightArrow = document.getElementById('sar')!;
  let activeTarget: HTMLElement | null = null;
  let activeFromInner = false;
  let dragLast: number | null = null;
  let dragBpmStart = 120;
  let dragTotal = 0;
  let pointerDownTs = 0;
  let pointerMoved = false;
  let tapSide: -1 | 0 | 1 = 0;
  let arrowFlashId: number | null = null;

  const flashArrow = (side: -1 | 1): void => {
    const arrow = side < 0 ? leftArrow : rightArrow;
    leftArrow.classList.remove('is-flashing');
    rightArrow.classList.remove('is-flashing');
    arrow.classList.add('is-flashing');
    if (arrowFlashId !== null) window.clearTimeout(arrowFlashId);
    arrowFlashId = window.setTimeout(() => {
      arrow.classList.remove('is-flashing');
      arrowFlashId = null;
    }, 140);
  };

  const triggerTapSide = (side: -1 | 1): void => {
    const prevBpm = S.bpm;
    S.setBpm(prevBpm + side);
    if (S.bpm === prevBpm) return;
    onBpmChange(S.bpm);
    playWheelTicks(S.bpm - prevBpm);
    flashArrow(side);
  };

  const updateRotationDrag = (e: PointerEvent): void => {
    if (!activeTarget || dragLast === null) return;
    e.preventDefault();
    const c = diskCtr();
    const a = getAng(c.x, c.y, e.clientX, e.clientY);
    let delta = a - dragLast;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    dragTotal += delta;
    if (Math.abs(dragTotal) > 0.03) pointerMoved = true;
    S.setDiskAngleDeg(S.diskAngleDeg + delta * 180 / Math.PI);
    drawDisk();
    const db = (dragTotal / (Math.PI * 2)) * 36;
    const nb = Math.max(20, Math.min(300, Math.round(dragBpmStart + db)));
    const prevBpm = S.bpm;
    if (nb !== prevBpm) {
      S.setBpm(nb);
      onBpmChange(nb);
      playWheelTicks(nb - prevBpm);
    }
    dragLast = a;
  };

  const endRotationDrag = (): void => {
    const heldMs = performance.now() - pointerDownTs;
    if (activeFromInner && tapSide !== 0 && !pointerMoved && heldMs < 260) {
      triggerTapSide(tapSide);
    }
    rim.classList.remove('is-pressed');
    activeTarget = null;
    activeFromInner = false;
    dragLast = null;
    pointerMoved = false;
    tapSide = 0;
  };

  const beginRotationDrag = (target: HTMLElement, e: PointerEvent, fromInner: boolean): void => {
    e.preventDefault();
    target.setPointerCapture(e.pointerId);
    activeTarget = target;
    activeFromInner = fromInner;
    dragBpmStart = S.bpm;
    dragTotal = 0;
    pointerDownTs = performance.now();
    pointerMoved = false;
    tapSide = 0;
    rim.classList.add('is-pressed');
    const c = diskCtr();
    if (fromInner) {
      const deadZone = document.getElementById('dkout')!.offsetWidth * 0.13;
      const dx = e.clientX - c.x;
      tapSide = dx < -deadZone ? -1 : dx > deadZone ? 1 : 0;
    }
    dragLast = getAng(c.x, c.y, e.clientX, e.clientY);
  };

  rim.addEventListener('pointerdown', e => {
    const c = diskCtr();
    const dx = e.clientX - c.x, dy = e.clientY - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const innerRadius = document.getElementById('dkout')!.offsetWidth * 0.40;
    if (dist < innerRadius) return;
    beginRotationDrag(rim, e, false);
  });

  rim.addEventListener('pointermove', updateRotationDrag);
  rim.addEventListener('pointerup', endRotationDrag);
  rim.addEventListener('pointercancel', endRotationDrag);

  inner.addEventListener('pointerdown', e => {
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('#pbtn')) return;
    beginRotationDrag(inner, e, true);
  });

  inner.addEventListener('pointermove', updateRotationDrag);
  inner.addEventListener('pointerup', endRotationDrag);
  inner.addEventListener('pointercancel', endRotationDrag);
}
