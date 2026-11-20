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
export function series(s: RunStreams, key: 'altitude' | 'heartrate' | 'velocity' | 'cadence', n = 200): number[] {
  let v = s[key];
  let d = s.distance;
  const total = d[d.length - 1];
  // Tętno 0 to brak odczytu (np. zgubiony pas), kadencja 0 to postój; żadne nie jest wartością do linii.
  if ((key === 'heartrate' || key === 'cadence') && v) {
    const raw = v;
    d = d.filter((_, i) => raw[i] > 0);
    v = raw.filter((x) => x > 0);
  }
  if (!v || v.length < 2 || !(total > 0)) return [];
  return Array.from({ length: n }, (_, k) => lerpAt(d, v, (total * k) / (n - 1)));
}

// Granice odcinków km: pełne km i ostatni niepełny tylko od 300 m (wspólne dla tempa i nachylenia).
function kmEnds(total: number): number[] {
  const ends: number[] = [];
  for (let k = 1; k * 1000 <= total; k++) ends.push(k * 1000);
  if (total - ends.length * 1000 >= 300) ends.push(total);
  return ends;
}

// Czas w ruchu narastająco, bez pauz.
function movingTime(t: number[]): number[] {
  const moving = [0];
  for (let i = 1; i < t.length; i++) moving.push(moving[i - 1] + gap(t, i));
  return moving;
}

// Tempo (s/km) kolejnych odcinków kmEnds, bez filtrowania (indeks = numer km - 1).
function rawSplits(s: RunStreams): { km: number; pace: number }[] {
  const { distance: d, time: t } = s;
  if (!t || d.length < 2) return [];
  const moving = movingTime(t);
  let prev = 0;
  let prevT = 0;
  return kmEnds(d[d.length - 1]).map((end) => {
    const tk = lerpAt(d, moving, end);
    const km = (end - prev) / 1000;
    const out = { km, pace: (tk - prevT) / km };
    prev = end;
    prevT = tk;
    return out;
  });
}

// Odcinek bez upływu czasu (np. skok GPS) dałby nieskończoną prędkość słupka.
const validPace = (x: { pace: number }) => Number.isFinite(x.pace) && x.pace > 0;

// Tempo (s/km) każdego pełnego km; ostatni niepełny tylko od 300 m. km = długość odcinka w km.
export const kmSplits = (s: RunStreams) => rawSplits(s).filter(validPace);

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

// Nachylenie (%) każdego odcinka km jak w kmSplits: różnica wysokości końców przez długość odcinka.
export function kmGrades(s: RunStreams): number[] {
  const { distance: d, altitude: a } = s;
  if (!a || d.length < 2) return [];
  let prev = 0;
  return kmEnds(d[d.length - 1]).map((end) => {
    const g = ((lerpAt(d, a, end) - lerpAt(d, a, prev)) / (end - prev)) * 100;
    prev = end;
    return g;
  });
}

// Przewyższenie narastająco (suma podjazdów) w n punktach dystansu. Liczone z próbek series, co wygładza szum
// GPS; kształt do wykresu, nie dokładna suma (tę podaje Strava w total_elevation_gain).
export function gainSeries(s: RunStreams, n = 200): number[] {
  const alt = series(s, 'altitude', n);
  let sum = 0;
  return alt.map((a, i) => (sum += i > 0 ? Math.max(0, a - alt[i - 1]) : 0));
}

// Udział czasu w przedziałach tętna (albo kadencji) co `width` bpm (lo = dolna granica); skrajne przedziały poniżej 0,5%
// obcinamy, żeby pojedyncze odczyty na starcie nie rozciągały osi.
export const hrBins = (s: RunStreams, width = 5) => shareBins(s, 'heartrate', width);
// Kadencja jednej nogi (jak w Stravie), więc 2 spm tu to 4 kroki obu nóg.
export const cadenceBins = (s: RunStreams, width = 2) => shareBins(s, 'cadence', width);
// Tempo (s/km) co width s; wolniej niż ok. 20:50/km (marsz, postój) pomijamy, żeby nie rozciągało osi.
export const paceBins = (s: RunStreams, width = 10) => shareBins(s, 'velocity', width, (v) => (v >= 0.8 ? 1000 / v : NaN));

function shareBins(
  s: RunStreams,
  key: 'heartrate' | 'cadence' | 'velocity',
  width: number,
  map = (x: number) => x,
): { lo: number; share: number }[] {
  const raw = s[key];
  if (!raw) return [];
  const sums = new Map<number, number>();
  let total = 0;
  for (let i = 1; i < raw.length; i++) {
    const x = raw[i] > 0 ? map(raw[i]) : NaN;
    if (!(x > 0 && Number.isFinite(x))) continue;
    const w = s.time ? gap(s.time, i) : 1;
    const lo = Math.floor(x / width) * width;
    sums.set(lo, (sums.get(lo) ?? 0) + w);
    total += w;
  }
  if (!(total > 0)) return [];
  const keys = [...sums.keys()];
  const out: { lo: number; share: number }[] = [];
  for (let lo = Math.min(...keys); lo <= Math.max(...keys); lo += width) out.push({ lo, share: (sums.get(lo) ?? 0) / total });
  let a = 0;
  let b = out.length;
  while (a < b - 1 && out[a].share < 0.005) a++;
  while (b - 1 > a && out[b - 1].share < 0.005) b--;
  return out.slice(a, b);
}

// Najszybsze pełne km (numer od 1 i tempo s/km), od najszybszego.
export function bestSplits(s: RunStreams, count = 3): { km: number; pace: number }[] {
  return rawSplits(s)
    .map((x, i) => ({ km: i + 1, pace: x.pace, full: x.km === 1 }))
    .filter((x) => x.full && validPace(x))
    .sort((a, b) => a.pace - b.pace)
    .slice(0, count)
    .map(({ km, pace }) => ({ km, pace }));
}

// Pary prędkość (m/s) i tętno w n punktach dystansu; bez postojów (< 0,5 m/s). [] bez któregoś strumienia.
export function speedHr(s: RunStreams, n = 120): { speed: number; hr: number }[] {
  const v = series(s, 'velocity', n);
  const hr = series(s, 'heartrate', n);
  if (!v.length || !hr.length) return [];
  return v.map((speed, i) => ({ speed, hr: hr[i] })).filter((p) => p.speed >= 0.5);
}

// Tempo (s/km) pierwszej i drugiej połowy dystansu z czasu w ruchu; null bez czasu albo przy zerowym czasie połowy.
export function halfSplits(s: RunStreams): [number, number] | null {
  const { distance: d, time: t } = s;
  const total = d[d.length - 1];
  if (!t || d.length < 2 || !(total > 0)) return null;
  const moving = movingTime(t);
  const half = lerpAt(d, moving, total / 2);
  const km = total / 2000;
  const out: [number, number] = [half / km, (moving[moving.length - 1] - half) / km];
  return out.every((p) => Number.isFinite(p) && p > 0) ? out : null;
}

// Średnie tętno pierwszej i drugiej połowy dystansu (ważone czasem jak zoneShare); null bez tętna w którejś połowie.
export function halfHr(s: RunStreams): [number, number] | null {
  const { distance: d, heartrate: hr } = s;
  const total = d[d.length - 1];
  if (!hr || !(total > 0)) return null;
  const sum = [0, 0];
  const weight = [0, 0];
  for (let i = 1; i < hr.length; i++) {
    if (!(hr[i] > 0)) continue;
    const w = s.time ? gap(s.time, i) : 1;
    const h = d[i] <= total / 2 ? 0 : 1;
    sum[h] += hr[i] * w;
    weight[h] += w;
  }
  return weight[0] > 0 && weight[1] > 0 ? [sum[0] / weight[0], sum[1] / weight[1]] : null;
}

// Różnica tempa (s/km, dodatnia = wolniej) każdego odcinka kmSplits od średniego tempa tych odcinków.
export function splitDeltas(s: RunStreams): number[] {
  const splits = kmSplits(s);
  const km = splits.reduce((a, x) => a + x.km, 0);
  const avg = splits.reduce((a, x) => a + x.pace * x.km, 0) / km;
  return splits.map((x) => x.pace - avg);
}

// Zapas (s, dodatni = przed) nad równym tempem całego biegu w n punktach dystansu, z czasu w ruchu.
export function pacingSeries(s: RunStreams, n = 120): number[] {
  const { distance: d, time: t } = s;
  const total = d[d.length - 1];
  if (!t || d.length < 2 || !(total > 0) || n < 2) return [];
  const moving = movingTime(t);
  const end = moving[moving.length - 1];
  if (!(end > 0)) return [];
  return Array.from({ length: n }, (_, k) => {
    const x = (total * k) / (n - 1);
    return (x / total) * end - lerpAt(d, moving, x);
  });
}

// Nachylenie (%) w n punktach dystansu: różnica wysokości próbek series na krańcach okna ±3 próbek
// (lekkie wygładzenie szumu GPS); [] bez wysokości.
export function gradeSeries(s: RunStreams, n = 200): number[] {
  const alt = series(s, 'altitude', n);
  if (alt.length < 2) return [];
  const step = s.distance[s.distance.length - 1] / (n - 1);
  return alt.map((_, i) => {
    const [a, b] = [Math.max(0, i - 3), Math.min(n - 1, i + 3)];
    return ((alt[b] - alt[a]) / ((b - a) * step)) * 100;
  });
}

// Prędkość pionowa (m/h, ujemna w dół) w n równych odcinkach dystansu, z czasu w ruchu.
export function climbRates(s: RunStreams, n = 30): number[] {
  const { distance: d, time: t, altitude: a } = s;
  const total = d[d.length - 1];
  if (!t || !a || d.length < 2 || !(total > 0)) return [];
  const moving = movingTime(t);
  return Array.from({ length: n }, (_, k) => {
    const [x0, x1] = [(total * k) / n, (total * (k + 1)) / n];
    const dt = lerpAt(d, moving, x1) - lerpAt(d, moving, x0);
    return dt > 0 ? ((lerpAt(d, a, x1) - lerpAt(d, a, x0)) / dt) * 3600 : 0;
  });
}

// Najbliższy okrągły cel (km) nie mniejszy od dystansu; 1% zapasu, bo GPS rzadko daje równe 10,00 czy 42,195.
const GOALS = [1, 3, 5, 10, 15, 21.0975, 30, 42.195, 50];
export function distanceGoal(meters: number): number {
  const km = (meters * 0.99) / 1000;
  return GOALS.find((g) => g >= km) ?? Math.ceil(km / 50) * 50;
}

// Poziomy kropek (0, 1, -1, 2, -2…) tak, by kropki na jednym poziomie były od siebie co najmniej o gap.
export function swarm(xs: number[], gap: number): number[] {
  const levels: number[] = [];
  xs.forEach((x, i) => {
    for (let k = 0; ; k++) {
      const level = k % 2 ? (k + 1) / 2 : -k / 2;
      if (xs.slice(0, i).every((y, j) => levels[j] !== level || Math.abs(y - x) >= gap)) {
        levels.push(level === 0 ? 0 : level);
        return;
      }
    }
  });
  return levels;
}
