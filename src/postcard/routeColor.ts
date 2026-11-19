import type { RunStreams } from '../strava/api';
import { series, zoneOf } from '../lib/chartData';
import { smoothByDistance } from '../lib/isoRoute';
import { ZONE_COLORS } from './SlotChart';

export type RouteColor = 'theme' | 'rainbow' | 'pace' | 'heartrate' | 'elevation';

export const ROUTE_COLORS: { id: RouteColor; label: string }[] = [
  { id: 'theme', label: 'Theme' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'pace', label: 'Pace' },
  { id: 'heartrate', label: 'Heart rate' },
  { id: 'elevation', label: 'Elevation' },
];

const SAMPLES = 300; // próbki strumienia w równych odstępach dystansu
const PACE_HALF_M = 50; // okno ±50 m, czyli ok. 100 m
export const PACE_RAMP = ['#2f80ff', '#20c4d0', '#ffd23f', '#ff8a30', '#ff3b3b']; // najszybciej → najwolniej
export const ELEVATION_RAMP = ['#3ccf6e', '#ffd23f', '#ff4d4d']; // nisko → wysoko

const needsStreams = (mode: RouteColor) => mode !== 'theme' && mode !== 'rainbow';

const key = { pace: 'velocity', heartrate: 'heartrate', elevation: 'altitude' } as const;

export function available(mode: RouteColor, streams?: RunStreams | null): boolean {
  if (!needsStreams(mode)) return true;
  return !!streams && series(streams, key[mode as keyof typeof key], 2).length > 0;
}

const clamp01 = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Kolor w punkcie f (0..1) rampy, liniowo w RGB między sąsiednimi przystankami.
export function ramp(stops: string[], f: number): string {
  const x = clamp01(f) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const a = rgb(stops[i]);
  const b = rgb(stops[i + 1]);
  return '#' + a.map((v, k) => hex2(v + (b[k] - v) * (x - i))).join('');
}

function hsl(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return '#' + [f(0), f(8), f(4)].map((v) => hex2(v * 255)).join('');
}

const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

// Funkcja t (ułamek długości trasy) → kolor, policzona raz dla strumieni; null dla 'theme' i przy braku danych (wtedy kolor motywu).
export function colorScale(mode: RouteColor, streams?: RunStreams | null, maxHr?: number): ((t: number) => string) | null {
  if (mode === 'theme') return null;
  if (mode === 'rainbow') return (t) => hsl(clamp01(t) * 300, 0.9, 0.6);
  if (!streams) return null;
  // Tempo: średnia krocząca ok. 100 m po dystansie, przed próbkowaniem, żeby szum zegarka nie migotał kolorami.
  const source =
    mode === 'pace' && streams.velocity ? { ...streams, velocity: smoothByDistance(streams.velocity, streams.distance, PACE_HALF_M) } : streams;
  const v = series(source, key[mode], SAMPLES);
  if (!v.length) return null;
  const at = (t: number) => v[Math.round(clamp01(t) * (v.length - 1))];
  if (mode === 'heartrate') {
    const max = maxHr || Math.max(...v);
    return (t) => ZONE_COLORS[zoneOf(at(t), max)];
  }
  const sorted = [...v].sort((a, b) => a - b);
  const [lo, hi] = mode === 'pace' ? [percentile(sorted, 0.05), percentile(sorted, 0.95)] : [sorted[0], sorted[sorted.length - 1]];
  if (!(hi - lo > 1e-6)) return () => (mode === 'pace' ? ramp(PACE_RAMP, 0.5) : ramp(ELEVATION_RAMP, 0.5));
  // Tempo: większa prędkość = chłodniejszy kolor.
  return mode === 'pace' ? (t) => ramp(PACE_RAMP, (hi - at(t)) / (hi - lo)) : (t) => ramp(ELEVATION_RAMP, (at(t) - lo) / (hi - lo));
}

const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// Linia pocięta na n odcinków równej długości na ekranie: d, t = środek odcinka jako ułamek długości, start = długość do początku (offset kreskowania).
// along: narastająca długość w punktach (np. streams.distance w 3D, gdzie rzut i podniesienie przekłamują długość na ekranie) — wtedy t z niej.
export function segments(points: [number, number][], n = 150, along?: number[]): { d: string; t: number; start: number }[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const byAlong = along && along.length === points.length && along[along.length - 1] > along[0];
  let j = 0;
  const lerp = (s: number): [number, number] => {
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    return [points[j][0] + (points[j + 1][0] - points[j][0]) * f, points[j][1] + (points[j + 1][1] - points[j][1]) * f];
  };
  let m = 0; // osobny wskaźnik dla środków odcinków (też rosną)
  const tAt = (s: number) => {
    if (!byAlong) return s / total;
    while (m < cum.length - 2 && cum[m + 1] < s) m++;
    const f = (s - cum[m]) / (cum[m + 1] - cum[m] || 1);
    const [a0, a1] = [along![0], along![along!.length - 1]];
    return (along![m] + (along![m + 1] - along![m]) * f - a0) / (a1 - a0);
  };
  return Array.from({ length: n }, (_, k) => {
    const a = (total * k) / n;
    const b = (total * (k + 1)) / n;
    const pts = [lerp(a)];
    while (j + 1 < cum.length - 1 && cum[j + 1] < b) pts.push(points[++j]);
    pts.push(lerp(b));
    return { d: `M${pts.map(pt).join('L')}`, t: tAt((a + b) / 2), start: a };
  });
}
