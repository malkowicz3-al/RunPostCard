import { describe, expect, it } from 'vitest';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { backdropArea } from '../lib/backdrop';
import { isoRoute } from '../lib/isoRoute';
import type { Rect } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import type { Building } from '../lib/vectorMap';
import { ROUTE_BOX } from '../postcard/Route';
import { generateWorld } from './generate';
import { GENRES } from './genres';

const RUNS = mockActivities().slice(0, 3);
const routes = RUNS.map((r) => fitRoute(r.map.summary_polyline, ROUTE_BOX)!.points);
const POSTCARD: Rect = [-162, -288, 1242, 2208]; // płótno z marginesem 15%
const CORRIDOR = 0.45 * GENRES.scifi.block;

const segDist = ([px, py]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const [dx, dy] = [bx - ax, by - ay];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const routeDist = (p: [number, number], pts: [number, number][]) =>
  Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
const centroid = ({ ring }: Building): [number, number] => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];
const layerText = (w: ReturnType<typeof generateWorld>) =>
  Object.entries(w.layers)
    .filter(([k]) => k !== 'buildings')
    .map(([, v]) => v)
    .join('');

describe('generateWorld', () => {
  it('deterministyczny; inne ziarno daje inny świat', () => {
    const a = generateWorld(routes[0], POSTCARD, 7, 'scifi');
    expect(generateWorld(routes[0], POSTCARD, 7, 'scifi')).toEqual(a);
    expect(generateWorld(routes[0], POSTCARD, 8, 'scifi').layers.building).not.toBe(a.layers.building);
  });

  it('bez NaN i Infinity, współrzędne całkowite, trasa jako droga major', () => {
    const w = generateWorld(routes[0], POSTCARD, 1, 'scifi');
    const text = layerText(w);
    expect(text).not.toMatch(/NaN|Infinity/);
    expect(text).not.toMatch(/\d\.\d/);
    for (const b of w.layers.buildings!) for (const [x, y] of b.ring) expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
    for (const p of w.props) expect([p.x, p.y, p.angle].every(Number.isInteger)).toBe(true);
    expect(w.layers.major).toMatch(/^M/);
    expect(w.layers.minor).toBeDefined();
    expect(w.layers.building).toBeDefined();
  });

  it('korytarz trasy bez budynków (środek i wierzchołki)', () => {
    routes.forEach((pts, k) => {
      const w = generateWorld(pts, POSTCARD, k + 1, 'scifi');
      for (const b of w.layers.buildings!) {
        expect(routeDist(centroid(b), pts)).toBeGreaterThanOrEqual(CORRIDOR);
        for (const v of b.ring) expect(routeDist(v, pts)).toBeGreaterThanOrEqual(CORRIDOR);
      }
    });
  });

  it('w prostokącie pocztówki (płasko i podłoga 3D): brył < 1500, SVG < 300 KB, pojazdy w limitach', () => {
    const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
    const fit = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!;
    const iso = isoRoute(mockStreams(hills), ROUTE_BOX, fit.projection)!;
    const floor = backdropArea([0, 0, 1080, 1920], { zoom: 1, x: 0, y: 0 }, 0.15, iso.matrix);
    for (const [pts, rect] of [...routes.map((p) => [p, POSTCARD] as const), [fit.points, floor] as const]) {
      const w = generateWorld(pts, rect, 3, 'scifi');
      expect(layerText(w).length).toBeLessThan(300_000);
      expect(w.layers.buildings!.length).toBeLessThan(1500);
      expect(w.props.filter((p) => p.kind === 'car').length).toBeLessThanOrEqual(GENRES.scifi.props.cars);
      expect(w.props.filter((p) => p.kind === 'ship').length).toBeLessThanOrEqual(GENRES.scifi.props.ships);
    }
  });

  it('część wspólna dwóch prostokątów jest identyczna (bryły i auta), także dla dużego prostokąta', () => {
    const B = GENRES.scifi.block;
    const cases: [Rect, Rect, Rect][] = [
      // [a, b, część wspólna]
      [[-162, -288, 900, 1500], [300, 400, 1242, 2208], [300, 400, 900, 1500]],
      // Duży (dawny limit 1500 brył by zadziałał) i pocztówka.
      [[-3000, -3000, 4000, 5000], POSTCARD, POSTCARD],
    ];
    for (const [ra, rb, [x0, y0, x1, y1]] of cases) {
      const a = generateWorld(routes[1], ra, 5, 'scifi');
      const b = generateWorld(routes[1], rb, 5, 'scifi');
      const inside = ([x, y]: [number, number]) => x > x0 + 2 * B && x < x1 - 2 * B && y > y0 + 2 * B && y < y1 - 2 * B;
      const sa = a.layers.buildings!.filter((bd) => inside(centroid(bd))).map((bd) => JSON.stringify(bd)).sort();
      const sb = b.layers.buildings!.filter((bd) => inside(centroid(bd))).map((bd) => JSON.stringify(bd)).sort();
      expect(sa.length).toBeGreaterThan(0);
      expect(sa).toEqual(sb);
      const cars = (w: typeof a) => w.props.filter((p) => p.kind === 'car' && inside([p.x, p.y])).map((p) => JSON.stringify(p)).sort();
      expect(cars(a).length).toBeGreaterThan(0);
      expect(cars(a)).toEqual(cars(b));
    }
  });

  it('każda bryła z neonem gatunku, szyld tylko na wysokich; ulica trasy (pół szerokości 17 px) z dala od brył', () => {
    for (const seed of [1, 4, 99, 12345]) {
      const { buildings } = generateWorld(routes[0], POSTCARD, seed, 'scifi').layers;
      for (const b of buildings!) {
        expect(GENRES.scifi.accents).toContain(b.accent);
        if (b.sign) expect(b.h).toBeGreaterThanOrEqual(80);
        // Odległość krawędzi obrysu od trasy: próbki co 1/8 krawędzi, tylko brył blisko trasy (bok kwartału < 100 px).
        if (routeDist(centroid(b), routes[0]) < 100)
          b.ring.forEach(([ax, ay], k) => {
            const [bx, by] = b.ring[(k + 1) % b.ring.length];
            for (let t = 0; t <= 1; t += 0.125)
              expect(routeDist([ax + (bx - ax) * t, ay + (by - ay) * t], routes[0])).toBeGreaterThan(17);
          });
      }
      expect(new Set(buildings!.map((b) => b.accent)).size).toBe(GENRES.scifi.accents.length);
      expect(buildings!.some((b) => b.sign)).toBe(true);
    }
  });

  it('budżet: prostokąt pocztówki < 500 ms (tylko rząd wielkości) i < 300 KB', () => {
    generateWorld(routes[2], POSTCARD, 9, 'scifi'); // rozgrzanie JIT
    const t = performance.now();
    const w = generateWorld(routes[2], POSTCARD, 10, 'scifi');
    expect(performance.now() - t).toBeLessThan(500);
    expect(layerText(w).length).toBeLessThan(300_000);
  });
});
