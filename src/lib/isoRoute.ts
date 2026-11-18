import type { GeoProjection } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Box } from './routePath';

export type Slope = -1 | 0 | 1; // z góry, płasko, pod górę

export type IsoRoute = {
  points: [number, number][]; // trasa podniesiona o wysokość, w układzie płótna
  ground: [number, number][]; // ta sama trasa na podłożu (cień, dół kurtyny)
  slope: Slope[]; // klasa nachylenia odcinka i -> i+1 (kolor), bez krótkich wysp
  exaggeration: number; // >1 = przewyższenie wzmocnione (podpis "elevation ×N")
  matrix: [number, number, number, number, number, number]; // SVG matrix: płaskie płótno -> podłoże 3D (mapa)
};

const EARTH_RADIUS_M = 6371000;
const MIN_CURTAIN = 0.06; // płaski bieg: celujemy w tyle wysokości pola, ale najwyżej do MAX_EXAGGERATION
const MAX_EXAGGERATION = 3; // mocniej szum zegarka wygląda jak schody
const LATLNG_SMOOTH = 7; // próbki średniej GPS (włochata linia)
const ALT_HALF_M = 100; // okno ±100 m dla wysokości
const GRADE_HALF_M = 100; // okno ±100 m dla nachylenia
const GRADE_THRESHOLD = 0.04; // ±4%
const MIN_RUN_M = 150; // krótszy odcinek jednej klasy przejmuje klasę sąsiada (bez migotania)

function smooth(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    let sum = 0;
    for (let j = from; j < to; j++) sum += values[j];
    return sum / (to - from);
  });
}

// Średnia w oknie ±half metrów dystansu: próbki zegarka nie są równomierne.
function smoothByDistance(values: number[], distance: number[], half: number): number[] {
  let lo = 0;
  let hi = 0;
  let sum = 0;
  return values.map((_, i) => {
    while (hi < values.length && distance[hi] <= distance[i] + half) sum += values[hi++];
    while (distance[lo] < distance[i] - half) sum -= values[lo++];
    return sum / (hi - lo);
  });
}

// Nachylenie w punkcie: różnica wysokości na krańcach okna ±half metrów.
function gradeByDistance(alt: number[], distance: number[], half: number): number[] {
  let lo = 0;
  let hi = 0;
  return alt.map((_, i) => {
    while (hi + 1 < alt.length && distance[hi + 1] <= distance[i] + half) hi++;
    while (distance[lo] < distance[i] - half) lo++;
    const dd = distance[hi] - distance[lo];
    return dd > 0 ? (alt[hi] - alt[lo]) / dd : 0;
  });
}

// Klasy odcinków; serie krótsze niż minM przejmują klasę poprzedniej (pierwsza: następnej).
function slopes(grade: number[], distance: number[], minM: number): Slope[] {
  const cls: Slope[] = grade.map((g) => (g < -GRADE_THRESHOLD ? -1 : g > GRADE_THRESHOLD ? 1 : 0));
  const runs: { from: number; to: number }[] = [];
  cls.forEach((c, i) => {
    if (i > 0 && cls[i - 1] === c) runs[runs.length - 1].to = i + 1;
    else runs.push({ from: i, to: i + 1 });
  });
  runs.forEach((r, k) => {
    if (distance[r.to] - distance[r.from] >= minM) return;
    const other = k > 0 ? runs[k - 1] : runs[k + 1];
    if (other) cls.fill(cls[other.from], r.from, r.to);
  });
  return cls;
}

// Pętla zamiast Math.min(...a): długie strumienie przekraczają limit argumentów (Safari ~65k).
function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

// Izometria na płaskim płótnie pocztówki (projection = fit.projection, ta sama co mapa):
// obrót o 45°, oś Y × 0,5, podniesienie o wysokość; całość dopasowana do box. Przekształcenie podłoża
// jest afiniczne, więc mapa trafia pod trasę jako <g transform="matrix(...)">.
export function isoRoute(s: RunStreams, box: Box, projection: GeoProjection): IsoRoute | null {
  const n = s.latlng.length;
  if (!s.altitude || n < 2) return null;

  const lat = smooth(s.latlng.map(([la]) => la), LATLNG_SMOOTH);
  const lng = smooth(s.latlng.map(([, lo]) => lo), LATLNG_SMOOTH);
  const flat = lat.map((la, i) => {
    const [x, y] = projection([lng[i], la]) ?? [0, 0];
    return [(x - y) / Math.SQRT2, (x + y) / (2 * Math.SQRT2)] as [number, number];
  });

  // Metry -> px projekcji (d3 Mercator: x = scale · λ, więc 1 m = scale / (R · cos lat)).
  const meanLat = lat.reduce((sum, v) => sum + v, 0) / n;
  const k0 = projection.scale() / (EARTH_RADIUS_M * Math.cos((meanLat * Math.PI) / 180));
  const alt = smoothByDistance(s.altitude, s.distance, ALT_HALF_M);
  const [minAlt, maxAlt] = extent(alt);
  const span = maxAlt - minAlt;

  const [gx0, gx1] = extent(flat.map(([x]) => x));
  const [gy0, gy1] = extent(flat.map(([, y]) => y));
  const groundW = gx1 - gx0;
  const groundH = gy1 - gy0;
  const [[x0, y0], [x1, y1]] = box;
  const boxW = x1 - x0;
  const boxH = y1 - y0;
  // Podniesienie L, przy którym po dopasowaniu L zajmuje MIN_CURTAIN wysokości pola:
  // gdy ogranicza wysokość, L / (groundH + L) >= MIN; gdy szerokość, L * boxW / groundW >= MIN * boxH.
  const minLift = Math.max((MIN_CURTAIN / (1 - MIN_CURTAIN)) * groundH, (MIN_CURTAIN * boxH * groundW) / boxW);
  const exaggeration = span > 0 ? Math.min(MAX_EXAGGERATION, Math.max(1, minLift / (span * k0))) : 1;
  const lift = (i: number) => (alt[i] - minAlt) * k0 * exaggeration;

  const raised = flat.map(([x, y], i) => [x, y - lift(i)] as [number, number]);
  const all = [...flat, ...raised];
  const [minX, maxX] = extent(all.map(([x]) => x));
  const [minY, maxY] = extent(all.map(([, y]) => y));
  let f = Math.min(maxX > minX ? boxW / (maxX - minX) : Infinity, maxY > minY ? boxH / (maxY - minY) : Infinity);
  if (!Number.isFinite(f)) f = 1;
  const dx = x0 + (boxW - (maxX - minX) * f) / 2;
  const dy = y0 + (boxH - (maxY - minY) * f) / 2;
  const fit = ([x, y]: [number, number]): [number, number] => [dx + (x - minX) * f, dy + (y - minY) * f];
  const a = f / Math.SQRT2;
  const b = f / (2 * Math.SQRT2);

  const grade = gradeByDistance(alt, s.distance, GRADE_HALF_M).slice(0, -1);
  return {
    points: raised.map(fit),
    ground: flat.map(fit),
    slope: slopes(grade, s.distance, MIN_RUN_M),
    exaggeration,
    matrix: [a, b, -a, b, dx - f * minX, dy - f * minY],
  };
}
