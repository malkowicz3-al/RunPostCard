import { describe, expect, it } from 'vitest';
import { CELL, GRID_H, GRID_W, cropSquare, cutoutPixels, gridCoverage, gridFromCutout, partlyCovered, personBox, pointsCoverage } from './cutout';

const block = (w: number, h: number, [x0, y0, x1, y1]: number[], p = 0.9) => {
  const m = new Float32Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * w + x] = p;
  return m;
};

describe('personBox', () => {
  it('pusta maska, mała plama i pewność ≤ 0,5 to brak osoby', () => {
    expect(personBox(new Float32Array(100 * 100), 100, 100)).toBeNull();
    expect(personBox(block(100, 100, [0, 0, 7, 7]), 100, 100)).toBeNull(); // 49 < 50 px
    expect(personBox(block(100, 100, [0, 0, 50, 50], 0.5), 100, 100)).toBeNull();
  });

  it('prostokąt bloku (koniec wyłącznie)', () => {
    expect(personBox(block(100, 200, [10, 20, 40, 120]), 100, 200)).toEqual([10, 20, 40, 120]);
  });
});

describe('cropSquare', () => {
  const inside = ([x0, y0, x1, y1]: number[], W: number, H: number) =>
    x0 >= 0 && y0 >= 0 && x1 <= W && y1 <= H;

  it('kwadrat z marginesem zawiera prostokąt i mieści się w płótnie', () => {
    const box: [number, number, number, number] = [400, 600, 600, 1000];
    const [x0, y0, x1, y1] = cropSquare(box, 1080, 1920);
    expect(x1 - x0).toBe(y1 - y0);
    expect(y1 - y0).toBe(560);
    expect(inside([x0, y0, x1, y1], 1080, 1920)).toBe(true);
    expect(x0 <= 400 && y0 <= 600 && x1 >= 600 && y1 >= 1000).toBe(true);
  });

  it('przy krawędzi przesunięty, nie przycięty; bok ≤ min(W, H)', () => {
    const edge = cropSquare([0, 1700, 100, 1920], 1080, 1920);
    expect(edge[2] - edge[0]).toBe(edge[3] - edge[1]);
    expect(edge[0]).toBe(0);
    expect(edge[3]).toBe(1920);
    const big = cropSquare([0, 0, 1080, 1920], 1080, 1920);
    expect(big).toEqual([-420, 0, 1500, 1920]); // wystaje w bok, zamiast ucinać wysokość
    // Wysoki biegacz (~70% wysokości): kwadrat obejmuje całą postać z góry na dół.
    const tall = cropSquare([400, 300, 700, 1650], 1080, 1920);
    expect(tall[1]).toBeLessThanOrEqual(300);
    expect(tall[3]).toBeGreaterThanOrEqual(1650);
    expect(tall[2] - tall[0]).toBe(tall[3] - tall[1]);
  });
});

describe('cutoutPixels', () => {
  const photo = (side: number) => new Uint8ClampedArray(side * side * 4).fill(77);

  it('alfa 0 / 255 / pośrednia wg progów, RGB bez zmian', () => {
    const px = cutoutPixels(photo(3), 3, new Float32Array([0.2, 0.5, 0.9, 0.2, 0.5, 0.9, 0.2, 0.5, 0.9]), 3, 3);
    expect([px[3], px[7], px[11]]).toEqual([0, 128, 255]);
    expect(px[0]).toBe(77);
    expect(px[5]).toBe(77);
  });

  it('maska innego rozmiaru: stała maska daje stałą alfę', () => {
    const px = cutoutPixels(photo(5), 5, new Float32Array(4).fill(1), 2, 2);
    for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
    const half = cutoutPixels(photo(5), 5, new Float32Array([0, 1, 0, 1]), 2, 2);
    expect(half[3]).toBe(0); // lewy brzeg
    expect(half[4 * 4 + 3]).toBe(255); // prawy brzeg
  });
});

describe('siatka zasłonięcia', () => {
  // Wycinanka 40x40 w (95, 95): lewa połowa nieprzezroczysta.
  const side = 40;
  const rgba = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y++) for (let x = 0; x < 20; x++) rgba[(y * side + x) * 4 + 3] = 255;
  const grid = gridFromCutout(rgba, [95, 95, 135, 135]);

  it('gridFromCutout: komórki ze środkiem nad nieprzezroczystą częścią', () => {
    expect(grid.length).toBe(GRID_W * GRID_H);
    const on = [...grid.keys()].filter((k) => grid[k]).map((k) => [(k % GRID_W) * CELL, Math.floor(k / GRID_W) * CELL]);
    // Nieprzezroczyste x 95..115, y 95..135; środki komórek 95 i 105 w x, 95..125 w y.
    expect(on).toEqual([90, 100, 110, 120].flatMap((y) => [[90, y], [100, y]]));
    // Wycinanka wystająca poza płótno nie psuje siatki.
    expect(gridFromCutout(new Uint8ClampedArray(2000 * 2000 * 4).fill(255), [-500, -40, 1500, 1960]).every((v) => v === 1)).toBe(true);
  });

  it('gridCoverage: udział w prostokącie, przycięty do płótna, pusty = 0', () => {
    expect(gridCoverage(grid, { x0: 90, y0: 90, x1: 130, y1: 130 })).toBe(0.5);
    const full = new Uint8Array(GRID_W * GRID_H).fill(1);
    expect(gridCoverage(full, { x0: -500, y0: -500, x1: 20, y1: 20 })).toBe(1);
    expect(gridCoverage(full, { x0: 2000, y0: 0, x1: 2100, y1: 50 })).toBe(0);
    expect(gridCoverage(full, { x0: 50, y0: 50, x1: 50, y1: 90 })).toBe(0);
  });

  it('pointsCoverage: punkty w zasłoniętych komórkach; poza płótnem i pusto = 0', () => {
    expect(pointsCoverage(grid, [[105, 105], [125, 105], [-5, 105], [105, 5000]])).toBe(0.25);
    expect(pointsCoverage(grid, [])).toBe(0);
  });

  it('partlyCovered: 5–50% włącznie', () => {
    expect([0.049, 0.05, 0.5, 0.51].map(partlyCovered)).toEqual([false, true, true, false]);
  });
});
