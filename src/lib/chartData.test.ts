import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import {
  HR_ZONES,
  bestSplits,
  cadenceBins,
  climbRates,
  distanceGoal,
  gainSeries,
  gradeSeries,
  halfHr,
  halfSplits,
  hrBins,
  kmGrades,
  kmSplits,
  paceBins,
  pacingSeries,
  series,
  speedHr,
  splitDeltas,
  swarm,
  zoneOf,
  zoneShare,
} from './chartData';

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

describe('kmGrades i gainSeries', () => {
  it('nachylenie na km i suma podjazdów bez zjazdów', () => {
    // run(): 1 m wysokości na 10 m, czyli 10%; ostatnie 400 m też 10%.
    expect(kmGrades(run(3400)).map((g) => +g.toFixed(3))).toEqual([10, 10, 10, 10]);
    const down = { ...run(2000), altitude: run(2000).distance.map((m) => (m <= 1000 ? m / 10 : 200 - m / 10)) };
    expect(kmGrades(down).map((g) => +g.toFixed(3))).toEqual([10, -10]);
    expect(kmGrades({ ...run(2000), altitude: undefined })).toEqual([]);
    const gain = gainSeries(down, 3);
    expect(gain.map((g) => +g.toFixed(3))).toEqual([0, 100, 100]);
    expect(gainSeries({ ...run(2000), altitude: undefined })).toEqual([]);
  });
});

describe('hrBins', () => {
  it('udział czasu w przedziałach 5 bpm, z pustymi w środku, skrajne poniżej 0,5% obcięte', () => {
    const hr = [0, ...Array(300).fill(140), 0, ...Array(100).fill(151), 90];
    const s: RunStreams = { latlng: [], distance: hr.map((_, i) => i), time: hr.map((_, i) => i), heartrate: hr };
    // 90 bpm to 1 z 401 s (<0,5%), więc odpada; 145–149 zostaje jako pusty przedział w środku.
    expect(hrBins(s).map((b) => [b.lo, +b.share.toFixed(3)])).toEqual([
      [140, 0.748],
      [145, 0],
      [150, 0.249],
    ]);
    expect(hrBins({ ...s, heartrate: undefined })).toEqual([]);
  });
});

describe('bestSplits i speedHr', () => {
  it('najszybsze pełne km od najszybszego, z numerem km', () => {
    expect(bestSplits(run(3400))).toEqual([
      { km: 2, pace: 200 },
      { km: 1, pace: 300 },
      { km: 3, pace: 300 },
    ]);
    expect(bestSplits(run(3400), 1)).toEqual([{ km: 2, pace: 200 }]);
    expect(bestSplits(run(800))).toEqual([]);
  });

  it('pary prędkość–tętno bez postojów; bez tętna pusto', () => {
    const s: RunStreams = { latlng: [], distance: [0, 10, 20, 30], velocity: [3, 3, 0, 0], heartrate: [150, 150, 150, 150] };
    expect(speedHr(s, 4)).toEqual([
      { speed: 3, hr: 150 },
      { speed: 3, hr: 150 },
    ]);
    expect(speedHr({ ...s, heartrate: undefined })).toEqual([]);
  });
});

describe('halfSplits, climbRates, cadenceBins', () => {
  it('tempo połówek z czasu w ruchu; bez czasu null', () => {
    // run(4000): km 2 szybszy (200 s), więc pierwsza połowa 2000 m = 500 s, druga 600 s.
    expect(halfSplits(run(4000))!.map(Math.round)).toEqual([250, 300]);
    expect(halfSplits({ ...run(4000), time: undefined })).toBeNull();
  });

  it('prędkość pionowa w m/h, zjazd ujemny', () => {
    // km 1: 100 m w górę w 300 s = 1200 m/h; zjazd tak samo, ale ujemny.
    const down = { ...run(2000), altitude: run(2000).distance.map((m) => (m <= 1000 ? m / 10 : 200 - m / 10)) };
    expect(climbRates(down, 2).map(Math.round)).toEqual([1200, -1800]);
    expect(climbRates({ ...down, altitude: undefined })).toEqual([]);
  });

  it('kadencja w przedziałach co 2, zera pominięte', () => {
    const cad = [0, 85, 85, 0, 88, 88];
    const s: RunStreams = { latlng: [], distance: cad.map((_, i) => i), time: cad.map((_, i) => i), cadence: cad };
    expect(cadenceBins(s).map((b) => [b.lo, b.share])).toEqual([
      [84, 0.5],
      [86, 0],
      [88, 0.5],
    ]);
  });
});

describe('distanceGoal i swarm', () => {
  it('najbliższy okrągły cel z zapasem 1%', () => {
    expect([4200, 5030, 9980, 10100, 21000, 25000, 42300, 60000].map(distanceGoal)).toEqual([5, 5, 10, 10, 21.0975, 30, 42.195, 100]);
  });

  it('bliskie kropki dostają kolejne poziomy, dalekie zostają na 0', () => {
    expect(swarm([0, 5, 8, 100], 10)).toEqual([0, 1, -1, 0]);
  });
});

describe('gradeSeries, halfHr, splitDeltas, pacingSeries, paceBins', () => {
  it('nachylenie w % z wysokości po dystansie; bez wysokości pusto', () => {
    // run(): wysokość = dystans / 10, czyli stałe 10%.
    for (const g of gradeSeries(run(2000), 50)) expect(g).toBeCloseTo(10);
    expect(gradeSeries({ ...run(2000), altitude: undefined })).toEqual([]);
  });

  it('średnie tętno połówek ważone czasem; bez tętna null', () => {
    const s = run(4000);
    const hr = s.distance.map((m) => (m <= 2000 ? 140 : 150));
    expect(halfHr({ ...s, heartrate: hr })!.map(Math.round)).toEqual([140, 150]);
    expect(halfHr(s)).toBeNull();
    expect(halfHr({ ...s, heartrate: hr.map((h, i) => (s.distance[i] > 2000 ? 0 : h)) })).toBeNull();
  });

  it('odchyłka km od średniej: km 2 szybszy, suma ważona zero', () => {
    // run(3000): 300, 200, 300 s/km, średnia 266,7.
    expect(splitDeltas(run(3000)).map(Math.round)).toEqual([33, -67, 33]);
    expect(splitDeltas({ ...run(3000), time: undefined })).toEqual([]);
  });

  it('zapas nad równym tempem: 0 na starcie i mecie, za po wolnym km 1', () => {
    const v = pacingSeries(run(3000), 4); // punkty co 1 km, równe tempo 800 s / 3 km
    expect(v.map(Math.round)).toEqual([0, Math.round(800 / 3 - 300), Math.round(1600 / 3 - 500), 0]);
    expect(pacingSeries({ ...run(3000), time: undefined })).toEqual([]);
  });

  it('tempo w przedziałach co 10 s/km, marsz pominięty', () => {
    const v = [0, 4, 4, 4, 1000 / 245, 0.5];
    const s: RunStreams = { latlng: [], distance: v.map((_, i) => i), time: v.map((_, i) => i), velocity: v };
    // 4 m/s = 250 s/km, 245 s/km w przedziale 240; 0,5 m/s (marsz) i 0 pominięte.
    expect(paceBins(s).map((b) => [b.lo, b.share])).toEqual([
      [240, 0.25],
      [250, 0.75],
    ]);
  });
});
