import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { momentsOf } from './moments';

const n = 1001; // 10 km co 10 m
const at = (fn: (f: number) => number) => Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
const base: RunStreams = { latlng: at(() => 0).map((v) => [v, v]), distance: at((f) => f * 10000) };
const peak = (c: number, lo: number, hi: number) => (f: number) => (Math.abs(f - c) < 0.03 ? hi : lo);

describe('momentsOf', () => {
  it('tętno, tempo i szczyt w kolejności dystansu, z etykietami', () => {
    const m = momentsOf({
      ...base,
      heartrate: at(peak(0.3, 150, 182)),
      velocity: at(peak(0.6, 3, 1000 / 252)),
      altitude: at((f) => 200 + 300 * Math.sin(Math.PI * f)),
    });
    expect(m.map((x) => x.kind)).toEqual(['hr', 'top', 'pace']);
    expect(m[0].label).toBe('MAX HR 182 bpm');
    expect(m[2].label).toBe('FASTEST 4:12 /km');
    expect(m[1].label).toBe('TOP 500 m');
    expect(m[0].f).toBeCloseTo(0.3, 1);
  });

  it('bez strumieni pusto; płasko bez szczytu; blisko siebie wygrywa tętno; brzegi pominięte', () => {
    expect(momentsOf(base)).toEqual([]);
    expect(momentsOf({ ...base, altitude: at((f) => 200 + 10 * f) })).toEqual([]);
    const m = momentsOf({ ...base, heartrate: at(peak(0.5, 150, 180)), velocity: at(peak(0.52, 3, 4)) });
    expect(m.map((x) => x.kind)).toEqual(['hr']);
    const edge = momentsOf({ ...base, heartrate: at((f) => 150 + 40 * f) });
    expect(edge[0].f).toBeLessThanOrEqual(0.97);
  });
});
