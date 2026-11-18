import type { RunStreams } from '../strava/api';

export const TRIM_M = 200; // prywatność: żaden marker w pierwszych i ostatnich 200 m
const WINDOW = 10; // próbki średniej prędkości (bez skoków GPS)
const MIN_HR_AFTER_S = 300; // najniższe tętno dopiero po 5 min, inaczej zawsze wypada na starcie
const MIN_HR_AFTER_M = 1000; // to samo bez strumienia czasu

export type HighlightKind = 'fastest' | 'maxHr' | 'minHr' | 'highest';
export type Highlight = { kind: HighlightKind; index: number; value: number };

// Indeks pierwszej największej (sign=1) albo najmniejszej (sign=-1) wartości wśród kandydatów.
function extreme(candidates: number[], value: (i: number) => number, sign: 1 | -1): number | undefined {
  let best: number | undefined;
  for (const i of candidates) if (best === undefined || sign * (value(i) - value(best)) > 0) best = i;
  return best;
}

// Indeksy zwracane w strumieniach: ten sam wynik ustawia marker w widoku płaskim i w 3D.
export function highlights(s: RunStreams): Highlight[] {
  const n = s.distance.length;
  const last = s.distance[n - 1];
  if (!(last >= 2 * TRIM_M)) return [];
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) if (s.distance[i] >= TRIM_M && s.distance[i] <= last - TRIM_M) candidates.push(i);
  const out: Highlight[] = [];

  const v = s.velocity;
  if (v) {
    // Okno [i-5, i+4] w całości w danych.
    const half = WINDOW / 2;
    const mean = (i: number) => {
      let sum = 0;
      for (let j = i - half; j < i + half; j++) sum += v[j];
      return sum / WINDOW;
    };
    const fast = extreme(candidates.filter((i) => i - half >= 0 && i + half - 1 < n), mean, 1);
    if (fast !== undefined) out.push({ kind: 'fastest', index: fast, value: mean(fast) });
  }

  const hr = s.heartrate;
  if (hr) {
    const max = extreme(candidates, (i) => hr[i], 1);
    if (max !== undefined) {
      out.push({ kind: 'maxHr', index: max, value: hr[max] });
      const late = candidates.filter((i) => (s.time ? s.time[i] >= MIN_HR_AFTER_S : s.distance[i] >= MIN_HR_AFTER_M));
      const min = extreme(late, (i) => hr[i], -1);
      if (min !== undefined && min !== max && hr[min] !== hr[max]) out.push({ kind: 'minHr', index: min, value: hr[min] });
    }
  }

  const alt = s.altitude;
  if (alt) {
    const top = extreme(candidates, (i) => alt[i], 1);
    if (top !== undefined) out.push({ kind: 'highest', index: top, value: alt[top] });
  }
  return out;
}
