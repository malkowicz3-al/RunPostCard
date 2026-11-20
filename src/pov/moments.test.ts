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
    const key = m.filter((x) => x.kind !== 'split');
    expect(key.map((x) => x.kind)).toEqual(['hr', 'top', 'pace']);
    expect(key[0].label).toBe('MAX HR 182 bpm');
    expect(key[2].label).toBe('FASTEST 4:12 /km');
    expect(key[1].label).toBe('TOP 500 m');
    expect(key[0].f).toBeCloseTo(0.3, 1);
  });

  it('bez strumieni pusto; płasko bez szczytu; blisko siebie wygrywa tętno; brzegi pominięte', () => {
    const key = (s: RunStreams) => momentsOf(s).filter((x) => x.kind !== 'split');
    expect(key(base)).toEqual([]);
    expect(key({ ...base, altitude: at((f) => 200 + 10 * f) })).toEqual([]);
    const m = key({ ...base, heartrate: at(peak(0.5, 150, 180)), velocity: at(peak(0.52, 3, 4)) });
    expect(m.map((x) => x.kind)).toEqual(['hr']);
    const edge = key({ ...base, heartrate: at((f) => 150 + 40 * f) });
    expect(edge[0].f).toBeLessThanOrEqual(0.97);
  });

  it('międzyczasy: co 1 km z tempem, bez czasu sam numer, bez ostatnich 300 m, moment kluczowy wygrywa', () => {
    // 10 km w 50 min (5:00 /km), 3. km w 5:12; meta 10 km, więc ostatni międzyczas to KM 9.
    const time = at((f) => f * 3000 + (f > 0.2 ? Math.min(f - 0.2, 0.1) * 120 : 0));
    const m = momentsOf({ ...base, time });
    expect(m.map((x) => x.label)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `KM ${k} · ${k === 3 ? '5:12' : '5:00'} /km`));
    expect(m[2].f).toBeCloseTo(0.3, 6);
    expect(momentsOf(base).map((x) => x.label)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `KM ${k}`));
    const withHr = momentsOf({ ...base, time, heartrate: at(peak(0.42, 150, 182)) });
    expect(withHr.map((x) => x.label).filter((l) => l.startsWith('KM 4'))).toEqual([]);
    expect(withHr.some((x) => x.kind === 'hr')).toBe(true);
  });

  it('od półmaratonu międzyczasy co 5 km z czasem i tempem odcinka', () => {
    const k = 2201; // 22 km co 10 m, 5:20 /km
    const m = momentsOf({
      latlng: Array.from({ length: k }, () => [0, 0]),
      distance: Array.from({ length: k }, (_, i) => i * 10),
      time: Array.from({ length: k }, (_, i) => i * 3.2),
    });
    expect(m.map((x) => x.label)).toEqual(['5 KM · 26:40 · 5:20 /km', '10 KM · 26:40 · 5:20 /km', '15 KM · 26:40 · 5:20 /km', '20 KM · 26:40 · 5:20 /km']);
  });

  it('postój (światła) nie wlicza się do tempa; półmaraton z GPS (20,6 km) też co 5 km', () => {
    // 10 km po 5:00 /km, a w środku 3. km 2 min stania w miejscu (te same 10 m przez 120 s).
    const dist = [...Array.from({ length: 251 }, (_, i) => i * 10), ...Array.from({ length: 750 }, (_, i) => 2510 + i * 10)];
    const time = dist.map((d, i) => d * 0.3 + (i > 250 ? 120 : 0));
    dist[251] = 2500; // drugi punkt w tym samym miejscu: 120 s bez ruchu
    time[251] = 2500 * 0.3 + 120;
    const m = momentsOf({ latlng: dist.map(() => [0, 0]), distance: dist, time });
    expect(m.find((x) => x.label.startsWith('KM 3'))?.label).toBe('KM 3 · 5:00 /km');
    const g = 2061; // 20,6 km
    const half = momentsOf({ latlng: Array.from({ length: g }, () => [0, 0]), distance: Array.from({ length: g }, (_, i) => i * 10) });
    expect(half.map((x) => x.label)).toEqual(['5 KM', '10 KM', '15 KM', '20 KM']);
  });
});
