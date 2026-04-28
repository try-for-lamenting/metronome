import * as S from './state';

let praf: number | null = null;
let settleFromX = 0;
let settleToX = 0;
let settleStartTs = 0;
let settleDurationMs = 0;
let settling = false;

function setBallX(ball: HTMLElement, x: number): void {
  ball.style.left = x + 'px';
}

function getCurrentBallX(ball: HTMLElement, wrap: HTMLElement): number {
  const current = parseFloat(ball.style.left || '');
  if (Number.isFinite(current)) return current;
  const w = wrap.offsetWidth;
  return 12 + (S.pGoRight ? 1 : 0) * (w - 24);
}

export function cancelPendulumSettle(): void {
  settling = false;
}

export function pendBeat(): void {
  cancelPendulumSettle();
  S.setPBeatT(performance.now());
  S.setPBeatMs(60000 / S.bpm);
  S.setPGoRight(!S.pGoRight);
}

export function pendToEdge(): void {
  const ball = document.getElementById('pball');
  const wrap = document.querySelector<HTMLElement>('.pwrap');
  if (!ball || !wrap) return;
  wrap.classList.remove('is-flashing');
  if (flashTimer !== null) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
  const w = wrap.offsetWidth;
  const targetX = S.pGoRight ? w - 12 : 12;
  const currentX = getCurrentBallX(ball, wrap);
  const travel = Math.max(1, w - 24);
  const remainingRatio = Math.min(1, Math.abs(targetX - currentX) / travel);
  settleFromX = currentX;
  settleToX = targetX;
  settleStartTs = performance.now();
  settleDurationMs = Math.max(90, (S.pBeatMs || 500) * remainingRatio);
  settling = true;
  S.setPBeatT(0);
  S.setPBeatMs(0);
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

function flashEdge(wrap: HTMLElement): void {
  wrap.classList.add('is-flashing');
  if (flashTimer !== null) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    wrap.classList.remove('is-flashing');
    flashTimer = null;
  }, 140);
}

export function startPendulum(): void {
  if (praf !== null) cancelAnimationFrame(praf);
  let wasAtEdge = false;

  function tick(): void {
    const ball = document.getElementById('pball');
    const wrap = document.querySelector<HTMLElement>('.pwrap');
    if (ball && wrap) {
      if (settling) {
        const elapsed = performance.now() - settleStartTs;
        const t = Math.min(elapsed / Math.max(1, settleDurationMs), 1);
        setBallX(ball, settleFromX + (settleToX - settleFromX) * t);
        if (t >= 1) settling = false;
        wasAtEdge = false;
      } else if (S.playing && S.pBeatT > 0 && S.pBeatMs > 0) {
        const elapsed = performance.now() - S.pBeatT;
        const t = Math.min(elapsed / S.pBeatMs, 1);
        const pos = S.pGoRight ? t : 1 - t;
        const w = wrap.offsetWidth;
        const x = 12 + pos * (w - 24);
        setBallX(ball, x);

        const atEdge = t > 0.96 || t < 0.04;
        if (atEdge && !wasAtEdge) {
          flashEdge(wrap);
          wasAtEdge = true;
        } else if (!atEdge) {
          wasAtEdge = false;
        }
      } else {
        const w = wrap.offsetWidth;
        setBallX(ball, S.pGoRight ? w - 12 : 12);
        wasAtEdge = false;
      }
    }
    praf = requestAnimationFrame(tick);
  }
  tick();
}
