import { describe, expect, it } from 'vitest';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { liveValue } from './liveValue';
import { DATA, type SlotData } from './slots';

const runs = mockActivities();
const hills = runs.find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);
const ALL = Object.keys(DATA) as SlotData[];
// "1:02:03" -> s, "12,345" -> 12345, "6.40" -> 6.4
const num = (s: string) =>
  s.includes(':') ? s.split(':').reduce((acc, x) => acc * 60 + Number(x), 0) : Number(s.replaceAll(',', ''));

describe('liveValue', () => {
  it('p=1 (i więcej) daje dokładnie wartość DATA, ze strumieniami i bez', () => {
    for (const a of runs) {
      for (const s of [mockStreams(a), null]) {
        for (const data of ALL) {
          expect(liveValue(data, a, s, 1)).toBe(DATA[data].value(a));
          expect(liveValue(data, a, s, 1.2)).toBe(DATA[data].value(a));
        }
      }
    }
  });

  it('bez NaN, undefined i Infinity dla wszystkich danych przy p = 0..0.99', () => {
    for (const s of [streams, null]) {
      for (const data of ALL) {
        for (const p of [0, 0.001, 0.3, 0.7, 0.99]) {
          const v = liveValue(data, hills, s, p);
          expect(typeof v).toBe('string');
          expect(v).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });

  it('wartości narastające nie maleją i zaczynają od zera', () => {
    for (const s of [streams, null]) {
      for (const data of ['distance', 'time', 'elapsed', 'elevation', 'steps', 'stopped'] as SlotData[]) {
        let prev = -1;
        for (let p = 0; p <= 1; p += 0.05) {
          const v = num(liveValue(data, hills, s, p));
          expect(v).toBeGreaterThanOrEqual(prev);
          prev = v;
        }
        expect(num(liveValue(data, hills, s, 0))).toBe(0);
      }
    }
  });

  it('średnie i maksima zbiegają do wartości końcowej', () => {
    for (const data of ['pace', 'heartrate', 'maxhr', 'speed', 'maxspeed', 'cadence', 'elevkm'] as SlotData[]) {
      const final = num(DATA[data].value(hills));
      expect(Math.abs(num(liveValue(data, hills, streams, 0.999)) - final)).toBeLessThanOrEqual(final * 0.01 + 1);
    }
  });

  it('tętno zerowe przez pierwsze 300 m: max nie maleje i nie startuje od wartości końcowej', () => {
    const d = streams.distance;
    const total = d[d.length - 1];
    const heartrate = d.map((x) => (x <= 300 ? 0 : Math.round(120 + (62 * x) / total)));
    const s = { ...streams, heartrate };
    const a = { ...hills, max_heartrate: 182 };
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.02) {
      const v = num(liveValue('maxhr', a, s, p));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(num(liveValue('maxhr', a, s, 0))).toBeLessThan(150);
    expect(num(liveValue('heartrate', a, s, 0))).toBeGreaterThan(0);
  });

  it('tekst pisze się do 40% animacji', () => {
    const name = DATA.name.value(hills);
    expect(liveValue('name', hills, streams, 0)).toBe('');
    expect(liveValue('name', hills, streams, 0.2)).toBe(Array.from(name).slice(0, Math.ceil(name.length / 2)).join(''));
    expect(liveValue('name', hills, streams, 0.4)).toBe(name);
    expect(liveValue('name', { ...hills, name: ' ' }, streams, 0.1)).toBe('–');
  });
});
