import * as S from './state';
import { refreshMetronomeSchedule } from './audio';
import { accentIconSVG } from './glyphs';
import { renderGrid } from './grid';
import { schedulePersistAppState } from './persist';

export function openSig(): void {
  document.getElementById('sigOverlay')!.classList.add('open');
  renderAccents();
}

export function closeSig(): void {
  document.getElementById('sigOverlay')!.classList.remove('open');
}

export function openSubdiv(): void {
  document.getElementById('subdivOverlay')!.classList.add('open');
}

export function closeSubdiv(): void {
  document.getElementById('subdivOverlay')!.classList.remove('open');
}

export function sigChange(): void {
  const old = [...S.bs];
  S.setBs([]);
  for (let i = 0; i < S.sn; i++) {
    S.bs.push(i < old.length ? old[i] : (i === 0 ? 3 : 1));
  }
  if (S.curBeat >= S.sn) S.setCurBeat(0);
  refreshMetronomeSchedule();
  renderGrid();
  renderAccents();
  schedulePersistAppState();
}

export function renderAccents(): void {
  const row = document.getElementById('accentsRow');
  if (!row) return;
  row.innerHTML = '';
  for (let i = 0; i < S.sn; i++) {
    const s = S.bs[i] || 0;
    const cell = document.createElement('div');
    cell.className = `acc a${s}`;
    const glyphWrap = document.createElement('div');
    glyphWrap.className = 'acc-glyph';
    glyphWrap.innerHTML = accentIconSVG(S.sd, s);
    cell.appendChild(glyphWrap);
    const numEl = document.createElement('div');
    numEl.className = 'acc-num';
    numEl.textContent = String(i + 1);
    cell.appendChild(numEl);
    cell.addEventListener('click', () => {
      S.setBsAt(i, (S.bs[i] + 1) % 4);
      refreshMetronomeSchedule();
      renderGrid();
      renderAccents();
      schedulePersistAppState();
    });
    row.appendChild(cell);
  }
}
