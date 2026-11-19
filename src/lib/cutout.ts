import type { Rect } from './mapTiles';

const THRESHOLD = 0.5;
const MIN_AREA = 0.005;

// Prostokąt pikseli maski z pewnością > 0,5 (x1, y1 wyłącznie); null gdy osoba zajmuje < 0,5% pola.
export function personBox(mask: Float32Array, w: number, h: number): Rect | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] <= THRESHOLD) continue;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (count < MIN_AREA * w * h) return null;
  return [x0, y0, x1 + 1, y1 + 1];
}

// Kwadrat wokół prostokąta z marginesem (model dostaje go jako 256x256 bez zniekształcenia proporcji), bok ≤ max(W, H).
// Mieści się w płótnie, jeśli może; wyższy biegacz niż szerokość zdjęcia dostaje kwadrat wystający w bok
// (poza płótnem przezroczyste piksele), zamiast ucięcia głowy lub stóp.
export function cropSquare([x0, y0, x1, y1]: Rect, W: number, H: number, margin = 0.2): Rect {
  const side = Math.round(Math.min(Math.max(x1 - x0, y1 - y0) * (1 + 2 * margin), Math.max(W, H)));
  const clamp = (c: number, max: number) =>
    Math.round(Math.min(Math.max(c - side / 2, Math.min(0, max - side)), Math.max(0, max - side)));
  const x = clamp((x0 + x1) / 2, W);
  const y = clamp((y0 + y1) / 2, H);
  return [x, y, x + side, y + side];
}

const smoothstep = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Alfa z maski (mw x mh) próbkowanej dwuliniowo do side x side; miękka krawędź bez filtra rozmycia. RGB bez zmian.
export function cutoutPixels(photo: Uint8ClampedArray, side: number, mask: Float32Array, mw: number, mh: number): Uint8ClampedArray {
  for (let y = 0; y < side; y++) {
    const my = Math.min(Math.max(((y + 0.5) * mh) / side - 0.5, 0), mh - 1);
    const j0 = Math.floor(my), j1 = Math.min(j0 + 1, mh - 1), fy = my - j0;
    for (let x = 0; x < side; x++) {
      const mx = Math.min(Math.max(((x + 0.5) * mw) / side - 0.5, 0), mw - 1);
      const i0 = Math.floor(mx), i1 = Math.min(i0 + 1, mw - 1), fx = mx - i0;
      const top = mask[j0 * mw + i0] * (1 - fx) + mask[j0 * mw + i1] * fx;
      const bottom = mask[j1 * mw + i0] * (1 - fx) + mask[j1 * mw + i1] * fx;
      photo[(y * side + x) * 4 + 3] = smoothstep(0.35, 0.65, top * (1 - fy) + bottom * fy) * 255;
    }
  }
  return photo;
}

// Siatka zasłonięcia płótna 1080x1920 w komórkach 10x10 px: 1 tam, gdzie wycinanka jest nieprzezroczysta (ADR 0009).
export const CELL = 10;
export const GRID_W = 108;
export const GRID_H = 192;

export type Cutout = { href: string; rect: Rect; grid: Uint8Array };

// rgba: wycinanka side x side położona w rect (rect może wystawać poza płótno).
export function gridFromCutout(rgba: Uint8ClampedArray, [rx, ry, rx1]: Rect): Uint8Array {
  const side = rx1 - rx;
  const grid = new Uint8Array(GRID_W * GRID_H);
  for (let j = 0; j < GRID_H; j++) {
    const py = Math.floor(j * CELL + CELL / 2 - ry);
    if (py < 0 || py >= side) continue;
    for (let i = 0; i < GRID_W; i++) {
      const px = Math.floor(i * CELL + CELL / 2 - rx);
      if (px >= 0 && px < side && rgba[(py * side + px) * 4 + 3] > 127) grid[j * GRID_W + i] = 1;
    }
  }
  return grid;
}

// Udział zasłoniętych komórek w prostokącie przyciętym do płótna; pusty prostokąt = 0.
export function gridCoverage(grid: Uint8Array, { x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number }): number {
  const i0 = Math.max(0, Math.floor(x0 / CELL)), i1 = Math.min(GRID_W, Math.ceil(x1 / CELL));
  const j0 = Math.max(0, Math.floor(y0 / CELL)), j1 = Math.min(GRID_H, Math.ceil(y1 / CELL));
  if (i1 <= i0 || j1 <= j0) return 0;
  let lit = 0;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) lit += grid[j * GRID_W + i];
  return lit / ((i1 - i0) * (j1 - j0));
}

// Udział punktów w zasłoniętych komórkach; punkt poza płótnem nie jest zasłonięty.
export function pointsCoverage(grid: Uint8Array, pts: [number, number][]): number {
  if (!pts.length) return 0;
  let lit = 0;
  for (const [x, y] of pts) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    if (i >= 0 && i < GRID_W && j >= 0 && j < GRID_H) lit += grid[j * GRID_W + i];
  }
  return lit / pts.length;
}

// Za obiekt idzie tylko to, co obiekt zasłania częściowo; ponad połowę zasłonięte byłoby nieczytelne (decyzja właściciela).
export const partlyCovered = (c: number) => c >= 0.05 && c <= 0.5;
