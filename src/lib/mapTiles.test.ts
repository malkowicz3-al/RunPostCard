import { geoMercator } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { mapTiles, tileUrl } from './mapTiles';

// Projekcja, w której świat ma `world` jednostek, a punkt [lng, lat] trafia w (px, py).
const projectionAt = (world: number, [lng, lat]: [number, number], [px, py]: [number, number]) => {
  const p = geoMercator().scale(world / (2 * Math.PI)).translate([0, 0]);
  const [x, y] = p([lng, lat])!;
  return p.translate([px - x, py - y]);
};

const KRAKOW: [number, number] = [19.94, 50.06];

describe('mapTiles', () => {
  it('zoom wynika ze skali i pixelRatio, przycięty do [0, 19]', () => {
    const p = projectionAt(512 * 2 ** 14, KRAKOW, [540, 960]);
    expect(mapTiles(p, [1080, 1920], 1)[0].z).toBe(14);
    expect(mapTiles(p, [1080, 1920], 2)[0].z).toBe(15);
    expect(mapTiles(projectionAt(512 * 2 ** 25, KRAKOW, [50, 50]), [100, 100], 1)[0].z).toBe(19);
    expect(mapTiles(projectionAt(100, [0, 0], [50, 50]), [100, 100], 1)[0].z).toBe(0);
  });

  it('kafelki pokrywają całe płótno bez szczelin', () => {
    const p = projectionAt(512 * 2 ** 14 * 1.3, KRAKOW, [500, 1000]);
    const tiles = mapTiles(p, [1080, 1920], 1);
    for (let x = 0; x <= 1080; x += 9)
      for (let y = 0; y <= 1920; y += 9)
        expect(
          tiles.some((t) => x >= t.left && x <= t.left + t.width && y >= t.top && y <= t.top + t.height),
        ).toBe(true);
  });

  it('pocztówka ma najwyżej 28 kafelków, miniatura 4', () => {
    for (let k = 0; k < 40; k++) {
      const world = 512 * 2 ** (12 + k / 10);
      const offset: [number, number] = [(k * 37) % 1080, (k * 53) % 1920];
      expect(mapTiles(projectionAt(world, KRAKOW, offset), [1080, 1920], 1).length).toBeLessThanOrEqual(28);
      const thumb = projectionAt(world / 10, KRAKOW, [k % 100, (k * 7) % 100]);
      expect(mapTiles(thumb, [100, 100], 3).length).toBeLessThanOrEqual(4);
    }
  });

  it('x zawija się na antypołudniku', () => {
    const tiles = mapTiles(projectionAt(512 * 2 ** 10, [180, 0], [540, 960]), [1080, 1920], 1);
    const xs = tiles.map((t) => t.x);
    expect(xs).toContain(0);
    expect(xs).toContain(2 ** 10 - 1);
    expect(xs.every((x) => x >= 0 && x < 2 ** 10)).toBe(true);
  });

  it('pomija y poza zakresem', () => {
    const tiles = mapTiles(projectionAt(512, [0, 0], [540, 960]), [1080, 1920], 1);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.every((t) => t.z === 0 && t.x === 0 && t.y === 0)).toBe(true);
  });

  it('punkt trasy pada na ten sam piksel kafelka co w Web Mercator', () => {
    const p = geoMercator().fitExtent(
      [[90, 260], [990, 1180]],
      { type: 'LineString', coordinates: [[19.9, 50.03], [19.98, 50.08]] },
    );
    const tiles = mapTiles(p, [1080, 1920], 1);
    const z = tiles[0].z;
    // Standardowy wzór slippy map: piksel globalny przy kafelku 512 px.
    const [lng, lat] = KRAKOW;
    const n = 2 ** z;
    const gx = ((lng + 180) / 360) * n * 512;
    const rad = (lat * Math.PI) / 180;
    const gy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * 512;
    const tile = tiles.find((t) => t.x === Math.floor(gx / 512) && t.y === Math.floor(gy / 512))!;
    expect(tile).toBeDefined();
    const [px, py] = p([lng, lat])!;
    expect(Math.abs(tile.left + ((gx % 512) / 512) * tile.width - px)).toBeLessThan(1);
    expect(Math.abs(tile.top + ((gy % 512) / 512) * tile.height - py)).toBeLessThan(1);
  });

  it('URL kafelka CARTO @2x', () => {
    const [t] = mapTiles(projectionAt(512 * 2 ** 14, KRAKOW, [50, 50]), [100, 100], 1);
    expect(tileUrl('dark_all', t, '')).toBe(`https://basemaps.cartocdn.com/dark_all/14/${t.x}/${t.y}@2x.png`);
  });

  it('URL kafelka z kluczem CARTO', () => {
    const [t] = mapTiles(projectionAt(512 * 2 ** 14, KRAKOW, [50, 50]), [100, 100], 1);
    expect(tileUrl('light_all', t, 'a b&c')).toBe(
      `https://basemaps.cartocdn.com/light_all/14/${t.x}/${t.y}@2x.png?key=a%20b%26c`,
    );
  });
});
