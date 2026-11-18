import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { highlights, TRIM_M } from './runHighlights';

// Bieg 2 km, próbka co 10 m i co 3 s.
function run(overrides: Partial<RunStreams> = {}, n = 201, step = 10): RunStreams {
  return {
    latlng: Array.from({ length: n }, (_, i) => [50 + i * 1e-4, 19] as [number, number]),
    distance: Array.from({ length: n }, (_, i) => i * step),
    time: Array.from({ length: n }, (_, i) => i * 3),
    ...overrides,
  };
}
const fill = (n: number, v: number) => Array.from({ length: n }, () => v);
const kinds = (s: RunStreams) => highlights(s).map((h) => h.kind);
const find = (s: RunStreams, kind: string) => highlights(s).find((h) => h.kind === kind);

describe('highlights', () => {
  it('pozycje wszystkich rodzajów, stała kolejność', () => {
    const heartrate = fill(201, 150);
    heartrate[120] = 180;
    heartrate[150] = 130;
    const altitude = fill(201, 200);
    altitude[80] = 260;
    const velocity = fill(201, 3);
    for (let i = 55; i < 65; i++) velocity[i] = 5;
    const s = run({ heartrate, altitude, velocity });
    expect(kinds(s)).toEqual(['fastest', 'maxHr', 'minHr', 'highest']);
    expect(find(s, 'maxHr')).toEqual({ kind: 'maxHr', index: 120, value: 180 });
    expect(find(s, 'minHr')).toEqual({ kind: 'minHr', index: 150, value: 130 });
    expect(find(s, 'highest')).toEqual({ kind: 'highest', index: 80, value: 260 });
    expect(find(s, 'fastest')).toEqual({ kind: 'fastest', index: 60, value: 5 });
  });

  it('bez tętna nie ma markerów tętna', () => {
    expect(kinds(run({ altitude: fill(201, 1) }))).toEqual(['highest']);
  });

  it('szczyty tętna w pierwszych i ostatnich 200 m są pomijane', () => {
    const heartrate = fill(201, 150);
    heartrate[5] = 200; // 50 m
    heartrate[198] = 200; // 1980 m
    heartrate[100] = 170;
    const max = find(run({ heartrate }), 'maxHr')!;
    expect(max.index).toBe(100);
    expect(run().distance[max.index]).toBeGreaterThanOrEqual(TRIM_M);
  });

  it('najniższe tętno dopiero po 300 s', () => {
    const heartrate = fill(201, 150);
    heartrate[30] = 100; // 90 s, po przycięciu ale przed 5 min
    heartrate[90] = 130; // 270 s
    heartrate[140] = 140; // 420 s
    heartrate[160] = 170;
    expect(find(run({ heartrate }), 'minHr')?.index).toBe(140);
  });

  it('najszybszy: pojedynczy skok przegrywa z plateau 10 próbek', () => {
    const velocity = fill(201, 3);
    velocity[50] = 20; // skok GPS: średnia 10 próbek ~4.7
    for (let i = 130; i < 140; i++) velocity[i] = 5; // plateau: średnia 5
    expect(find(run({ velocity }), 'fastest')?.index).toBe(135);
  });

  it('trasa krótsza niż 400 m -> []', () => {
    expect(highlights(run({ heartrate: fill(39, 150) }, 39, 10))).toEqual([]);
  });
});
