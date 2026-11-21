import type { GeoProjection } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Box } from './routePath';
import { demAt, type Dem } from './dem';

export type Slope = -1 | 0 | 1; // z góry, płasko, pod górę

export type IsoRoute = {
  points: [number, number][]; // trasa podniesiona o wysokość, w układzie płótna
  ground: [number, number][]; // ta sama trasa na podłożu (cień, dół kurtyny)
  distance: number[]; // m od startu w każdym punkcie (jak streams.distance): ułamek długości trasy bez przekłamań rzutu
  slope: Slope[]; // klasa nachylenia odcinka i -> i+1 (kolor), bez krótkich wysp
  exaggeration: number; // >1 = przewyższenie wzmocnione (najwyżej ×3)
  matrix: [number, number, number, number, number, number]; // SVG matrix: płaskie płótno -> podłoże 3D (mapa)
  pxPerM: number; // px ekranu na metr wysokości (bez przewyższenia trasy)
  baseM: number; // wysokość [m] na poziomie podłoża (min. na trasie); relief terenu podnosi o (h − baseM) · pxPerM · exaggeration
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
export function smoothByDistance(values: number[], distance: number[], half: number): number[] {
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

type Prepared = { flat: [number, number][]; alt: number[]; k0: number; distance: number[] };

// Trasa obrócona o 45° + azymut na płaskim płótnie i jej wysokości (przed dopasowaniem do box).
function prepare(s: RunStreams, projection: GeoProjection, dem: Dem | undefined, cos: number, sin: number): Prepared | null {
  const n = s.latlng.length;
  if (!s.altitude || n < 2) return null;

  const lat = smooth(s.latlng.map(([la]) => la), LATLNG_SMOOTH);
  const lng = smooth(s.latlng.map(([, lo]) => lo), LATLNG_SMOOTH);
  const canvas = lat.map((la, i) => projection([lng[i], la]) ?? [0, 0]);
  const flat = canvas.map(([x, y]) => [x * cos - y * sin, (x * sin + y * cos) / 2] as [number, number]);

  // Metry -> px projekcji (d3 Mercator: x = scale · λ, więc 1 m = scale / (R · cos lat)).
  const meanLat = lat.reduce((sum, v) => sum + v, 0) / n;
  const k0 = projection.scale() / (EARTH_RADIUS_M * Math.cos((meanLat * Math.PI) / 180));
  // DEM jest już gładki (~30 m); wygładzanie odkleiłoby trasę od grzbietów i dolin.
  const alt = dem ? canvas.map(([x, y]) => demAt(dem, x, y)) : smoothByDistance(s.altitude, s.distance, ALT_HALF_M);
  return { flat, alt, k0, distance: s.distance };
}

// Wspólne dopasowanie do box: jedna podstawa wysokości, jedno przewyższenie i jedna macierz dla wszystkich tras.
function build(runs: Prepared[], box: Box, cos: number, sin: number): IsoRoute[] {
  const [minAlt, maxAlt] = extent(runs.flatMap((r) => extent(r.alt)));
  const span = maxAlt - minAlt;
  // shortcut: przewyższenie i pxPerM ze średniego k0 (różni się z szerokością geograficzną), dla biegów oddalonych o setki km liczyć osobno.
  const k0 = runs.reduce((sum, r) => sum + r.k0, 0) / runs.length;

  const flatAll = runs.flatMap((r) => r.flat);
  const [gx0, gx1] = extent(flatAll.map(([x]) => x));
  const [gy0, gy1] = extent(flatAll.map(([, y]) => y));
  const groundW = gx1 - gx0;
  const groundH = gy1 - gy0;
  const [[x0, y0], [x1, y1]] = box;
  const boxW = x1 - x0;
  const boxH = y1 - y0;
  // Podniesienie L, przy którym po dopasowaniu L zajmuje MIN_CURTAIN wysokości pola:
  // gdy ogranicza wysokość, L / (groundH + L) >= MIN; gdy szerokość, L * boxW / groundW >= MIN * boxH.
  const minLift = Math.max((MIN_CURTAIN / (1 - MIN_CURTAIN)) * groundH, (MIN_CURTAIN * boxH * groundW) / boxW);
  const exaggeration = span > 0 ? Math.min(MAX_EXAGGERATION, Math.max(1, minLift / (span * k0))) : 1;

  const raised = runs.map((r) => r.flat.map(([x, y], i) => [x, y - (r.alt[i] - minAlt) * r.k0 * exaggeration] as [number, number]));
  const all = [...flatAll, ...raised.flat()];
  const [minX, maxX] = extent(all.map(([x]) => x));
  const [minY, maxY] = extent(all.map(([, y]) => y));
  let f = Math.min(maxX > minX ? boxW / (maxX - minX) : Infinity, maxY > minY ? boxH / (maxY - minY) : Infinity);
  if (!Number.isFinite(f)) f = 1;
  const dx = x0 + (boxW - (maxX - minX) * f) / 2;
  const dy = y0 + (boxH - (maxY - minY) * f) / 2;
  const fit = ([x, y]: [number, number]): [number, number] => [dx + (x - minX) * f, dy + (y - minY) * f];

  return runs.map((r, k) => {
    const grade = gradeByDistance(r.alt, r.distance, GRADE_HALF_M).slice(0, -1);
    return {
      points: raised[k].map(fit),
      ground: r.flat.map(fit),
      distance: r.distance,
      slope: slopes(grade, r.distance, MIN_RUN_M),
      exaggeration,
      matrix: [f * cos, (f * sin) / 2, -f * sin, (f * cos) / 2, dx - f * minX, dy - f * minY],
      pxPerM: k0 * f,
      baseM: minAlt,
    };
  });
}

// Izometria na płaskim płótnie pocztówki (projection = fit.projection, ta sama co mapa):
// obrót o 45° + azymut (stopnie, obrót sceny), oś Y × 0,5, podniesienie o wysokość; całość dopasowana do box
// przy każdym azymucie (skala trochę się zmienia). Przekształcenie podłoża jest afiniczne, więc mapa trafia pod trasę
// jako <g transform="matrix(...)">. dem: wysokości z terenu zamiast zegarka, żeby trasa leżała na reliefie (ADR 0008;
// relief zakłada azymut 0).
export function isoRoute(s: RunStreams, box: Box, projection: GeoProjection, dem?: Dem, azimuth = 0): IsoRoute | null {
  const theta = Math.PI / 4 + (azimuth * Math.PI) / 180;
  const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
  const run = prepare(s, projection, dem, cos, sin);
  return run ? build([run], box, cos, sin)[0] : null;
}
