import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { HR_ZONES, kmSplits, series, zoneOf, zoneShare } from './chartData';

// Prosta trasa: punkt co 10 m, 3 s na 10 m (tempo 5:00), poza km 2 szybszym (2 s na 10 m).
function run(meters: number): RunStreams {
  const distance: number[] = [];
  const time: number[] = [];
  for (let m = 0, t = 0; m <= meters; m += 10) {
    distance.push(m);
    time.push(t);
    t += m >= 1000 && m < 2000 ? 2 : 3;
  }
  return { latlng: distance.map(() => [0, 0]), distance, time, altitude: distance.map((m) => m / 10) };
}

describe('series', () => {
  it('próbkuje po dystansie z interpolacją; bez strumienia pusto', () => {
    const s = run(1000);
    expect(series(s, 'altitude', 5)).toEqual([0, 25, 50, 75, 100]);
    expect(series(s, 'heartrate')).toEqual([]);
  });

  it('stała seria zostaje stała; tętno 0 pominięte', () => {
    const s: RunStreams = { latlng: [], distance: [0, 10, 20, 30], heartrate: [150, 0, 150, 150] };
    expect(series(s, 'heartrate', 4)).toEqual([150, 150, 150, 150]);
  });
});

describe('kmSplits', () => {
  it('pełne km i niepełny ostatni od 300 m', () => {
    expect(kmSplits(run(3400))).toEqual([
      { km: 1, pace: 300 },
      { km: 1, pace: 200 },
      { km: 1, pace: 300 },
      { km: 0.4, pace: 300 },
    ]);
    expect(kmSplits(run(2200)).length).toBe(2);
    expect(kmSplits({ ...run(2200), time: undefined })).toEqual([]);
  });

  it('jeden odcinek; pauza nie wydłuża tempa; odcinek bez czasu pominięty', () => {
    expect(kmSplits(run(1200))).toEqual([{ km: 1, pace: 300 }]);
    const paused = run(1000);
    // 10 min stania w połowie km: liczy się najwyżej 10 s.
    paused.time = paused.time!.map((t, i) => (i > 50 ? t + 600 : t));
    expect(kmSplits(paused)[0].pace).toBeCloseTo(307);
    expect(kmSplits({ ...run(1000), time: run(1000).distance.map(() => 0) })).toEqual([]);
  });
});

describe('zoneShare', () => {
  it('udział czasu w 5 strefach z progów HR_ZONES', () => {
    expect(HR_ZONES).toEqual([0.6, 0.7, 0.8, 0.9]);
    expect([100, 119, 120, 150, 179, 180, 200].map((hr) => zoneOf(hr, 200))).toEqual([0, 0, 1, 2, 3, 4, 4]);
    const s: RunStreams = { latlng: [], distance: [0, 1, 2, 3], time: [0, 2, 4, 10], heartrate: [100, 100, 150, 190] };
    const z = zoneShare(s, 200);
    expect(z.map((x) => +x.toFixed(2))).toEqual([0.2, 0, 0.2, 0, 0.6]);
    // Pauza (dt 600 s) waży najwyżej 10 s; próbka z tętnem 0 pominięta.
    const paused = zoneShare({ ...s, time: [0, 10, 20, 620], heartrate: [100, 100, 0, 190] }, 200);
    expect(paused.map((x) => +x.toFixed(2))).toEqual([0.5, 0, 0, 0, 0.5]);
    expect(zoneShare({ ...s, heartrate: undefined }, 200)).toEqual([0, 0, 0, 0, 0]);
  });
});
