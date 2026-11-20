import type { RunStreams } from '../strava/api';
import { gradeSeries, series, zoneOf } from '../lib/chartData';
import { formatCadence } from '../lib/format';
import { smoothByDistance } from '../lib/isoRoute';
import { ZONE_COLORS } from './SlotChart';

export type RouteColor =
  | 'theme'
  | 'rainbow'
  | 'pace'
  | 'heartrate'
  | 'elevation'
  | 'cadence'
  | 'grade'
  | 'effort'
  | 'fire'
  | 'ice'
  | 'sunset'
  | 'ocean'
  | 'lime'
  | 'gold'
  | 'candy';

export const ROUTE_COLORS: { id: RouteColor; label: string }[] = [
  { id: 'theme', label: 'Theme' },
  { id: 'rainbow', label: 'Rainbow' },
  { id: 'fire', label: 'Fire' },
  { id: 'ice', label: 'Ice' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'lime', label: 'Lime' },
  { id: 'gold', label: 'Gold' },
  { id: 'candy', label: 'Candy' },
  { id: 'pace', label: 'Pace' },
  { id: 'heartrate', label: 'Heart rate' },
  { id: 'effort', label: 'Effort' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'grade', label: 'Grade' },
  { id: 'cadence', label: 'Cadence' },
];

const SAMPLES = 300; // próbki strumienia w równych odstępach dystansu
const PACE_HALF_M = 50; // okno ±50 m, czyli ok. 100 m
export const PACE_RAMP = ['#2f80ff', '#20c4d0', '#ffd23f', '#ff8a30', '#ff3b3b']; // najszybciej → najwolniej
export const ELEVATION_RAMP = ['#3ccf6e', '#ffd23f', '#ff4d4d']; // nisko → wysoko
export const CADENCE_RAMP = ['#7b61ff', '#20c4d0', '#b8f03c']; // nisko → wysoko
export const GRADE_RAMP = ['#2f80ff', '#a0a7b4', '#ff3b3b']; // zjazd → płasko → podjazd
export const EFFORT_RAMP = ['#3b9cff', '#3ccf6e', '#ffd23f', '#ff4d4d']; // tętno ciągle, od min do max
export const FIRE_RAMP = ['#ffe36e', '#ff9a1f', '#ff4d1f', '#d4143a']; // start → meta
export const ICE_RAMP = ['#effcff', '#8fe3ff', '#3b9cff', '#6a4dff']; // start → meta
export const SUNSET_RAMP = ['#ffd166', '#ff7b54', '#e83f6f', '#7a2e8e']; // start → meta
export const OCEAN_RAMP = ['#c6f8ff', '#2ec4d6', '#1a7fd1', '#173b9c']; // start → meta
export const LIME_RAMP = ['#f4ff7a', '#b8f03c', '#3ccf6e', '#0e9f8c']; // start → meta
export const GOLD_RAMP = ['#fff3b0', '#ffd23f', '#e0a10b', '#a86a00']; // start → meta
export const CANDY_RAMP = ['#ff9ad5', '#c77dff', '#7bdff2', '#b2f7ef']; // start → meta

// Kolor wg ułamka długości (jak rainbow), zawsze dostępne.
const BY_LENGTH: Partial<Record<RouteColor, string[]>> = {
  fire: FIRE_RAMP,
  ice: ICE_RAMP,
  sunset: SUNSET_RAMP,
  ocean: OCEAN_RAMP,
  lime: LIME_RAMP,
  gold: GOLD_RAMP,
  candy: CANDY_RAMP,
};
const RAMPS: Partial<Record<RouteColor, string[]>> = {
  pace: PACE_RAMP,
  elevation: ELEVATION_RAMP,
  cadence: CADENCE_RAMP,
  grade: GRADE_RAMP,
  effort: EFFORT_RAMP,
};

const needsStreams = (mode: RouteColor) => mode !== 'theme' && mode !== 'rainbow' && !BY_LENGTH[mode];

const key = { pace: 'velocity', heartrate: 'heartrate', effort: 'heartrate', elevation: 'altitude', cadence: 'cadence' } as const;

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

// Tempo: średnia krocząca ok. 100 m po dystansie, przed próbkowaniem, żeby szum zegarka nie migotał kolorami.
const smoothed = (mode: RouteColor, streams: RunStreams): RunStreams =>
  mode === 'pace' && streams.velocity ? { ...streams, velocity: smoothByDistance(streams.velocity, streams.distance, PACE_HALF_M) } : streams;

// Próbki danych stylu wzdłuż dystansu (wspólne dla dostępności, legendy i skali); [] bez strumieni albo danych.
function values(mode: RouteColor, streams?: RunStreams | null): number[] {
  if (!streams || !needsStreams(mode)) return [];
  if (mode === 'grade') return gradeSeries(streams, SAMPLES);
  return series(smoothed(mode, streams), key[mode as keyof typeof key], SAMPLES);
}

export function available(mode: RouteColor, streams?: RunStreams | null): boolean {
  return !needsStreams(mode) || values(mode, streams).length > 0;
}

// Zakres skali: tempo bez skrajnych 5% (pauzy, sprint na zegarku); nachylenie symetrycznie ±95. percentyl,
// żeby płasko zawsze było szare; reszta pełna.
function bounds(mode: RouteColor, v: number[]): [number, number] {
  if (mode === 'grade') {
    const m = percentile(v.map(Math.abs).sort((a, b) => a - b), 0.95);
    return [-m, m];
  }
  const sorted = [...v].sort((a, b) => a - b);
  return mode === 'pace' ? [percentile(sorted, 0.05), percentile(sorted, 0.95)] : [sorted[0], sorted[sorted.length - 1]];
}

const paceText = (mps: number) => {
  if (!(mps > 0)) return '–';
  const s = Math.round(1000 / mps);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const gradeText = (g: number) => `${g < 0 ? '−' : '+'}${Math.abs(g) < 10 ? Math.abs(g).toFixed(1) : Math.round(Math.abs(g))}%`;

export type RouteLegend = { title: string; stops: string[]; from: string; to: string; steps: boolean };

// Legenda stylu linii na pocztówce (lewa strona paska = from); null dla 'theme' i przy braku danych.
export function routeLegend(mode: RouteColor, streams?: RunStreams | null): RouteLegend | null {
  if (mode === 'theme') return null;
  if (mode === 'rainbow') return { title: 'ROUTE', stops: Array.from({ length: 7 }, (_, i) => hsl(i * 50, 0.9, 0.6)), from: 'START', to: 'FINISH', steps: false };
  const byLength = BY_LENGTH[mode];
  if (byLength) return { title: 'ROUTE', stops: byLength, from: 'START', to: 'FINISH', steps: false };
  const v = values(mode, streams);
  if (!v.length) return null;
  if (mode === 'heartrate') return { title: 'HR ZONES', stops: ZONE_COLORS, from: 'Z1', to: 'Z5', steps: true };
  const [lo, hi] = bounds(mode, v);
  if (!(hi - lo > 1e-6)) return null; // stała wartość: trasa w jednym kolorze, legenda nic nie mówi
  const stops = RAMPS[mode]!;
  const legend = (title: string, from: string, to: string) => ({ title, stops, from, to, steps: false });
  if (mode === 'pace') return legend('PACE /KM', paceText(hi), paceText(lo));
  if (mode === 'cadence') return legend('CADENCE (SPM)', formatCadence(lo), formatCadence(hi));
  if (mode === 'effort') return legend('HEART RATE', `${Math.round(lo)} BPM`, `${Math.round(hi)} BPM`);
  if (mode === 'grade') return legend('GRADE', gradeText(lo), gradeText(hi));
  return legend('ELEVATION', `${Math.round(lo)} M`, `${Math.round(hi)} M`);
}

// Funkcja t (ułamek długości trasy) → kolor, policzona raz dla strumieni; null dla 'theme' i przy braku danych (wtedy kolor motywu).
export function colorScale(mode: RouteColor, streams?: RunStreams | null, maxHr?: number): ((t: number) => string) | null {
  if (mode === 'theme') return null;
  if (mode === 'rainbow') return (t) => hsl(clamp01(t) * 300, 0.9, 0.6);
  const byLength = BY_LENGTH[mode];
  if (byLength) return (t) => ramp(byLength, t);
  const v = values(mode, streams);
  if (!v.length) return null;
  const at = (t: number) => v[Math.round(clamp01(t) * (v.length - 1))];
  if (mode === 'heartrate') {
    const max = maxHr || Math.max(...v);
    return (t) => ZONE_COLORS[zoneOf(at(t), max)];
  }
  const stops = RAMPS[mode]!;
  const [lo, hi] = bounds(mode, v);
  if (!(hi - lo > 1e-6)) return () => ramp(stops, 0.5);
  // Tempo: większa prędkość = chłodniejszy kolor.
  return mode === 'pace' ? (t) => ramp(stops, (hi - at(t)) / (hi - lo)) : (t) => ramp(stops, (at(t) - lo) / (hi - lo));
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

const lerp2 = (a: [number, number], b: [number, number], f: number): [number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

// Przycięcie do ułamka p (animacja rysowania): ile punktów zostaje i jak przyciąć kolejne tablice tej samej długości.
// along: narastająca długość jak w segments (np. dystans w 3D); bez niej długość na ekranie. Zwraca przycinarkę punktów i liczb.
export function trimAt(points: [number, number][], p: number, along?: number[]) {
  const cum = along && along.length === points.length && along[along.length - 1] > along[0] ? along : [0];
  if (cum.length === 1) for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const n = cum.length - 1;
  if (n < 1) return { pts: (a: [number, number][]) => a, nums: (a: number[]) => a, each: <T>(a: T[]) => a };
  const s = cum[0] + (cum[n] - cum[0]) * clamp01(p);
  let i = 0;
  while (i < n - 1 && cum[i + 1] < s) i++;
  const f = Math.min(1, Math.max(0, (s - cum[i]) / (cum[i + 1] - cum[i] || 1)));
  return {
    pts: (a: [number, number][]) => [...a.slice(0, i + 1), lerp2(a[i], a[i + 1], f)],
    nums: (a: number[]) => [...a.slice(0, i + 1), a[i] + (a[i + 1] - a[i]) * f],
    // wartości odcinków (np. nachylenie odcinka i → i+1): ostatni przycięty zostaje
    each: <T>(a: T[]) => a.slice(0, i + 2),
  };
}
