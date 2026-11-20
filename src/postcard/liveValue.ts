import type { Activity, RunStreams } from '../strava/api';
import { gainSeries, lerpAt, movingTime } from '../lib/chartData';
import {
  EMPTY,
  formatCadence,
  formatDistanceKm,
  formatDuration,
  formatElapsed,
  formatElevPerKm,
  formatElevation,
  formatHeartRate,
  formatPace,
  formatSpeedKmh,
  formatSteps,
  formatStopped,
} from '../lib/format';
import { DATA, type SlotData } from './slots';

// Średnie z pierwszych metrów skaczą; do 200 m pokazujemy wartość z pierwszych 200 m (stała, bez migotania).
const HOLD_M = 200;
const TEXT: SlotData[] = ['date', 'start', 'name', 'weekday', 'runtype'];

// Ułamek > 0, żeby formatery z warunkiem „> 0” dawały 0 zamiast myślnika w pierwszej klatce.
const tiny = (p: number) => Math.max(p, 1e-6);
// Stosunek „do teraz / całość”; zły (0, NaN, ∞) = 1, czyli wartość końcowa.
const safe = (x: number) => (Number.isFinite(x) && x > 0 ? x : 1);

// Średnia i maksimum próbek > 0 o dystansie ≤ x; bez takiej próbki (pas tętna łapie później) okno sięga do pierwszej.
function stat(d: number[], v: number[], x: number) {
  let sum = 0;
  let n = 0;
  let max = 0;
  for (let i = 0; i < d.length && (d[i] <= x || n === 0); i++) {
    if (v[i] > 0) {
      sum += v[i];
      n++;
      max = Math.max(max, v[i]);
    }
  }
  return { mean: sum / n, max };
}

// Wartości ze strumienia stałe dla biegu, liczone raz (liveValue woła się na slot × klatkę).
type Cache = { t?: number[]; gx?: number[]; g?: number[]; fin: Partial<Record<string, ReturnType<typeof stat>>> };
const cache = new WeakMap<RunStreams, Cache>();
function memo(s: RunStreams): Cache {
  let c = cache.get(s);
  if (!c) cache.set(s, (c = { fin: {} }));
  return c;
}

// Tekst pokazany na pocztówce przy postępie p (ułamek dystansu, jak trasa); p ≥ 1 = DATA[data].value(a).
export function liveValue(data: SlotData, a: Activity, streams: RunStreams | null | undefined, p: number): string {
  const final = DATA[data].value(a);
  if (p >= 1 || final === EMPTY) return final;
  p = Math.max(0, p);
  if (TEXT.includes(data)) return final; // data, nazwa itd. bez animacji (decyzja właściciela)

  const d = streams?.distance ?? [];
  const total = d[d.length - 1];
  const ok = d.length > 1 && total > 0;
  const cut = p * total;
  const held = Math.max(cut, Math.min(total, HOLD_M));
  const s = ok ? streams! : null;
  const c = s ? memo(s) : null;
  const moving = () => (c && s!.time ? (c.t ??= movingTime(s!.time)) : null);
  const movingAt = (x: number) => {
    const t = moving();
    return t ? lerpAt(d, t, x) / t[t.length - 1] : NaN;
  };
  const gainAt = (x: number) => {
    if (!c) return NaN;
    const g = (c.g ??= gainSeries(s!));
    if (g.length < 2) return NaN;
    const gx = (c.gx ??= g.map((_, i) => (i / (g.length - 1)) * total));
    return lerpAt(gx, g, x) / g[g.length - 1];
  };
  // Względna prędkość „do teraz” wobec całego biegu (1 = średnia całego biegu).
  const speedRatio = () => (moving() ? safe(held / total / movingAt(held)) : null);
  const ratio = (key: 'heartrate' | 'cadence' | 'velocity', which: 'mean' | 'max') => {
    const v = s?.[key];
    if (!c || !v) return null;
    const fin = (c.fin[key] ??= stat(d, v, total));
    return safe(stat(d, v, held)[which] / fin[which]);
  };

  // Wartość końcowa nie jest myślnikiem, więc pola z ! istnieją.
  switch (data) {
    case 'distance':
      return formatDistanceKm(a.distance * p);
    case 'time': {
      const f = movingAt(cut);
      return formatDuration(a.moving_time * (Number.isFinite(f) ? f : p));
    }
    case 'elapsed':
      return formatElapsed(a.elapsed_time! * tiny(p));
    case 'stopped':
      return formatStopped(a.moving_time * tiny(p), a.elapsed_time! * tiny(p));
    case 'steps':
      return formatSteps(a.average_cadence, a.moving_time * tiny(p));
    case 'elevation': {
      const f = gainAt(cut);
      return formatElevation(a.total_elevation_gain! * (Number.isFinite(f) ? f : p));
    }
    case 'elevkm': {
      const f = gainAt(held);
      return Number.isFinite(f)
        ? formatElevPerKm(a.total_elevation_gain! * f, (a.distance * held) / total)
        : formatElevPerKm(a.total_elevation_gain! * p, a.distance);
    }
    case 'pace': {
      const r = speedRatio();
      return r ? formatPace(a.distance * r, a.moving_time) : formatPace(a.distance, a.moving_time * tiny(p));
    }
    case 'speed':
      return formatSpeedKmh(a.average_speed! * (speedRatio() ?? tiny(p)));
    case 'heartrate':
      return formatHeartRate(a.average_heartrate! * (ratio('heartrate', 'mean') ?? tiny(p)));
    case 'maxhr':
      return formatHeartRate(a.max_heartrate! * (ratio('heartrate', 'max') ?? tiny(p)));
    case 'maxspeed':
      return formatSpeedKmh(a.max_speed! * (ratio('velocity', 'max') ?? tiny(p)));
    case 'cadence':
      return formatCadence(a.average_cadence! * (ratio('cadence', 'mean') ?? tiny(p)));
  }
  return final;
}
