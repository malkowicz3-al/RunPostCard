import { describe, expect, it } from 'vitest';
import type { Dem } from './dem';
import type { IsoRoute } from './isoRoute';
import { FLAT_SHADE, hillshade, reliefImage, shadeOverlay } from './relief';

const grid = (w: number, h: number, f: (x: number, y: number) => number, cell = 10): Dem => {
  const z = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) z[j * w + i] = f(i, j);
  return { x0: 0, y0: 0, cell, w, h, z, mPerUnit: 1 };
};
// Izometria jak w isoRoute (f = 1): a = 1/√2, b = 1/(2√2).
const a = Math.SQRT1_2;
const b = a / 2;
const iso = (baseM = 0): IsoRoute => ({
  points: [],
  ground: [],
  distance: [],
  slope: [],
  exaggeration: 1,
  matrix: [a, b, -a, b, 500, 100],
  pxPerM: 1,
  baseM,
});
const BG = { background: '#808080' };

describe('hillshade', () => {
  it('płasko = stała, stok na NW jaśniejszy niż na SE', () => {
    expect(new Set(hillshade(grid(5, 5, () => 100))).size).toBe(1);
    expect(hillshade(grid(5, 5, () => 100))[0]).toBeCloseTo(FLAT_SHADE, 6);
    // Wzrost ku SE: stok zwrócony na NW.
    const nw = hillshade(grid(5, 5, (i, j) => (i + j) * 5))[12];
    const se = hillshade(grid(5, 5, (i, j) => -(i + j) * 5))[12];
    expect(nw).toBeGreaterThan(FLAT_SHADE);
    expect(se).toBeLessThan(FLAT_SHADE);
  });

  it('nakładka płaska: płasko przezroczyste', () => {
    const dem = grid(3, 3, () => 0);
    expect(shadeOverlay(dem, hillshade(dem)).data.every((v, k) => k % 4 !== 3 || v === 0)).toBe(true);
  });
});

describe('reliefImage', () => {
  it('płaski DEM: romb zgodny z macierzą, poza nim tło', () => {
    const dem = grid(40, 40, () => 0);
    const shade = new Float32Array(40 * 40).fill(1); // jasne, różne od tła
    const img = reliefImage(dem, shade, iso(), BG);
    const [rx0, ry0] = img.rect;
    const d = img.width / (img.rect[2] - rx0);
    const px = (X: number, Y: number) => img.data[(Math.floor((Y - ry0) * d) * img.width + Math.floor((X - rx0) * d)) * 4];
    const [, , , , e, f] = iso().matrix;
    const at = (x: number, y: number) => [a * (x - y) + e, b * (x + y) + f];
    // Środek siatki: teren; róg prostokąta obrazu (poza rombem): tło.
    expect(px(...(at(200, 200) as [number, number]))).not.toBe(128);
    expect(px(rx0 + 1, ry0 + 1)).toBe(128);
    // Narożniki rombu: lewy (x0, y1) i prawy (x1, y0) na krawędziach obrazu.
    expect(at(5, 395)[0]).toBeCloseTo(rx0, 6);
    expect(at(395, 5)[0]).toBeCloseTo(img.rect[2], 0);
  });

  it('wysoka komórka z przodu zasłania niższą z tyłu', () => {
    // Przód (duże x + y) wysoki i jasny, tył płaski i ciemny.
    const dem = grid(40, 40, (i, j) => (i + j > 60 ? 300 : 0));
    const shade = new Float32Array(40 * 40);
    for (let k = 0; k < shade.length; k++) shade[k] = (k % 40) + Math.floor(k / 40) > 60 ? 1 : 0;
    const img = reliefImage(dem, shade, iso(), BG);
    const [rx0, ry0] = img.rect;
    const d = img.width / (img.rect[2] - rx0);
    // Punkt tyłu (250, 250) na podłożu leży w kolumnie, którą zasłania przód podniesiony o 300 m.
    const X = a * 0 + 500;
    const Y = b * 500 + 100;
    const v = img.data[(Math.floor((Y - ry0) * d) * img.width + Math.floor((X - rx0) * d)) * 4];
    // Ściana boku przodu: mix(#808080, #000, 0,35) = 83 (bez zasłaniania byłby ciemny tył albo tło).
    expect(v).toBe(83);
  });

  it('nie przekracza maxPixels', () => {
    const img = reliefImage(grid(100, 100, (i) => i * 3), new Float32Array(100 * 100).fill(0.7), iso(), BG, 10000);
    expect(img.width * img.height).toBeLessThanOrEqual(10000);
  });
});
