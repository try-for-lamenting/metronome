import * as S from './state';

export function renderGrid(): void {
  const g = document.getElementById('grid')!;
  g.innerHTML = '';
  for (let r = 0; r < 3; r++) {
    const row = document.createElement('div');
    row.className = 'brow2';
    row.style.gridTemplateColumns = `repeat(${S.sn}, 1fr)`;
    row.style.gap = '3px';
    for (let c = 0; c < S.sn; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset['r'] = String(r);
      cell.dataset['c'] = String(c);
      cell.addEventListener('click', () => cellClick(r, c));
      row.appendChild(cell);
    }
    g.appendChild(row);
  }
  refreshGrid();
}

export function cellClick(row: number, col: number): void {
  const t = 3 - row;
  S.setBsAt(col, S.bs[col] === t ? 0 : t);
  refreshGrid();
}

/** Refresh grid highlight. Pass activeBeat to highlight the beat that just fired. */
export function refreshGrid(activeBeat?: number): void {
  const highlight = activeBeat !== undefined ? activeBeat : (S.playing ? S.curBeat : -1);
  for (let c = 0; c < S.sn; c++) {
    const s = S.bs[c] || 0;
    for (let r = 0; r < 3; r++) {
      const el = document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`);
      if (!el) continue;
      el.classList.remove('s1', 's2', 's3', 'cur');
      const thr = 3 - r;
      if (s >= thr) el.classList.add(`s${s}`);
      if (S.playing && c === highlight) el.classList.add('cur');
    }
  }
}

export function flashCol(col: number): void {
  if (col < 0 || col >= S.sn) return;
  const s = S.bs[col] || 0;
  if (s === 0) return;
  for (let r = 0; r < 3; r++) {
    const thr = 3 - r;
    if (s < thr) continue;
    const el = document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${col}"]`);
    if (!el) continue;
    el.classList.remove('fl');
    void el.offsetWidth; // force reflow
    el.classList.add('fl');
  }
}
