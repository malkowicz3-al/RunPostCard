import type { RunStreams } from '../strava/api';
import { smoothByDistance } from '../lib/isoRoute';
import { formatDuration, formatPace } from '../lib/format';

// Momenty lotu POV (ADR 0011): kamera zwalnia, a nad trasą wisi napis. f = ułamek dystansu.
export type Moment = { f: number; kind: 'hr' | 'pace' | 'top' | 'split'; label: string };

const FROM = 0.05;
const TO = 0.97;
const PACE_TO = 0.95; // finisz bywa sprintem, nie „najszybszym fragmentem”
const NEAR = 0.08; // bliżej siebie = jeden napis (wygrywa tętno, potem tempo)
const MIN_CLIMB_M = 30;
const HALF_MARATHON_M = 20500; // jak próg półmaratonu na numerach startowych: GPS często mierzy trochę mniej
const MOVING_MS = 0.5; // wolniej = postój (światła), nie liczy się do tempa międzyczasu, jak czas ruchu Stravy
const SPLIT_GAP_M = 300; // międzyczas bliżej mety albo momentu kluczowego jest pomijany
const MAX_STOPS = 40;

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
  for (const m of splits(s, total)) if (kept.every((k) => k.kind === 'split' || Math.abs(k.f - m.f) * total >= SPLIT_GAP_M)) kept.push(m);
  return kept.sort((a, b) => a.f - b.f).slice(0, MAX_STOPS);
}

// Międzyczasy co 1 km, od półmaratonu co 5 km; czas odcinka z interpolacji streams.time, bez niego sam numer.
function splits(s: RunStreams, total: number): Moment[] {
  const d = s.distance;
  const step = total < HALF_MARATHON_M ? 1000 : 5000;
  // Czas ruchu narastająco: odcinki wolniejsze niż MOVING_MS pomijane.
  const raw = s.time?.length === d.length ? s.time : null;
  const time = raw && raw.map(() => 0);
  if (raw && time)
    for (let i = 1; i < d.length; i++) {
      const dt = raw[i] - raw[i - 1];
      time[i] = time[i - 1] + (dt > 0 && (d[i] - d[i - 1]) / dt >= MOVING_MS ? dt : 0);
    }
  let j = 0;
  const timeAt = (x: number) => {
    while (j < d.length - 2 && d[j + 1] - d[0] < x) j++;
    const [a, b] = [d[j] - d[0], d[j + 1] - d[0]];
    const f = b > a ? Math.min(1, Math.max(0, (x - a) / (b - a))) : 0;
    return time![j] + (time![j + 1] - time![j]) * f;
  };
  const out: Moment[] = [];
  let prev = time ? time[0] : 0;
  for (let k = 1; k * step <= total - SPLIT_GAP_M; k++) {
    const at = time ? timeAt(k * step) : 0;
    const dt = at - prev;
    prev = at;
    const km = (k * step) / 1000;
    const label = !time || !(dt > 0) ? (step === 1000 ? `KM ${km}` : `${km} KM`)
      : step === 1000 ? `KM ${km} · ${formatPace(1000, dt)} /km`
        : `${km} KM · ${formatDuration(dt)} · ${formatPace(step, dt)} /km`;
    out.push({ f: (k * step) / total, kind: 'split', label });
  }
  return out;
}
