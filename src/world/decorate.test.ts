import { describe, expect, it } from 'vitest';
import { mockActivities } from '../dev/mockActivities';
import { fitRoute } from '../lib/routePath';
import type { Building, MapLayers } from '../lib/vectorMap';
import { ROUTE_BOX } from '../postcard/Route';
import { decorateWorld, parseLines, worldProps } from './decorate';
import { GENRES } from './genres';

const points = fitRoute(mockActivities()[0].map.summary_polyline, ROUTE_BOX)!.points;
const rect = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// Ręczna mapa: siatka bloków na płótnie i kilka brył położonych na trasie.
const buildings: Building[] = [
  ...Array.from({ length: 48 }, (_, k) => ({ ring: rect(40 + (k % 8) * 130, 60 + Math.floor(k / 8) * 300, 50, 40), h: 8 + ((k * 13) % 53), min: 0 })),
  ...[0.2, 0.5, 0.8].map((f) => Math.floor(f * points.length)).map((i) => ({ ring: rect(points[i][0] - 10, points[i][1] - 10, 20, 20), h: 40, min: 0 })),
];
const lines = (n: number, step: number, vertical: boolean) =>
  Array.from({ length: n }, (_, k) => (vertical ? `M${k * step + 0.5} -20L${k * step + 0.5} 1940` : `M-20 ${k * step - 0.25}L1100 ${k * step - 0.25}`)).join('');
const LAYERS: MapLayers = {
  minor: lines(10, 110, true),
  mid: lines(8, 250, false),
  major: 'M0 960L1080 960',
  water: 'M0 0L100 0L100 100Z',
  building: buildings.map((b) => `M${b.ring.join('L')}Z`).join(''),
  buildings,
};

const segDist = ([px, py]: [number, number], [ax, ay]: [number, number], [bx, by]: [number, number]) => {
  const [dx, dy] = [bx - ax, by - ay];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const routeDist = (p: [number, number]) => Math.min(...points.slice(1).map((b, i) => segDist(p, points[i], b)));

describe('decorateWorld', () => {
  it('deterministyczny; inne ziarno zmienia neon i szyldy, nie geometrię', () => {
    const a = decorateWorld(LAYERS, points, 7, 'scifi');
    expect(decorateWorld(LAYERS, points, 7, 'scifi')).toEqual(a);
    const b = decorateWorld(LAYERS, points, 8, 'scifi');
    expect(b.buildings!.map((x) => x.ring)).toEqual(a.buildings!.map((x) => x.ring));
    expect(b.buildings!.map((x) => `${x.accent}${x.sign}`)).not.toEqual(a.buildings!.map((x) => `${x.accent}${x.sign}`));
    expect(LAYERS.buildings![0].accent).toBeUndefined(); // wejście nietknięte
  });

  it('bez brył w 17 px od trasy (wierzchołki i punkty krawędzi); trasa jako major, prawdziwe major w mid', () => {
    const d = decorateWorld(LAYERS, points, 1, 'scifi');
    expect(d.buildings!.length).toBeLessThan(buildings.length);
    expect(d.buildings!.length).toBeGreaterThan(30);
    for (const { ring } of d.buildings!)
      ring.forEach(([ax, ay], k) => {
        const [bx, by] = ring[(k + 1) % ring.length];
        for (const t of [0, 0.25, 0.5, 0.75]) expect(routeDist([ax + (bx - ax) * t, ay + (by - ay) * t])).toBeGreaterThanOrEqual(17);
      });
    expect(d.major).toBe(`M${points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}`);
    expect(d.mid).toContain(LAYERS.major);
    expect(d.mid!.startsWith(LAYERS.mid!)).toBe(true);
    expect(d.building).toBe(d.buildings!.map((b) => `M${b.ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join(''));
  });

  it('duża bryła, której ścianę trasa przecina między wierzchołkami, znika', () => {
    // Trasa pionowa x = 500 przecina górną i dolną ścianę w 3/8 długości: 37,5 px od próbek co 1/4, daleko od wierzchołków.
    const route: [number, number][] = [[500, 0], [500, 1920]];
    const hall = { ring: rect(387.5, 100, 300, 300), h: 12, min: 0 };
    const keep = { ring: rect(700, 100, 50, 50), h: 12, min: 0 };
    expect(decorateWorld({ buildings: [hall, keep] }, route, 1, 'scifi').buildings!.map((b) => b.ring)).toEqual([keep.ring]);
  });

  it('ten sam budynek w dwóch tablicach ma ten sam neon; szyld tylko od 25 m; neony z gatunku', () => {
    const one = buildings[5];
    const a = decorateWorld(LAYERS, points, 3, 'scifi').buildings!.find((b) => b.ring === one.ring)!;
    const b = decorateWorld({ buildings: [buildings[9], one] }, points, 3, 'scifi').buildings!.find((x) => x.ring === one.ring)!;
    expect([b.accent, b.sign]).toEqual([a.accent, a.sign]);
    for (const seed of [1, 2, 3, 4, 5]) {
      const d = decorateWorld(LAYERS, points, seed, 'scifi').buildings!;
      for (const x of d) {
        expect(GENRES.scifi.accents).toContain(x.accent);
        if (x.sign) expect(x.h).toBeGreaterThanOrEqual(25);
      }
    }
  });
});

describe('gęstość i ruiny', () => {
  // Niskie małe domki (poniżej progów dużej bryły): tylko one mogą zniknąć przy keep < 1.
  const houses: Building[] = Array.from({ length: 300 }, (_, k) => ({ ring: rect(20 + (k % 20) * 52, 30 + Math.floor(k / 20) * 125, 20, 20), h: 10, min: 0 }));
  const big: Building[] = [
    { ring: rect(300, 300, 20, 20), h: 30, min: 0 },
    { ring: rect(600, 300, 80, 20), h: 10, min: 0 },
  ];

  it('Fantasy: ok. 75% małych brył, deterministycznie, duże zawsze zostają, bez szyldów', () => {
    const all = decorateWorld({ buildings: houses }, points, 4, 'scifi').buildings!.length;
    const kept = decorateWorld({ buildings: houses }, points, 4, 'fantasy').buildings!;
    expect(kept.length / all).toBeGreaterThan(0.6);
    expect(kept.length / all).toBeLessThan(0.9);
    expect(decorateWorld({ buildings: houses }, points, 4, 'fantasy').buildings).toEqual(kept);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const d = decorateWorld({ buildings: big }, [[0, 0], [1, 0]], seed, 'fantasy').buildings!;
      expect(d.map((b) => b.ring)).toEqual(big.map((b) => b.ring));
    }
    for (const id of ['fantasy', 'postapo'] as const)
      expect(decorateWorld(LAYERS, points, 2, id).buildings!.some((b) => b.sign)).toBe(false);
    expect(decorateWorld(LAYERS, points, 2, 'scifi').buildings!.some((b) => b.sign)).toBe(true);
  });

  it('bryła przesunięta o 2 px (te same komórki 16 px) zachowuje gęstość i ruinę', () => {
    // Środki w 36 + 16k (z przesunięciem 38 + 16k), daleko od granic komórek w 8 + 16k (zaokrąglenie cx / 16).
    const at = (dx: number) => Array.from({ length: 60 }, (_, k): Building => ({ ring: rect(26 + (k % 10) * 96 + dx, 26 + Math.floor(k / 10) * 160 + dx, 20, 20), h: 15, min: 0 }));
    for (const id of ['fantasy', 'postapo'] as const) {
      const outcome = (dx: number) => decorateWorld({ buildings: at(dx) }, [[0, 0], [1, 0]], 9, id).buildings!.map((b) => `${b.ring[0][0] - dx}:${b.h}`);
      expect(outcome(2), id).toEqual(outcome(0));
      expect(new Set(outcome(0).map((o) => o.split(':')[1])).size + 60 - outcome(0).length, id).toBeGreaterThan(1); // los coś zmienia
    }
  });

  it('Post-apo: część brył obcięta, ale co najmniej min + 3 m; ten sam budynek w dwóch tablicach tak samo', () => {
    const d = decorateWorld(LAYERS, points, 3, 'postapo').buildings!;
    const src = new Map(buildings.map((b) => [b.ring, b]));
    const cut = d.filter((b) => b.h < src.get(b.ring)!.h);
    expect(cut.length).toBeGreaterThan(d.length * 0.25);
    expect(cut.length).toBeLessThan(d.length * 0.75);
    for (const b of d) expect(b.h).toBeGreaterThanOrEqual(b.min + 3);
    expect(d.length).toBe(decorateWorld(LAYERS, points, 3, 'scifi').buildings!.length); // keep 1
    const one = buildings[7];
    const other = decorateWorld({ buildings: [buildings[2], one] }, points, 3, 'postapo').buildings!.find((b) => b.ring === one.ring)!;
    expect(other).toEqual(d.find((b) => b.ring === one.ring));
  });
});

describe('worldProps', () => {
  it('Fantasy bez pojazdów; Post-apo same auta z gatunkiem', () => {
    expect(worldProps(LAYERS, points, 5, 'fantasy')).toEqual([]);
    const wrecks = worldProps(LAYERS, points, 5, 'postapo');
    expect(wrecks.length).toBeGreaterThan(0);
    expect(wrecks.length).toBeLessThanOrEqual(GENRES.postapo.props.cars);
    expect(wrecks.every((p) => p.kind === 'car' && p.genre === 'postapo')).toBe(true);
  });

  it('parser linii: liczby ujemne i ułamkowe', () => {
    expect(parseLines('M-3.5 2L10 -4.25M1 1L2 2')).toEqual([[[-3.5, 2], [10, -4.25]], [[1, 1], [2, 2]]]);
  });

  it('auta poza ulicą trasy (34 px), statki w płótnie z marginesem, liczby całkowite, w limitach, szybko', () => {
    const t = performance.now();
    const props = worldProps(LAYERS, points, 5, 'scifi');
    expect(performance.now() - t).toBeLessThan(500);
    expect(worldProps(LAYERS, points, 5, 'scifi')).toEqual(props);
    const cars = props.filter((p) => p.kind === 'car');
    const ships = props.filter((p) => p.kind === 'ship');
    expect(cars.length).toBeGreaterThan(0);
    expect(cars.length).toBeLessThanOrEqual(GENRES.scifi.props.cars);
    expect(ships.length).toBeLessThanOrEqual(GENRES.scifi.props.ships);
    for (const p of props) expect([p.x, p.y, p.angle].every(Number.isInteger)).toBe(true);
    for (const c of cars) expect(routeDist([c.x, c.y])).toBeGreaterThanOrEqual(33); // 34 px przed zaokrągleniem
    for (const s of ships) {
      expect(s.x).toBeGreaterThanOrEqual(162);
      expect(s.x).toBeLessThanOrEqual(918);
      expect(s.y).toBeGreaterThanOrEqual(288);
      expect(s.y).toBeLessThanOrEqual(1632);
    }
  });
});
