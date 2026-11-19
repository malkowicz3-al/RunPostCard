import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { ROUTE_BOX } from '../postcard/Route';
import { isoRoute, isoRoutes } from './isoRoute';
import { geoMercator } from 'd3-geo';
import type { Dem } from './dem';

// Pętla ~5 km w Krakowie, wysokość z funkcji dystansu.
function loop(alt: (t: number, i: number) => number, n = 100): RunStreams {
  const t = Array.from({ length: n }, (_, i) => i / (n - 1));
  return {
    latlng: t.map((v) => [50.06 + 0.007 * Math.sin(2 * Math.PI * v), 19.94 + 0.011 * Math.cos(2 * Math.PI * v)]),
    distance: t.map((v) => v * 5000),
    altitude: t.map(alt),
  };
}
// Płaska projekcja pocztówki, jak fitRoute w Postcard.
const proj = (s: RunStreams) =>
  geoMercator().fitExtent(ROUTE_BOX, {
    type: 'LineString',
    coordinates: s.latlng.map(([lat, lng]) => [lng, lat]),
  });
const iso = (s: RunStreams) => isoRoute(s, ROUTE_BOX, proj(s))!;
const [[x0, y0], [x1, y1]] = ROUTE_BOX;
const hill = loop((t) => 200 + 40 * Math.sin(Math.PI * t));

describe('isoRoute', () => {
  it('bez wysokości -> null', () => {
    const { altitude: _, ...s } = loop(() => 0);
    expect(isoRoute(s, ROUTE_BOX, proj(hill))).toBeNull();
  });

  it('punkty i podłoże w polu, długości się zgadzają', () => {
    const r = iso(hill);
    expect(r.points).toHaveLength(100);
    expect(r.ground).toHaveLength(100);
    expect(r.slope).toHaveLength(99);
    for (const [x, y] of [...r.points, ...r.ground]) {
      expect(x).toBeGreaterThanOrEqual(x0 - 1e-6);
      expect(x).toBeLessThanOrEqual(x1 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(y0 - 1e-6);
      expect(y).toBeLessThanOrEqual(y1 + 1e-6);
    }
  });

  it('wyższy punkt leży wyżej na ekranie niż jego podłoże', () => {
    const r = iso(hill);
    expect(r.points[50][1]).toBeLessThan(r.ground[50][1]);
    expect(r.points[0][1]).toBeCloseTo(r.ground[0][1], 3);
  });

  it('pxPerM: dodatnie i skończone', () => {
    const { pxPerM } = iso(hill);
    expect(pxPerM).toBeGreaterThan(0);
    expect(Number.isFinite(pxPerM)).toBe(true);
  });

  it('płaski bieg: wzmocnienie najwyżej ×3', () => {
    const r = iso(loop((t) => 200 + 3 * Math.sin(Math.PI * t)));
    expect(r.exaggeration).toBeGreaterThan(1);
    expect(r.exaggeration).toBeLessThanOrEqual(3);
  });

  it('wielka góra: bez wzmocnienia', () => {
    expect(iso(loop((t) => 500 + 3000 * Math.sin(Math.PI * t))).exaggeration).toBeCloseTo(1, 6);
  });

  it('nachylenie: pod górę 1, z góry -1; szum zegarka bez migotania', () => {
    // 40 m na 5 km to < 4%, więc stromsza góra (do ~12%).
    const r = iso(loop((t) => 200 + 200 * Math.sin(Math.PI * t)));
    expect(r.slope[20]).toBe(1);
    expect(r.slope[80]).toBe(-1);
    // Zygzak ±1,5 m co próbkę: same płaskie odcinki.
    expect(iso(loop((_, i) => 200 + (i % 2) * 3, 400)).slope.every((s) => s === 0)).toBe(true);
  });

  it('macierz przenosi płaskie płótno na podłoże 3D', () => {
    // Prosta o równych krokach: w środku średnia krocząca nie zmienia punktu.
    const n = 40;
    const s: RunStreams = {
      latlng: Array.from({ length: n }, (_, i) => [50.06 + i * 0.0003, 19.94 + i * 0.0005]),
      distance: Array.from({ length: n }, (_, i) => i * 45),
      altitude: Array.from({ length: n }, (_, i) => 200 + i),
    };
    const p = proj(s);
    const r = isoRoute(s, ROUTE_BOX, p)!;
    const [a, b, c, d, e, f] = r.matrix;
    const [x, y] = p([s.latlng[20][1], s.latlng[20][0]])!;
    expect(a * x + c * y + e).toBeCloseTo(r.ground[20][0], 6);
    expect(b * x + d * y + f).toBeCloseTo(r.ground[20][1], 6);
  });

  it('z DEM: wysokość z terenu, podniesienie liniowe w x, baseM = min na trasie', () => {
    // Płaszczyzna h = 1000 + 0,5·x na siatce 2000 × 2000 jednostek płótna.
    const w = 400;
    const z = new Float32Array(w * w);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) z[j * w + i] = 1000 + 0.5 * (-200 + (i + 0.5) * 10);
    const dem: Dem = { x0: -200, y0: -200, cell: 10, w, h: w, z, mPerUnit: 1 };
    const p = proj(hill);
    const r = isoRoute(hill, ROUTE_BOX, p, dem)!;
    // x płótna z punktu podłoża (odwrotność macierzy izometrii).
    const [ma, mb, , , me, mf] = r.matrix;
    const xs = r.ground.map(([gx, gy]) => ((gx - me) / ma + (gy - mf) / mb) / 2);
    expect(r.baseM).toBeCloseTo(1000 + 0.5 * Math.min(...xs), 3);
    // Podniesienie (ground − points w y) rośnie liniowo z x punktu płótna: stosunek stały.
    const rise = r.ground.map(([, gy], i) => gy - r.points[i][1]);
    const k = (rise[30] - rise[70]) / (xs[30] - xs[70]);
    expect((rise[10] - rise[70]) / (xs[10] - xs[70])).toBeCloseTo(k, 6);
    expect(k).toBeGreaterThan(0);
  });
});

describe('isoRoutes', () => {
  it('kolejność wejścia, null zostaje na miejscu, wspólna macierz i podstawa wysokości', () => {
    const run = (dLat: number, base: number): RunStreams => ({
      latlng: Array.from({ length: 20 }, (_, i) => [50 + dLat + i * 0.0005, 19 + i * 0.0003] as [number, number]),
      distance: Array.from({ length: 20 }, (_, i) => i * 60),
      altitude: Array.from({ length: 20 }, (_, i) => base + i),
    });
    const a = run(0, 200);
    const b = run(0.01, 300);
    const p = geoMercator().scale(200000).center([19, 50]).translate([540, 700]);
    const out = isoRoutes([a, null, b], ROUTE_BOX, p);
    expect(out).toHaveLength(3);
    expect(out[1]).toBeNull();
    expect(out[0]!.matrix).toEqual(out[2]!.matrix);
    expect(out[0]!.baseM).toBe(out[2]!.baseM);
    expect(Math.abs(out[0]!.baseM - 200)).toBeLessThan(2); // najniższy punkt obu tras (po wygładzeniu)
    expect(out[0]!.points).toHaveLength(20);
  });
});
