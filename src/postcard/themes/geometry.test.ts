import { describe, expect, it } from 'vitest';
import type { Area, MapObjects, Rect, Ring } from '../../lib/vectorMap';
import { defaultLayout } from '../slots';
import { placeIcons, pointInPolygon, slotZones, snap, staircase, type PlaceOpts, type PlaceInput } from './geometry';

const rect = (x0: number, y0: number, x1: number, y1: number): Ring => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const area = (x0: number, y0: number, x1: number, y1: number): Area => ({
  rings: [rect(x0, y0, x1, y1)],
  area: (x1 - x0) * (y1 - y0),
  box: [x0, y0, x1, y1],
});

const ROUTE: [number, number][] = [[200, 700], [880, 700], [880, 400]];
const EXTRA: Rect = [500, 300, 700, 500];
const BUILDINGS = [
  { x: 150, y: 130, area: 900 },
  { x: 275, y: 130, area: 100 },
  { x: 400, y: 130, area: 800 },
  { x: 525, y: 130, area: 50 },
  { x: 650, y: 130, area: 700 },
  { x: 900, y: 130, area: 600 },
];
const objects = (water: Area[]): MapObjects => ({
  buildings: BUILDINGS,
  green: [area(100, 300, 1000, 600)],
  water,
});
const input = (seed = 1, water = [area(100, 760, 1000, 1150)]): PlaceInput => ({
  map: { layers: {}, objects: objects(water) },
  size: [1080, 1920],
  route: ROUTE,
  seed,
  exclude: [...slotZones(defaultLayout), EXTRA],
});
const OPTS: PlaceOpts = {
  routeWidth: 10,
  dragon: { min: 160, max: 260, minWater: 30000 },
  castles: { count: 4, spacing: 220, k: 3, min: 64, max: 110 },
  houses: { count: 30, spacing: 80, k: 2.5, min: 30, max: 44 },
  trees: { spacing: 36, size: 28, max: 400 },
};

type Box = { x: number; y: number; w: number; h: number };
const all = (p: ReturnType<typeof placeIcons>): Box[] => [
  ...(p.dragon ? [p.dragon] : []),
  ...p.castles,
  ...p.houses,
  ...p.trees,
];
const overlaps = ({ x, y, w, h }: Box, [x0, y0, x1, y1]: Rect) => x < x1 && x0 < x + w && y < y1 && y0 < y + h;
const distToBox = ([px, py]: [number, number], { x, y, w, h }: Box) =>
  Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h));
const routeDist = (icons: Box[]) => {
  let min = Infinity;
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const [[ax, ay], [bx, by]] = [ROUTE[i], ROUTE[i + 1]];
    const n = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s <= n; s++)
      for (const icon of icons) min = Math.min(min, distToBox([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n], icon));
  }
  return min;
};

describe('pointInPolygon', () => {
  const rings = [rect(0, 0, 100, 100), rect(40, 40, 60, 60).reverse()];
  it('wewnątrz, na zewnątrz, w otworze', () => {
    expect(pointInPolygon([10, 10], rings)).toBe(true);
    expect(pointInPolygon([150, 10], rings)).toBe(false);
    expect(pointInPolygon([50, 50], rings)).toBe(false);
  });
});

describe('placeIcons', () => {
  const placed = placeIcons(input(), OPTS);

  it('ten sam seed daje identyczny wynik, inny seed inne drzewa', () => {
    expect(placeIcons(input(), OPTS)).toEqual(placed);
    expect(placeIcons(input(2), OPTS).trees).not.toEqual(placed.trees);
    expect(placed.trees.length).toBeGreaterThan(50);
  });

  it('wszystkie ikony w płótnie, poza strefami wykluczeń i buforem trasy', () => {
    const icons = all(placed);
    expect(icons.length).toBeGreaterThan(60);
    const zones = [...slotZones(defaultLayout), EXTRA];
    for (const icon of icons) {
      expect(icon.x).toBeGreaterThanOrEqual(0);
      expect(icon.y).toBeGreaterThanOrEqual(0);
      expect(icon.x + icon.w).toBeLessThanOrEqual(1080);
      expect(icon.y + icon.h).toBeLessThanOrEqual(1920);
      for (const z of zones) expect(overlaps(icon, z)).toBe(false);
    }
    // Trasa próbkowana co 1 jednostkę; bufor = połowa grubości + 12.
    expect(routeDist(icons)).toBeGreaterThanOrEqual(OPTS.routeWidth / 2 + 12);
  });

  it('drzewa leżą w zieleni', () => {
    for (const { x, y, w, h } of placed.trees)
      expect(pointInPolygon([x + w / 2, y + h / 2], objects([]).green[0].rings)).toBe(true);
  });

  it('zamki to największe budynki i zachowują odstęp', () => {
    expect(placed.castles).toHaveLength(4);
    const centers = placed.castles.map(({ x, y, w, h }) => [x + w / 2, y + h / 2]);
    // Środek ikony w obrębie drgania (size / 8) od środka budynku.
    for (const [i, b] of [BUILDINGS[0], BUILDINGS[2], BUILDINGS[4], BUILDINGS[5]].entries()) {
      expect(Math.abs(centers[i][0] - b.x)).toBeLessThanOrEqual(110 / 8);
      expect(Math.abs(centers[i][1] - b.y)).toBeLessThanOrEqual(110 / 8);
    }
    for (const a of placed.castles)
      for (const b of placed.castles) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(220);
  });

  it('smok trafia na dużą wodę, a bez miejsca go nie ma', () => {
    const d = placed.dragon!;
    expect([d.w, d.h]).toEqual([260, 260]);
    expect(pointInPolygon([d.x + d.w / 2, d.y + d.h / 2], [rect(100, 760, 1000, 1150)])).toBe(true);
    // Woda za mała na smoka: szuka na całej wolnej siatce, więc nie trafia w wodę.
    const dry = placeIcons(input(1, [area(100, 760, 200, 860)]), OPTS).dragon!;
    expect(pointInPolygon([dry.x + dry.w / 2, dry.y + dry.h / 2], [rect(100, 760, 200, 860)])).toBe(false);
    const full = placeIcons({ ...input(), exclude: [[0, 0, 1080, 1920]] }, OPTS);
    expect(full.dragon).toBeUndefined();
    expect(all(full)).toEqual([]);
    expect(placeIcons(input(), { ...OPTS, dragon: undefined }).dragon).toBeUndefined();
  });

  it('z grid: 24 współrzędne i wymiary na siatce 24, aspect daje wysokie ikony, bufor trasy rośnie o grid', () => {
    const grid = { ...OPTS, grid: 24, castles: { ...OPTS.castles, min: 96, max: 96, aspect: 2 } };
    const p = placeIcons(input(), grid);
    const icons = all(p);
    expect(icons.length).toBeGreaterThan(20);
    for (const { x, y, w, h } of icons) for (const v of [x, y, w, h]) expect(Number.isInteger(v / 24), String(v)).toBe(true);
    for (const c of p.castles) expect([c.w, c.h]).toEqual([96, 192]);
    expect(routeDist(icons)).toBeGreaterThanOrEqual(OPTS.routeWidth / 2 + 12 + 24);
  });
});

describe('staircase', () => {
  it('tylko odcinki H/V na siatce, początek i koniec jak w przyciągniętej trasie', () => {
    const pts: [number, number][] = [[13, 17], [250.4, 101.7], [251, 400], [100, 90], [100, 90], [37, 405]];
    const d = staircase(pts, 12);
    expect(d).toMatch(/^M-?\d+ -?\d+([HV]-?\d+)+$/);
    const [, mx, my] = d.match(/^M(-?\d+) (-?\d+)/)!.map(Number);
    expect([mx, my]).toEqual([snap(13, 12), snap(17, 12)]);
    let [x, y] = [mx, my];
    for (const [, cmd, v] of d.matchAll(/([HV])(-?\d+)/g)) {
      expect(Number(v) % 12).toBe(0);
      if (cmd === 'H') x = Number(v);
      else y = Number(v);
    }
    expect([x, y]).toEqual([snap(37, 12), snap(405, 12)]);
  });
});
