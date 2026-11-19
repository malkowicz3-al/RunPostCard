import { describe, expect, it } from 'vitest';
import { demAt, demFromTiles, terrarium, type Dem } from './dem';
import type { Tile } from './mapTiles';

describe('terrarium', () => {
  it('dekoduje R·256 + G + B/256 − 32768', () => {
    expect(terrarium(128, 0, 0)).toBe(0);
    expect(terrarium(0, 0, 0)).toBe(-32768);
    expect(terrarium(131, 52, 128)).toBeCloseTo(820.5, 6);
  });
});

describe('demFromTiles', () => {
  it('dwa kafelki obok siebie: jedna siatka 512 × 256', () => {
    const tiles: Tile[] = [
      { z: 13, x: 10, y: 5, left: -100, top: 20, size: 512 },
      { z: 13, x: 11, y: 5, left: 412, top: 20, size: 512 },
    ];
    const px = (r: number) => {
      const p = new Uint8ClampedArray(256 * 256 * 4);
      for (let k = 0; k < p.length; k += 4) p[k] = r;
      return p;
    };
    const second = px(129);
    second[(3 * 256 + 7) * 4 + 1] = 10; // piksel (7, 3) drugiego kafelka
    const dem = demFromTiles(tiles, [px(128), second], 256, 2);
    expect(dem).toMatchObject({ w: 512, h: 256, cell: 2, x0: -100, y0: 20, mPerUnit: 2 });
    expect(dem.z[0]).toBe(0);
    expect(dem.z[256]).toBe(256);
    expect(dem.z[3 * 512 + 256 + 7]).toBe(266);
  });
});

describe('demAt', () => {
  const dem: Dem = { x0: 0, y0: 0, cell: 10, w: 2, h: 2, z: Float32Array.from([0, 10, 20, 30]), mPerUnit: 1 };
  it('w węźle wartość, w środku średnia, poza siatką brzeg', () => {
    expect(demAt(dem, 5, 5)).toBe(0);
    expect(demAt(dem, 15, 15)).toBe(30);
    expect(demAt(dem, 10, 10)).toBe(15);
    expect(demAt(dem, -50, 5)).toBe(0);
    expect(demAt(dem, 100, 100)).toBe(30);
  });
});
