import { geoMercator } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { mapTiles, tileUrlFrom } from './mapTiles';

// Projekcja, w której świat ma `world` jednostek, a punkt [lng, lat] trafia w (px, py).
const projectionAt = (world: number, [lng, lat]: [number, number], [px, py]: [number, number]) => {
  const p = geoMercator().scale(world / (2 * Math.PI)).translate([0, 0]);
  const [x, y] = p([lng, lat])!;
  return p.translate([px - x, py - y]);
};

const KRAKOW: [number, number] = [19.94, 50.06];

describe('mapTiles', () => {
  it('zoom wynika ze skali i tileUnits, przycięty do maxZoom (domyślnie 14)', () => {
    const p = projectionAt(1024 * 2 ** 13, KRAKOW, [540, 960]);
    expect(mapTiles(p, [1080, 1920], 1024)[0].z).toBe(13);
    expect(mapTiles(p, [1080, 1920], 512)[0].z).toBe(14);
    expect(mapTiles(p, [1080, 1920], 256)[0].z).toBe(14);
    expect(mapTiles(p, [1080, 1920], 256, 12)[0].z).toBe(12);
    expect(mapTiles(projectionAt(100, [0, 0], [50, 50]), [100, 100], 256)[0].z).toBe(0);
  });

  it('kafelki pokrywają całe płótno bez szczelin', () => {
    const p = projectionAt(1024 * 2 ** 13 * 1.3, KRAKOW, [500, 1000]);
    const tiles = mapTiles(p, [1080, 1920], 1024);
    for (let x = 0; x <= 1080; x += 9)
      for (let y = 0; y <= 1920; y += 9)
        expect(
          tiles.some((t) => x >= t.left && x <= t.left + t.size && y >= t.top && y <= t.top + t.size),
        ).toBe(true);
  });

  it('sąsiednie kafelki stykają się dokładnie', () => {
    const tiles = mapTiles(projectionAt(1024 * 2 ** 13 * 1.1, KRAKOW, [333, 777]), [1080, 1920], 1024);
    const row = tiles.filter((t) => t.top === tiles[0].top);
    expect(row.length).toBeGreaterThan(1);
    for (let i = 0; i + 1 < row.length; i++) expect(row[i + 1].left).toBe(row[i].left + row[i].size);
  });

  it('pocztówka ma najwyżej 12 kafelków, miniatura 4', () => {
    for (let k = 0; k < 60; k++) {
      const world = 1024 * 2 ** (8 + k / 10);
      const offset: [number, number] = [(k * 37) % 1080, (k * 53) % 1920];
      expect(mapTiles(projectionAt(world, KRAKOW, offset), [1080, 1920], 1024).length).toBeLessThanOrEqual(12);
      const thumb = projectionAt(world / 10, KRAKOW, [k % 100, (k * 7) % 100]);
      expect(mapTiles(thumb, [100, 100], 256).length).toBeLessThanOrEqual(4);
    }
  });

  it('x zawija się na antypołudniku', () => {
    const tiles = mapTiles(projectionAt(1024 * 2 ** 10, [180, 0], [540, 960]), [1080, 1920], 1024);
    const xs = tiles.map((t) => t.x);
    expect(xs).toContain(0);
    expect(xs).toContain(2 ** 10 - 1);
    expect(xs.every((x) => x >= 0 && x < 2 ** 10)).toBe(true);
  });

  it('pomija y poza zakresem', () => {
    const tiles = mapTiles(projectionAt(1024, [0, 0], [540, 960]), [1080, 1920], 1024);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 0 && t.x === 0 && t.y === 0)).toBe(true);
  });

  it('punkt trasy pada w to samo miejsce kafelka co w Web Mercator', () => {
    const p = geoMercator().fitExtent(
      [[90, 260], [990, 1180]],
      { type: 'LineString', coordinates: [[19.9, 50.03], [19.98, 50.08]] },
    );
    const tiles = mapTiles(p, [1080, 1920], 1024);
    const z = tiles[0].z;
    // Standardowy wzór slippy map we współrzędnych kafelka (0..1 na kafelek).
    const [lng, lat] = KRAKOW;
    const n = 2 ** z;
    const gx = ((lng + 180) / 360) * n;
    const rad = (lat * Math.PI) / 180;
    const gy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    const tile = tiles.find((t) => t.x === Math.floor(gx) && t.y === Math.floor(gy))!;
    expect(tile).toBeDefined();
    const [px, py] = p([lng, lat])!;
    expect(Math.abs(tile.left + (gx % 1) * tile.size - px)).toBeLessThan(0.5);
    expect(Math.abs(tile.top + (gy % 1) * tile.size - py)).toBeLessThan(0.5);
  });

  it('tileUrlFrom podstawia z, x, y', () => {
    const t = { z: 13, x: 4548, y: 2775, left: 0, top: 0, size: 1 };
    expect(tileUrlFrom('https://tiles.example/v1/{z}/{x}/{y}.pbf', t)).toBe('https://tiles.example/v1/13/4548/2775.pbf');
  });
});
