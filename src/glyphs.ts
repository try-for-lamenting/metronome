// SMuFL glyph path data embedded for zero-dependency inline SVG rendering.
// All paths use fill="currentColor" so CSS color applies dynamically.

interface GlyphData { vb: string; d: string; }

const GLYPHS: Record<string, GlyphData> = {
  "note-whole": { vb: "-15 650 340 320", d: `M124 949c-24 1 -45 -11 -67 -19l-23 -10c-22 -10 -34 -28 -34 -50c0 -6 1 -12 3 -20c15 -45 35 -89 65 -128c26 -36 70 -54 114 -54c39 0 77 14 104 44c16 18 19 42 18 66c-2 106 -100 166 -180 171zM138 859c26 -2 52 -10 76 -24c9 -5 16 -13 23 -22c3 -5 5 -10 5 -15 c0 -6 -4 -12 -12 -16c-21 -9 -40 -23 -63 -23c-5 0 -10 1 -16 3c-36 8 -64 27 -84 57c-2 4 -5 9 -5 13s2 7 8 10c21 8 42 17 68 17z` },
  "note-half": { vb: "-15 600 300 350", d: `M83 912c-53 0 -82 -33 -82 -91c0 -60 24 -105 72 -139c14 -10 30 -17 46 -26c15 -7 30 -12 46 -12c17 0 36 6 52 22c2 -1 4 -2 5 -4v-81c2 -146 3 -291 6 -438c0 -4 -2 -9 -2 -13c0 -6 3 -11 11 -11c13 1 24 11 24 28v64c0 22 0 43 -1 64c-3 65 -3 129 -3 194v267 c0 98 -64 166 -160 175c-5 1 -10 1 -14 1zM98 833c6 0 11 -1 16 -3c36 -8 67 -28 95 -52c4 -4 8 -9 4 -15c-16 -17 -29 -37 -69 -35c-31 6 -68 26 -99 59c-4 4 -7 9 -7 15v4c0 9 4 15 12 17c15 4 32 10 48 10z` },
  "note-quarter": { vb: "-15 500 310 460", d: `M92 910c-6 1 -13 2 -18 2c-39 0 -70 -30 -73 -71c-1 -5 -1 -10 -1 -15c0 -15 3 -29 10 -43c26 -55 68 -94 124 -117c14 -7 29 -10 44 -10c11 0 22 2 32 5c3 1 5 1 8 0c2 -5 2 -10 2 -15c0 -108 2 -217 5 -326c1 -58 1 -117 2 -174v-10c1 -9 4 -14 9 -14c3 0 6 2 10 4 c12 8 17 18 17 32c-1 90 -1 180 -1 269v146c-1 33 -3 68 -3 101c0 20 1 40 2 60c0 16 -4 30 -11 44c-34 66 -84 115 -158 132z` },
  "note-8th": { vb: "-15 480 470 480", d: `M90 910c-7 2 -13 2 -19 2c-42 0 -71 -33 -71 -78c0 -12 1 -28 7 -40c30 -67 78 -112 149 -131c8 -1 15 -3 23 -3c9 0 18 2 26 5c4 1 6 2 9 2c5 0 7 -5 7 -14c1 -85 1 -171 3 -255l3 -248c0 -3 -1 -8 -1 -12c0 -5 2 -10 12 -10c12 0 21 9 21 19c0 27 17 42 32 57 c61 62 103 134 123 219c11 48 20 96 20 146c0 9 1 17 1 26c0 36 -3 71 -13 106c-7 20 -15 39 -31 57c-4 -16 -6 -32 -6 -47c0 -21 4 -41 13 -61c8 -17 12 -34 12 -51c0 -28 -9 -56 -16 -84c-20 -87 -62 -162 -124 -226c-2 -3 -5 -3 -9 -7c-3 19 -3 37 -3 55v403 c0 15 -5 28 -12 41c-33 66 -82 115 -156 129z` },
  "note-16th": { vb: "-15 420 510 550", d: `M90 910c-7 1 -12 2 -18 2c-42 0 -72 -33 -72 -78c0 -14 1 -28 7 -40c30 -67 78 -112 149 -131c8 -1 15 -3 23 -3c9 0 18 2 26 5c4 1 6 2 9 2c5 0 7 -5 7 -14c1 -85 1 -171 3 -255l3 -250c0 -6 1 -11 2 -17c0 -7 4 -13 10 -14c1 0 2 -1 3 -1c5 0 5 8 8 12 c27 42 65 74 103 107c65 57 100 126 100 207c0 16 -2 33 -4 51c-1 5 -2 10 -2 16c0 10 3 21 7 32c12 25 15 51 15 77c0 14 -2 28 -3 43c-2 28 -7 56 -20 81c-3 6 -5 12 -15 20c-1 -20 -4 -37 -4 -54c0 -10 2 -20 6 -30c5 -12 8 -23 8 -34c0 -25 -13 -47 -30 -67 c-45 -55 -99 -103 -146 -155c-1 -2 -3 -2 -7 -5v319c0 17 -4 31 -12 46c-34 65 -82 114 -156 128zM427 480c-1 -2 -1 -3 -1 -6c0 -5 3 -12 3 -20c0 -4 -1 -7 -2 -10c-10 -34 -28 -64 -51 -90c-34 -42 -78 -73 -116 -117c0 12 1 22 1 32c0 8 -1 14 -2 21c-1 4 -1 7 -1 10 c0 15 8 26 19 38c50 47 100 94 150 142z` },
  "note-32nd": { vb: "-15 380 510 600", d: `M90 911c-5 1 -10 1 -14 1c-45 0 -76 -31 -76 -78c0 -20 4 -39 14 -56c32 -58 77 -100 144 -116c8 -1 16 -3 23 -3c10 0 21 3 29 7c6 4 10 5 13 5c6 0 7 -6 7 -14v-235c0 -88 4 -177 4 -266c0 -26 0 -54 -1 -80c-1 -27 -3 -54 -3 -82c0 -10 3 -16 11 -20c1 -1 3 -2 5 -2 c6 0 8 8 11 12c37 52 82 98 124 148c37 43 52 98 57 155v15c-1 8 -1 14 -1 21c0 31 5 61 16 92c6 19 9 38 9 57c0 25 -5 51 -13 76c-3 7 -3 14 -2 22c3 20 5 38 5 56c0 52 -14 102 -54 144c-7 8 -12 18 -19 27c-2 3 -5 9 -10 7c-4 -2 -3 -8 -4 -12c-3 -10 -4 -18 -4 -26 c0 -29 13 -54 29 -79c6 -7 8 -17 13 -24c7 -9 10 -19 10 -28c0 -13 -6 -25 -14 -38c-24 -39 -57 -67 -89 -98c-16 -16 -34 -31 -53 -49c1 38 -1 76 -1 112c0 25 1 51 2 76c1 17 3 36 3 54c0 19 -2 39 -5 58c-9 52 -42 88 -81 120c-25 20 -53 36 -85 41zM412 328 c-9 -40 -21 -72 -42 -102c-33 -48 -77 -88 -113 -137c1 11 2 21 2 33l-1 10v12c0 27 13 47 32 66c9 7 16 16 24 24c32 30 63 60 98 94zM424 510c4 -7 6 -12 6 -17s-2 -9 -4 -14c-9 -25 -21 -47 -39 -67c-41 -45 -83 -89 -125 -134c-2 17 -3 33 -4 49c-2 15 3 26 15 36 c55 44 113 84 151 147z` },
  "rest-quarter": { vb: "-70 680 230 480", d: `M84 1131c-1 1 -2 1 -3 1c-4 0 -7 -6 -12 -7c-8 -3 -12 -9 -15 -15c-27 -52 -48 -107 -54 -165c-4 -49 32 -90 86 -97c5 -1 10 1 16 -4c-13 -28 -29 -55 -47 -80c-11 -17 -21 -34 -29 -52c-2 -4 -4 -8 -4 -12c0 -6 4 -13 12 -18c16 -12 34 -22 51 -32c13 -8 19 -13 19 -20 c0 -6 -3 -12 -10 -21c-24 -32 -40 -70 -64 -102c-5 -6 -8 -13 -8 -19s3 -12 11 -17c4 -2 7 -3 10 -3c8 0 15 7 21 13c24 21 41 49 54 77c20 43 45 82 69 122c7 11 10 22 10 32c0 15 -6 30 -15 45c-9 18 -24 32 -39 47c-5 6 -9 10 -9 16c0 3 2 7 4 12c16 33 29 68 53 97 c12 14 15 33 19 52v5c0 8 -3 15 -10 18c-2 1 -2 1 -4 1c-6 0 -12 -7 -16 -13c-14 -20 -28 -42 -54 -50c-5 -1 -10 -4 -16 0c-22 9 -42 42 -42 69c0 3 0 6 1 9c6 28 13 55 20 83c1 3 2 7 2 10c-1 6 -1 14 -7 18z` },
  "rest-8th": { vb: "-20 650 260 400", d: `M91 1008c16 -90 51 -174 70 -264c-23 14 -43 27 -66 36c-13 5 -25 6 -34 6c-42 0 -61 -32 -61 -69c0 -6 1 -11 2 -18c4 -29 9 -59 24 -85c9 -16 16 -23 26 -23c5 0 11 2 18 5c16 7 12 25 12 38c0 8 -4 15 -7 20c-1 4 -2 6 -2 9s1 7 5 11c3 3 6 4 9 4s7 -1 10 -3 c23 -14 45 -29 65 -48c13 -12 31 -20 50 -23c2 -1 4 -1 6 -1c10 0 12 7 13 19v4c0 5 -1 11 -3 16c-29 87 -43 178 -74 264c-11 28 -22 56 -36 83c-5 9 -12 18 -27 19z` },
  "rest-16th": { vb: "-20 720 310 380", d: `M116 1062c-3 -2 -4 -5 -4 -8c0 -35 10 -68 18 -101c3 -8 8 -16 5 -24c-1 -1 -2 -1 -4 -1c-4 0 -7 3 -9 6c-9 10 -21 15 -33 20c-18 7 -32 9 -43 9c-25 0 -36 -17 -43 -60c-2 -10 -3 -21 -3 -33c0 -15 2 -29 10 -44c6 -11 14 -24 28 -21c18 4 40 -1 49 25 c4 10 11 19 11 32v1c0 7 6 7 11 5c21 -9 45 -13 52 -41c7 -27 13 -54 27 -83c-22 10 -38 23 -57 30c-17 7 -32 11 -45 11c-35 0 -53 -27 -53 -85c0 -21 4 -42 15 -61c10 -15 38 -29 59 -29c3 0 7 1 11 2c8 2 14 20 14 34c0 4 0 7 -1 10c-1 7 -4 14 -7 25 c39 -17 67 -44 99 -66l3 -2c7 -6 14 -8 21 -8c5 0 9 1 12 2c6 3 7 9 7 16c0 33 -19 58 -28 87c-24 71 -44 142 -58 216c-4 20 -6 41 -10 62c-4 26 -15 48 -33 66c-6 6 -14 11 -21 8z` },
  "rest-32nd": { vb: "-20 780 310 450", d: `M98 1198c-9 -2 -10 -13 -12 -22c-3 -16 -12 -30 -12 -46c-1 -48 14 -92 27 -136c1 -1 1 -2 1 -4c3 -9 8 -21 8 -31c0 -2 0 -5 -1 -6c-2 -3 -3 -3 -7 -3c-7 0 -18 6 -26 7c-6 2 -13 2 -18 2c-29 0 -47 -17 -52 -50c-3 -15 -6 -29 -6 -43c0 -10 2 -20 5 -29 c6 -19 28 -35 51 -35c19 0 33 11 44 26c2 2 1 7 3 9c7 5 0 22 12 19c13 -2 29 -6 33 -24c8 -34 17 -67 27 -106c-31 20 -57 39 -92 39c-28 0 -45 -16 -51 -46c-3 -18 -8 -36 -8 -54c2 -27 10 -39 35 -47c7 -1 13 -3 20 -3c24 0 48 12 61 31c2 4 5 6 7 6s4 -1 7 -2 c24 -16 48 -29 48 -64c0 -16 8 -32 13 -52c-32 20 -57 43 -89 53c-10 3 -20 5 -29 6c-3 1 -5 1 -7 1c-16 0 -27 -10 -31 -25c-6 -22 -12 -44 -12 -67c0 -4 1 -8 1 -12c5 -39 30 -62 66 -62c6 0 12 1 19 2c14 3 29 8 38 20c5 8 10 11 14 11c5 -1 11 -4 16 -9l31 -26 c7 -7 17 -12 26 -12c3 0 6 0 8 2c8 4 12 14 12 25c0 3 -1 6 -2 9c-8 43 -17 85 -25 128c-17 82 -33 165 -50 248c-15 64 -27 127 -39 191c-9 49 -21 98 -32 147c-2 7 -5 14 -9 19c-5 8 -13 17 -23 15z` },
  "rest-whole": { vb: "-170 700 730 260", d: `M53 926c-8 0 -16 0 -24 -2c-22 -3 -28 -9 -27 -31c1 -15 -2 -35 -2 -53c0 -8 1 -16 3 -22c-7 -3 -16 -2 -30 -2c-19 -1 -39 1 -58 1c-12 0 -21 0 -32 -2c-12 -1 -24 -2 -34 -11c-3 -3 -9 -6 -6 -12c1 -5 7 -3 12 -3c33 -3 68 -4 102 -4h64c157 -3 314 -8 471 -8 c15 0 28 1 43 4c10 1 11 9 12 16v1c0 8 -8 6 -12 7c-15 3 -30 4 -45 4c-18 0 -35 -2 -52 -1c-21 2 -26 1 -26 14c0 4 0 8 1 12c2 13 1 26 1 39c0 38 -24 47 -48 48c-36 2 -78 2 -120 2h-80c-27 0 -51 0 -74 1c-13 1 -25 2 -39 2z` },
  "rest-half": { vb: "-110 650 480 210", d: `M221 816c-50 0 -103 -9 -155 -9c-44 0 -87 3 -131 3c-6 0 -13 -1 -19 -3c-10 -1 -10 -10 -12 -17v-2c0 -6 8 -6 13 -6c25 -8 51 -7 77 -7h4c8 0 12 -2 12 -8c0 -2 0 -6 -2 -10c-2 -7 -3 -13 -3 -19c0 -11 2 -22 4 -32c1 -10 9 -12 17 -13c30 -5 60 -6 90 -6 c22 0 43 0 64 -1h27c31 0 47 18 45 49l-2 15c-2 9 -3 16 -3 20c0 8 3 11 15 11c4 0 8 0 15 -1c5 -1 10 -1 15 -1c13 0 26 2 38 3c4 1 8 2 12 4c8 3 18 7 16 15c0 9 -12 7 -20 9c-15 3 -30 4 -46 4c-8 0 -16 0 -24 -1c-15 2 -31 3 -47 3z` },
};

interface GlyphBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const glyphBoundsCache = new Map<string, GlyphBounds>();

function parseViewBox(vb: string): GlyphBounds {
  const [x, y, width, height] = vb.split(/\s+/).map(Number);
  return { x, y, width, height };
}

function measureGlyphBounds(name: string): GlyphBounds {
  const cached = glyphBoundsCache.get(name);
  if (cached) return cached;

  const g = GLYPHS[name];
  if (!g || typeof document === 'undefined') {
    const fallback = g ? parseViewBox(g.vb) : { x: 0, y: 0, width: 24, height: 24 };
    glyphBoundsCache.set(name, fallback);
    return fallback;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', g.vb);
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  svg.style.pointerEvents = 'none';

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', g.d);
  svg.appendChild(path);
  document.body.appendChild(svg);

  let bounds: GlyphBounds;
  try {
    const box = path.getBBox();
    bounds = {
      x: Math.floor(box.x) - 6,
      y: Math.floor(box.y) - 6,
      width: Math.ceil(box.width) + 12,
      height: Math.ceil(box.height) + 12,
    };
  } catch {
    bounds = parseViewBox(g.vb);
  }

  svg.remove();
  glyphBoundsCache.set(name, bounds);
  return bounds;
}

/** Returns inline SVG string for a note or rest glyph. Color is inherited via CSS `color`. */
export function glyphSVG(name: string, w = 24, h = 30): string {
  const g = GLYPHS[name];
  if (!g) return '';
  const vb = measureGlyphBounds(name);
  return `<svg viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${g.d}"/></svg>`;
}

/** Map note denominator (1,2,4,8,16,32) to note/rest glyph name. */
export function noteGlyphName(denom: number, isRest: boolean): string {
  const map: Record<number, string> = { 1: 'whole', 2: 'half', 4: 'quarter', 8: '8th', 16: '16th', 32: '32nd' };
  const kind = map[denom] ?? 'quarter';
  return isRest ? `rest-${kind}` : `note-${kind}`;
}

/**
 * Returns the accent-cell icon SVG for state 0–3.
 * State 0 = rest (silent), states 1–3 = note with increasing brightness.
 */
export function accentIconSVG(denom: number, state: number): string {
  if (state === 0) {
    const gname = noteGlyphName(denom, true);
    const g = GLYPHS[gname];
    if (!g) return '';
    const vb = measureGlyphBounds(gname);
    return `<svg viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="20" height="24" xmlns="http://www.w3.org/2000/svg"><path fill="var(--accent-rest)" d="${g.d}"/></svg>`;
  }
  const COLS = ['', 'var(--accent-note-1)', 'var(--accent-note-2)', 'var(--accent-note-3)'];
  const col = COLS[state] || 'var(--accent-note-3)';
  const gname = noteGlyphName(denom, false);
  const g = GLYPHS[gname];
  if (!g) return '';
  const vb = measureGlyphBounds(gname);
  return `<svg viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="20" height="24" xmlns="http://www.w3.org/2000/svg"><path fill="${col}" d="${g.d}"/></svg>`;
}

/** Large note icon for the BPM display (top-left of panel). */
export function largeBpmNoteIcon(denom: number): string {
  const gname = noteGlyphName(denom, false);
  return glyphSVG(gname, 26, 34);
}
