import * as S from './state';
import type { MetronomePreset, NoteValue, SubTrack } from './types';
import { refreshMetronomeSchedule } from './audio';
import { renderAccents } from './dialogs';
import { largeBpmNoteIcon } from './glyphs';
import { renderGrid } from './grid';
import { schedulePersistAppState } from './persist';
import { drawSubdivCanvas, renderSubdivTracks } from './subdivisions';

let onPresetApplied: (() => void) | null = null;

export function setOnPresetApplied(fn: () => void): void {
  onPresetApplied = fn;
}

function cloneSubTracks(tracks: SubTrack[]): SubTrack[] {
  return tracks.map(track => ({
    div: track.div,
    states: track.states.slice(0, track.div),
  }));
}

function captureCurrentPreset(name: string): MetronomePreset {
  return {
    name,
    bpm: S.bpm,
    sn: S.sn,
    sd: S.sd as NoteValue,
    bs: S.bs.slice(0, S.sn).map(v => Math.max(0, Math.min(3, Math.round(v)))),
    subTracks: cloneSubTracks(S.subTracks),
  };
}

function formatSubdivisionRatio(subTracks: SubTrack[]): string {
  return subTracks.length ? subTracks.map(track => String(track.div)).join(':') : 'None';
}

function syncPresetUi(): void {
  renderGrid();
  renderAccents();
  renderSubdivTracks();
  drawSubdivCanvas();
  onPresetApplied?.();
}

function applyPreset(preset: MetronomePreset): void {
  S.setBpm(preset.bpm);
  S.setSn(preset.sn);
  S.setSd(preset.sd);
  S.setBs(preset.bs.slice(0, preset.sn));
  S.setSubTracks(cloneSubTracks(preset.subTracks));
  if (S.curBeat >= preset.sn) S.setCurBeat(0);
  refreshMetronomeSchedule();
  syncPresetUi();
  schedulePersistAppState();
}

function makePresetSummary(preset: MetronomePreset): string {
  return `${preset.bpm} BPM · ${preset.sn}/${preset.sd} · ${formatSubdivisionRatio(preset.subTracks)}`;
}

function summarizeAccentActivity(preset: MetronomePreset): string {
  const activeMain = preset.bs.filter(v => v > 0).length;
  const activeSubs = preset.subTracks.reduce((sum, track) => (
    sum + track.states.slice(1).filter(v => v > 0).length
  ), 0);
  return `${activeMain} main · ${activeSubs} sub`;
}

function getPresetContent(): HTMLElement {
  return document.getElementById('presetContent')!;
}

export function openPresets(): void {
  document.getElementById('presetOverlay')!.classList.add('open');
  renderPresetList();
}

export function closePresets(): void {
  document.getElementById('presetOverlay')!.classList.remove('open');
}

export function renderPresetList(): void {
  document.getElementById('presetTitle')!.textContent = 'PRESETS';
  document.getElementById('presetBack')!.style.display = 'none';
  const content = getPresetContent();
  content.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'preset-list';

  S.presets.forEach((preset, idx) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.innerHTML = `
      <div class="preset-item-icon">${largeBpmNoteIcon(preset.sd)}</div>
      <div class="preset-item-copy">
        <div class="preset-item-name">${preset.name}</div>
        <div class="preset-item-info">${makePresetSummary(preset)}</div>
      </div>
      <div class="preset-item-actions">
        <button class="preset-item-btn" type="button" data-action="edit" aria-label="Edit preset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button class="preset-item-btn preset-item-btn-danger" type="button" data-action="delete" aria-label="Delete preset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    `;
    item.addEventListener('click', () => {
      applyPreset(preset);
      closePresets();
    });
    item.querySelector<HTMLElement>('[data-action="edit"]')!.addEventListener('click', e => {
      e.stopPropagation();
      renderPresetEdit(idx);
    });
    item.querySelector<HTMLElement>('[data-action="delete"]')!.addEventListener('click', e => {
      e.stopPropagation();
      S.presets.splice(idx, 1);
      schedulePersistAppState();
      renderPresetList();
    });
    list.appendChild(item);
  });

  if (S.presets.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'preset-empty';
    empty.textContent = 'Save a metronome configuration for future use.';
    content.appendChild(empty);
  } else {
    content.appendChild(list);
  }

  const addBtn = document.createElement('div');
  addBtn.className = 'auto-add-btn';
  addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Save Current Preset`;
  addBtn.addEventListener('click', () => {
    S.presets.push(captureCurrentPreset(`Preset ${S.presets.length + 1}`));
    schedulePersistAppState();
    renderPresetEdit(S.presets.length - 1);
  });
  content.appendChild(addBtn);
}

export function renderPresetEdit(idx: number): void {
  const preset = S.presets[idx];
  if (!preset) {
    renderPresetList();
    return;
  }

  document.getElementById('presetTitle')!.textContent = 'PRESET';
  document.getElementById('presetBack')!.style.display = 'flex';
  const content = getPresetContent();
  content.innerHTML = '';

  const nameWrap = document.createElement('div');
  nameWrap.className = 'auto-field full';
  nameWrap.innerHTML = '<label>Preset Name</label>';
  const nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.value = preset.name;
  nameInp.addEventListener('input', () => {
    preset.name = nameInp.value;
    schedulePersistAppState();
  });
  nameWrap.appendChild(nameInp);
  content.appendChild(nameWrap);

  const summary = document.createElement('div');
  summary.className = 'preset-summary';
  summary.innerHTML = `
    <div class="preset-summary-hero">
      <div class="preset-summary-icon">${largeBpmNoteIcon(preset.sd)}</div>
      <div class="preset-summary-metrics">
        <div class="preset-summary-metric">
          <span>Tempo</span>
          <strong>${preset.bpm} BPM</strong>
        </div>
        <div class="preset-summary-metric">
          <span>Time Sig</span>
          <strong>${preset.sn}/${preset.sd}</strong>
        </div>
      </div>
    </div>
    <div class="preset-summary-grid">
      <div class="preset-summary-cell">
        <span>Subdivisions</span>
        <strong>${formatSubdivisionRatio(preset.subTracks)}</strong>
      </div>
      <div class="preset-summary-cell">
        <span>Accents</span>
        <strong>${summarizeAccentActivity(preset)}</strong>
      </div>
    </div>
  `;
  content.appendChild(summary);

  const applyBtn = document.createElement('div');
  applyBtn.className = 'auto-save-btn';
  applyBtn.textContent = 'Apply Preset';
  applyBtn.addEventListener('click', () => {
    applyPreset(preset);
    closePresets();
  });
  content.appendChild(applyBtn);

  const updateBtn = document.createElement('div');
  updateBtn.className = 'preset-update-btn';
  updateBtn.textContent = 'Update To Current';
  updateBtn.addEventListener('click', () => {
    const next = captureCurrentPreset(preset.name.trim() || `Preset ${idx + 1}`);
    S.presets[idx] = next;
    schedulePersistAppState();
    renderPresetEdit(idx);
  });
  content.appendChild(updateBtn);

  const delBtn = document.createElement('div');
  delBtn.className = 'auto-del-btn';
  delBtn.textContent = 'Delete Preset';
  delBtn.addEventListener('click', () => {
    S.presets.splice(idx, 1);
    schedulePersistAppState();
    renderPresetList();
  });
  content.appendChild(delBtn);
}
