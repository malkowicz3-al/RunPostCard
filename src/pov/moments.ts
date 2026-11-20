import type { RunStreams } from '../strava/api';
import { smoothByDistance } from '../lib/isoRoute';
import { formatPace } from '../lib/format';

// Momenty lotu POV (ADR 0011): kamera zwalnia, a nad trasą wisi napis. f = ułamek dystansu.
export type Moment = { f: number; kind: 'hr' | 'pace' | 'top'; label: string };

const FROM = 0.05;
const TO = 0.97;
const PACE_TO = 0.95; // finisz bywa sprintem, nie „najszybszym fragmentem”
const NEAR = 0.08; // bliżej siebie = jeden napis (wygrywa tętno, potem tempo)
const MIN_CLIMB_M = 30;

export function momentsOf(s: RunStreams): Moment[] {
  const d = s.distance;
  const n = d.length;
  const total = n > 1 ? d[n - 1] - d[0] : 0;
  if (!(total > 0)) return [];
  const frac = (i: number) => (d[i] - d[0]) / total;
  const argmax = (v: number[], to = TO) => {
    let best = -1;
    for (let i = 0; i < n; i++) if (frac(i) >= FROM && frac(i) <= to && Number.isFinite(v[i]) && (best < 0 || v[i] > v[best])) best = i;
    return best;
  };
  const found: Moment[] = [];
  if (s.heartrate?.length === n) {
    const i = argmax(smoothByDistance(s.heartrate, d, 100));
    // Na napisie surowe maksimum w oknie ±100 m, jak „max HR” Stravy, nie wygładzone.
    let peak = 0;
    for (let j = 0; j < n; j++) if (i >= 0 && Math.abs(d[j] - d[i]) <= 100) peak = Math.max(peak, s.heartrate[j]);
    if (i >= 0 && peak > 0) found.push({ f: frac(i), kind: 'hr', label: `MAX HR ${Math.round(peak)} bpm` });
  }
  if (s.velocity?.length === n) {
    const v = smoothByDistance(s.velocity, d, 200);
    const i = argmax(v, PACE_TO);
    if (i >= 0 && v[i] > 0) found.push({ f: frac(i), kind: 'pace', label: `FASTEST ${formatPace(1000, 1000 / v[i])} /km` });
  }
  if (s.altitude?.length === n) {
    const a = smoothByDistance(s.altitude, d, 100);
    const i = argmax(a);
    if (i >= 0 && Math.max(...a) - Math.min(...a) >= MIN_CLIMB_M) found.push({ f: frac(i), kind: 'top', label: `TOP ${Math.round(a[i])} m` });
  }
  const kept: Moment[] = [];
  for (const m of found) if (kept.every((k) => Math.abs(k.f - m.f) >= NEAR)) kept.push(m);
  return kept.sort((a, b) => a.f - b.f).slice(0, 3);
}
