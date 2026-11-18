import type { RunStreams } from '../strava/api';

// Progi stref jako ułamek tętna maksymalnego: 5 stref (<60, 60–70, 70–80, 80–90, ≥90%).
// Przybliżenie: prawdziwe strefy sportowca wymagają scope profile:read_all (ADR 0007).
export const HR_ZONES = [0.6, 0.7, 0.8, 0.9];

export const zoneOf = (hr: number, maxHr: number) => HR_ZONES.filter((z) => hr >= z * maxHr).length;

// Pauza w zapisie liczy się najwyżej jako 10 s (strumienie mają próbki co ~1 s).
const MAX_GAP_S = 10;
const gap = (t: number[], i: number) => Math.min(MAX_GAP_S, Math.max(0, t[i] - t[i - 1]));

// Interpolacja liniowa ys w punkcie x (xs niemalejące), wyszukiwanie binarne.
function lerpAt(xs: number[], ys: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (xs[m] <= x) lo = m;
    else hi = m;
  }
  const span = xs[hi] - xs[lo];
  const f = span > 0 ? Math.min(1, Math.max(0, (x - xs[lo]) / span)) : 0;
  return ys[lo] + (ys[hi] - ys[lo]) * f;
}

// n wartości strumienia w równych odstępach dystansu; [] gdy strumienia brak.
export function series(s: RunStreams, key: 'altitude' | 'heartrate' | 'velocity', n = 200): number[] {
  let v = s[key];
  let d = s.distance;
  const total = d[d.length - 1];
  // Tętno 0 to brak odczytu (np. zgubiony pas), nie wartość.
  if (key === 'heartrate' && v) {
    const hr = v;
    d = d.filter((_, i) => hr[i] > 0);
    v = hr.filter((x) => x > 0);
  }
  if (!v || v.length < 2 || !(total > 0)) return [];
  return Array.from({ length: n }, (_, k) => lerpAt(d, v, (total * k) / (n - 1)));
}

// Tempo (s/km) każdego pełnego km; ostatni niepełny tylko od 300 m. km = długość odcinka w km.
export function kmSplits(s: RunStreams): { km: number; pace: number }[] {
  const { distance: d, time: t } = s;
  if (!t || d.length < 2) return [];
  const total = d[d.length - 1];
  // Czas w ruchu narastająco, bez pauz.
  const moving = [0];
  for (let i = 1; i < t.length; i++) moving.push(moving[i - 1] + gap(t, i));
  const out: { km: number; pace: number }[] = [];
  let prev = 0;
  for (let k = 1; k * 1000 <= total; k++) {
    const tk = lerpAt(d, moving, k * 1000);
    out.push({ km: 1, pace: tk - prev });
    prev = tk;
  }
  const rest = total - out.length * 1000;
  if (rest >= 300) out.push({ km: rest / 1000, pace: (moving[moving.length - 1] - prev) / (rest / 1000) });
  // Odcinek bez upływu czasu (np. skok GPS) dałby nieskończoną prędkość słupka.
  return out.filter((x) => Number.isFinite(x.pace) && x.pace > 0);
}

// Udział czasu w 5 strefach (suma 1); bez strumienia czasu każda próbka waży tyle samo.
export function zoneShare(s: RunStreams, maxHr: number): number[] {
  const share = [0, 0, 0, 0, 0];
  const hr = s.heartrate;
  if (!hr || !(maxHr > 0)) return share;
  let sum = 0;
  for (let i = 1; i < hr.length; i++) {
    if (!(hr[i] > 0)) continue;
    const w = s.time ? gap(s.time, i) : 1;
    share[zoneOf(hr[i], maxHr)] += w;
    sum += w;
  }
  return sum > 0 ? share.map((x) => x / sum) : share;
}
