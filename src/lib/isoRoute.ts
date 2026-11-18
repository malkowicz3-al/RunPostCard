import { geoMercator } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Box } from './routePath';

export type IsoRoute = {
  points: [number, number][]; // trasa podniesiona o wysokość, w układzie płótna
  ground: [number, number][]; // ta sama trasa na podłożu (cień, dół kurtyny)
  grade: number[]; // wygładzone nachylenie odcinka i -> i+1 (kolor)
  exaggeration: number; // >1 = przewyższenie wzmocnione (podpis "elevation ×N")
};

const EARTH_RADIUS_M = 6371000;
const MIN_CURTAIN = 0.15; // przewyższenie zajmuje co najmniej tyle wysokości pola
const SMOOTH = 15; // próbki średniej wysokości do nachylenia (szum zegarka)

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

// Izometria: Mercator, obrót o 45°, oś Y × 0,5, podniesienie o wysokość; całość dopasowana do box.
export function isoRoute(s: RunStreams, box: Box): IsoRoute | null {
  const alt = s.altitude;
  const n = s.latlng.length;
  if (!alt || n < 2) return null;

  const projection = geoMercator();
  const flat = s.latlng.map(([lat, lng]) => {
    const [x, y] = projection([lng, lat]) ?? [0, 0];
    return [(x - y) / Math.SQRT2, ((x + y) / Math.SQRT2) * 0.5] as [number, number];
  });

  // Metry -> px nieustawionej projekcji (Mercator rozciąga o 1/cos(lat)).
  const meanLat = s.latlng.reduce((sum, [lat]) => sum + lat, 0) / n;
  const k0 = projection.scale() / (EARTH_RADIUS_M * Math.cos((meanLat * Math.PI) / 180));
  const [minAlt, maxAlt] = extent(alt);
  const span = maxAlt - minAlt;

  const [gx0, gx1] = extent(flat.map(([x]) => x));
  const [gy0, gy1] = extent(flat.map(([, y]) => y));
  const groundW = gx1 - gx0;
  const groundH = gy1 - gy0;
  const [[x0, y0], [x1, y1]] = box;
  const boxW = x1 - x0;
  const boxH = y1 - y0;
  // Najmniejsze podniesienie L, przy którym po dopasowaniu L zajmuje MIN_CURTAIN wysokości pola:
  // gdy ogranicza wysokość, L / (groundH + L) >= MIN; gdy szerokość, L * boxW / groundW >= MIN * boxH.
  const minLift = Math.max((MIN_CURTAIN / (1 - MIN_CURTAIN)) * groundH, (MIN_CURTAIN * boxH * groundW) / boxW);
  const exaggeration = span > 0 ? Math.max(1, minLift / (span * k0)) : 1;
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

  const sm = smooth(alt, SMOOTH);
  const grade = sm.slice(1).map((a, i) => {
    const dd = s.distance[i + 1] - s.distance[i];
    return dd > 0 ? (a - sm[i]) / dd : 0;
  });

  return { points: raised.map(fit), ground: flat.map(fit), grade, exaggeration };
}
