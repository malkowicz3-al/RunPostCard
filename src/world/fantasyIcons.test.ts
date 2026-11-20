import { describe, expect, it } from 'vitest';
import { mockActivities } from '../dev/mockActivities';
import type { Building } from '../lib/vectorMap';
import { DATA, LAYOUTS } from '../postcard/slots';
import { COMPASS_BOX, CORNERS, SERPENT_BOX, castles, center, corners, houseIcons, shipIcons } from './fantasyIcons';
import { segDist } from './geom';
import type { Pt } from './grid';

const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// Środki brył w 16k + 3: daleko od granic komórek 40 i 400 px i od połówek siatki 16 px (przesunięcie 0,3 px nic nie zmienia).
const small: Building[] = [];
for (let k = 0; k < 67; k++) for (let j = 0; j < 120; j++) small.push({ ring: rect(16 * k - 1, 16 * j - 1, 8, 8), h: 8, min: 0 });
const halls: Building[] = [];
for (let k = 0; k < 10; k++) for (let j = 0; j < 20; j++) halls.push({ ring: rect(16 * (6 + 12 * k) + 3 - 16, 16 * (6 + 6 * j) + 3 - 16, 32, 32 + k), h: 12, min: 0 });
const all = [...small, ...halls];
const route: Pt[] = [[540, 0], [540, 1920]];
const routeDist = ([x, y]: Pt) => segDist(x, y, route[0], route[1]);
const lake = 'M200 600L900 600L900 1200L200 1200Z';
const key = (p: Pt | { x: number; y: number }) => ('x' in p ? `${p.x}:${p.y}` : `${p[0]}:${p[1]}`);

describe('fantasyIcons', () => {
  it('domki i zamki: deterministycznie, jeden domek na komórkę, w gęstym mieście ok. 230, bez zamków pod domkami', () => {
    const c = castles(all);
    const houses = houseIcons(all, c);
    expect(houseIcons(all, c)).toEqual(houses);
    expect(houses.length).toBeGreaterThan(150);
    expect(houses.length).toBeLessThan(330);
    const cells = houses.map((h) => `${Math.floor(h.x / 40)}:${Math.floor(h.y / 40)}`);
    expect(new Set(cells).size).toBe(houses.length);
    expect(c.length).toBeGreaterThan(0);
    const castleCells = c.map((b) => center(b).map((v) => Math.floor(v / 400)).join(':'));
    expect(new Set(castleCells).size).toBe(c.length);
    for (const b of c) expect(houses.some((h) => key(h) === key(center(b).map(Math.round) as Pt))).toBe(false);
    expect(houseIcons(all.map((b) => ({ ...b, accent: '#a63d2a' }))).every((h) => h.roof === '#a63d2a')).toBe(true);
  });

  it('wybór nie zależy od zestawu: przesunięcie o 0,3 px i wycinek dają to samo we wspólnej części', () => {
    const shift = (bs: Building[]) => bs.map((b) => ({ ...b, ring: b.ring.map(([x, y]) => [x + 0.3, y + 0.3] as Pt) }));
    const at = (bs: Building[]) => {
      const c = castles(bs);
      return { houses: houseIcons(bs, c).map(key).sort(), castles: c.map((b) => center(b).map(Math.round).join(':')).sort() };
    };
    const base = at(all);
    expect(at(shift(all))).toEqual(base);
    // Wycinek wyrównany do siatek 40 i 400 px (jak refined po zoomie).
    const inRect = ([x, y]: Pt) => x >= 400 && x < 800 && y >= 400 && y < 1200;
    const part = at(all.filter((b) => inRect(center(b))));
    const parse = (k: string) => k.split(':').map(Number) as Pt;
    expect(part.houses).toEqual(base.houses.filter((k) => inRect(parse(k))));
    expect(part.castles).toEqual(base.castles.filter((k) => inRect(parse(k))));
    expect(part.houses.length).toBeGreaterThan(5);
  });

  it('statki: tylko na dużej wodzie, z dala od trasy, najwyżej 3, 250 px od siebie', () => {
    expect(shipIcons(undefined, route)).toEqual([]);
    expect(shipIcons('M0 0L100 0L100 100Z', route)).toEqual([]);
    const ships = shipIcons(lake, route);
    expect(shipIcons(lake, route)).toEqual(ships);
    expect(ships.length).toBeGreaterThan(0);
    expect(ships.length).toBeLessThanOrEqual(3);
    for (const s of ships) {
      expect(routeDist([s.x, s.y])).toBeGreaterThanOrEqual(60);
      expect(s.x).toBeGreaterThanOrEqual(245);
      expect(s.x).toBeLessThanOrEqual(855);
      expect(Math.abs(s.angle)).toBeLessThanOrEqual(10);
    }
    // Dziura (wyspa) w jeziorze: brak statku na wyspie.
    const island = `${lake}M300 650L500 650L500 1150L300 1150Z`;
    for (const s of shipIcons(island, route)) expect(s.x > 300 && s.x < 500).toBe(false);
  });

  it('rogi: róża wiatrów w pustszym górnym rogu', () => {
    const [tl, tr] = CORNERS;
    expect(corners([])).toEqual([tl, tr]);
    expect(corners([[100, 300], [150, 400]])).toEqual([tr, tl]);
    expect(corners([[950, 300]])).toEqual([tl, tr]);
  });

  it('róża i wąż w obu rogach nie nachodzą na statystyki górnych układów', () => {
    const run = mockActivities()[0];
    const boxes = CORNERS.flatMap(([cx, cy]) => [COMPASS_BOX, SERPENT_BOX].map(([x0, y0, x1, y1]) => [cx + x0, cy + y0, cx + x1, cy + y1]));
    for (const layout of Object.values(LAYOUTS))
      for (const item of layout.items) {
        if (item.y >= 450) continue;
        // Najgorszy przypadek: pełna maxW, font powiększony do 1.1, etykieta pod wartością.
        const b = item.box ?? (() => {
          const w = Math.max(item.maxW, 0);
          const x0 = item.anchor === 'start' ? item.x : item.anchor === 'end' ? item.x - w : item.x - w / 2;
          const below = (item.labelPos ?? 'below') === 'below';
          return { x0, y0: item.y - 0.75 * item.size * 1.1, x1: x0 + w, y1: below ? item.y + 68 : item.y + 0.2 * item.size * 1.1 };
        })();
        for (const [x0, y0, x1, y1] of boxes) {
          const hit = b.x0 < x1 && b.x1 > x0 && b.y0 < y1 && b.y1 > y0;
          expect(hit, `${layout.id}.${item.slot.id} (${DATA[item.slot.data].value(run)})`).toBe(false);
        }
      }
  });
});
