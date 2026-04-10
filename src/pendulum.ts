import * as S from './state';

let praf: number | null = null;

export function pendBeat(): void {
  S.setPBeatT(performance.now());
  S.setPBeatMs(60000 / S.bpm);
  S.setPGoRight(!S.pGoRight);
}

export function pendToEdge(): void {
  const ball = document.getElementById('pball');
  const wrap = document.querySelector<HTMLElement>('.pwrap');
  if (!ball || !wrap) return;
  const w = wrap.offsetWidth;
  const targetX = S.pGoRight ? w - 12 : 12;
  ball.style.left = targetX + 'px';
  flashEdge(wrap);
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
    if (ball && wrap && S.playing && S.pBeatT > 0 && S.pBeatMs > 0) {
      const elapsed = performance.now() - S.pBeatT;
      const t = Math.min(elapsed / S.pBeatMs, 1);
      const pos = S.pGoRight ? t : 1 - t;
      const w = wrap.offsetWidth;
      const x = 12 + pos * (w - 24);
      ball.style.left = x + 'px';

      const atEdge = t > 0.96 || t < 0.04;
      if (atEdge && !wasAtEdge) {
        flashEdge(wrap);
        wasAtEdge = true;
      } else if (!atEdge) {
        wasAtEdge = false;
      }
    }
    praf = requestAnimationFrame(tick);
  }
  tick();
}
