import { describe, expect, it } from 'vitest';
import { zoomRegion } from './zoomRegion';

const C: [number, number] = [540, 720];
const SIZE: [number, number] = [1080, 1920];
const ID: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

describe('zoomRegion', () => {
  it('zoom poniżej 1,5 -> null', () => {
    expect(zoomRegion({ zoom: 1.4, x: 0, y: 0 }, ID, C, SIZE)).toBeNull();
  });

  it('macierz jednostkowa, zoom 2: prostokąt wokół środka z marginesem, k = 2', () => {
    // Widok [-162, 1242] × [-288, 2208] cofnięty kamerą: 540 + (s − 540) / 2 itd., przycięty do podłogi.
    const r = zoomRegion({ zoom: 2, x: 0, y: 0 }, ID, C, SIZE)!;
    expect(r.k).toBe(2);
    expect(r.rect).toEqual([189, 216, 891, 1464]);
    expect(zoomRegion({ zoom: 3, x: 0, y: 0 }, ID, C, SIZE)!.k).toBe(4);
  });

  it('przycina do podłogi [0,1080] × [0,1480]; poza płótnem -> null', () => {
    expect(zoomRegion({ zoom: 2, x: 1000, y: 0 }, ID, C, SIZE)!.rect[0]).toBe(0);
    expect(zoomRegion({ zoom: 2, x: 0, y: -1000 }, ID, C, SIZE)!.rect[3]).toBe(1480);
    expect(zoomRegion({ zoom: 4, x: 5000, y: 0 }, ID, C, SIZE)).toBeNull();
  });

  it('macierz izometrii: każdy punkt podłogi widoczny na płótnie leży w prostokącie', () => {
    const a = 1.2 / Math.SQRT2;
    const b = 1.2 / (2 * Math.SQRT2);
    const m: [number, number, number, number, number, number] = [a, b, -a, b, 500, 100];
    const cam = { zoom: 4, x: 100, y: -200 };
    const [x0, y0, x1, y1] = zoomRegion(cam, m, C, SIZE)!.rect;
    let seen = 0;
    for (let x = 0; x <= 1080; x += 10)
      for (let y = 0; y <= 1480; y += 10) {
        const sx = C[0] + cam.zoom * (m[0] * x + m[2] * y + m[4] - C[0]) + cam.x;
        const sy = C[1] + cam.zoom * (m[1] * x + m[3] * y + m[5] - C[1]) + cam.y;
        if (sx < 0 || sx > 1080 || sy < 0 || sy > 1920) continue;
        seen++;
        expect(x >= x0 && x <= x1 && y >= y0 && y <= y1).toBe(true);
      }
    expect(seen).toBeGreaterThan(0);
    // Prostokąt jest mniejszy niż cała podłoga (inaczej przybliżenie nic by nie dało).
    expect((x1 - x0) * (y1 - y0)).toBeLessThan(1080 * 1480);
  });
});
