import { describe, expect, it } from 'vitest';
import { mockActivities } from '../dev/mockActivities';
import { FONTS } from '../lib/fonts';
import { ROUTE_BOX } from './Route';
import {
  DATA,
  LAYOUT_ORDER,
  LAYOUTS,
  defaultLayout,
  fitSize,
  est,
  resolveLayout,
  slotBox,
  swapSlot,
  type Box,
  type LayoutId,
  type SlotData,
} from './slots';

const ALL_DATA = Object.keys(DATA) as SlotData[];
const runs = mockActivities();

describe('DATA', () => {
  it('każde dane formatują każdy bieg na niepusty tekst', () => {
    for (const d of ALL_DATA) for (const run of runs) expect(DATA[d].value(run).length).toBeGreaterThan(0);
  });

  it('bieg bez tętna i kadencji daje dokładnie myślnik', () => {
    const noHr = runs.find((r) => !r.average_heartrate)!;
    for (const d of ['heartrate', 'maxhr', 'cadence'] as const) expect(DATA[d].value(noHr)).toBe('–');
  });
});

describe('swapSlot', () => {
  const items = resolveLayout('classic');

  it('nieużywane dane trafiają tylko do wybranego slotu', () => {
    expect(swapSlot(items, 'a', 'cadence')).toEqual({ main: 'distance', a: 'cadence', b: 'pace', c: 'heartrate', d: 'date' });
  });

  it('dane z innego slotu zamieniają się miejscami, bez duplikatów', () => {
    const map = swapSlot(items, 'a', 'distance');
    expect(map).toEqual({ main: 'time', a: 'distance', b: 'pace', c: 'heartrate', d: 'date' });
    expect(new Set(Object.values(map)).size).toBe(items.length);
  });

  it('te same dane albo nieznany slot: bez zmian', () => {
    const same = { main: 'distance', a: 'time', b: 'pace', c: 'heartrate', d: 'date' };
    expect(swapSlot(items, 'a', 'time')).toEqual(same);
    expect(swapSlot(items, 'zzz', 'cadence')).toEqual(same);
  });
});

describe('resolveLayout', () => {
  it('bez i z nadpisaniami', () => {
    expect(resolveLayout('hero').map((i) => i.slot.data)).toEqual(['distance', 'time', 'pace']);
    expect(resolveLayout('hero', { a: 'elevation' }).map((i) => i.slot.data)).toEqual(['distance', 'elevation', 'pace']);
    expect(LAYOUTS.hero.items[1].slot.data).toBe('time');
  });

  it('classic ma pozycje dawnego domyślnego układu', () => {
    const old = [
      ['distance', 540, 1420, 300],
      ['time', 270, 1640, 100],
      ['pace', 540, 1640, 100],
      ['heartrate', 810, 1640, 100],
      ['date', 540, 1790, 56],
    ];
    expect(defaultLayout.map((i) => [i.slot.data, i.x, i.y, i.size])).toEqual(old);
  });

  it('każdy układ ma 1–6 slotów z unikalnymi id; LAYOUT_ORDER obejmuje wszystkie', () => {
    expect([...LAYOUT_ORDER].sort()).toEqual(Object.keys(LAYOUTS).sort());
    for (const id of LAYOUT_ORDER) {
      const ids = LAYOUTS[id].items.map((i) => i.slot.id);
      expect(ids.length).toBeGreaterThanOrEqual(1);
      expect(ids.length).toBeLessThanOrEqual(6);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('fitSize', () => {
  it('mieści się w maxW i nie powiększa (bez dolnej granicy)', () => {
    expect(fitSize('100.00', 300, 960)).toBe(300);
    const fs = fitSize('12:34:56', 300, 600);
    expect(est('12:34:56') * fs).toBeLessThanOrEqual(600.0001);
    expect(est('x'.repeat(200)) * fitSize('x'.repeat(200), 100, 100)).toBeCloseTo(100);
  });
});

const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const rect = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
const FORBIDDEN: [string, Box][] = [
  ['route', rect(ROUTE_BOX[0][0], ROUTE_BOX[0][1], ROUTE_BOX[1][0], ROUTE_BOX[1][1])],
  ['strava', rect(60, 1820, 455, 1860)],
  ['osm', rect(420, 1855, 1080, 1920)],
];
const WORST = ['100.00', '12:34:56', 'W'.repeat(27) + '…', '15 Nov 2026'];

describe('geometria układów', () => {
  it('każdy slot z każdymi danymi i fontem mieści się na płótnie i niczego nie zasłania', () => {
    const errors: string[] = [];
    for (const id of LAYOUT_ORDER as LayoutId[]) {
      for (const font of Object.keys(FONTS) as (keyof typeof FONTS)[]) {
        const { scale } = FONTS[font];
        for (const value of WORST) {
          for (const d of ALL_DATA) {
            const boxes = LAYOUTS[id].items.map((i) => ({ id: i.slot.id, box: slotBox({ ...i, slot: { ...i.slot, data: d } }, value, scale) }));
            for (const { id: sid, box } of boxes) {
              const tag = `${id}.${sid} ${font} ${d} "${value}"`;
              if (box.x0 < 40 || box.x1 > 1040 || box.y0 < 0 || box.y1 > 1920) errors.push(`${tag} poza płótnem`);
              for (const [name, f] of FORBIDDEN) if (overlap(box, f)) errors.push(`${tag} zasłania ${name}`);
            }
            for (let i = 0; i < boxes.length; i++)
              for (let j = i + 1; j < boxes.length; j++)
                if (overlap(boxes[i].box, boxes[j].box)) errors.push(`${id} ${font} ${d} "${value}": ${boxes[i].id} × ${boxes[j].id}`);
          }
        }
      }
    }
    expect([...new Set(errors)].slice(0, 20)).toEqual([]);
  });
});
