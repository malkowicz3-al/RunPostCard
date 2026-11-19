import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { decodePolyline } from './polyline';

export type Box = [[number, number], [number, number]];

export type FittedRoute = { d: string; bounds: Box; points: [number, number][] };

// GeoJSON wymaga [lng, lat]; dekoder zwraca [lat, lng].
const lineOf = (points: [number, number][]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: points.map(([lat, lng]) => [lng, lat]) },
});

// Ścieżka, obrys i punkty trasy w danej projekcji.
function project(points: [number, number][], projection: GeoProjection): FittedRoute {
  const line = lineOf(points);
  const path = geoPath(projection);
  return { d: path(line) ?? '', bounds: path.bounds(line), points: points.map(([lat, lng]) => projection([lng, lat])!) };
}

// Jedna projekcja dla kilku tras naraz (widok „Together”), dopasowana do box; trasa z mniej niż 2 punktami to null.
// null, gdy żadna trasa nie ma 2 punktów.
export function fitRoutes(
  polylines: string[],
  box: Box,
): { projection: GeoProjection; routes: (FittedRoute | null)[] } | null {
  const decoded = polylines.map(decodePolyline);
  const features = decoded.filter((p) => p.length >= 2).map(lineOf);
  if (features.length === 0) return null;
  const projection = geoMercator().fitExtent(box, { type: 'FeatureCollection', features });
  return { projection, routes: decoded.map((points) => (points.length < 2 ? null : project(points, projection))) };
}

const EARTH_RADIUS_M = 6371000;

// Układ „Overlay”: każda trasa przesunięta tak, że start jest w tym samym punkcie, wspólna skala w metrach
// (najszersza trasa wypełnia box). Osobna projekcja na bieg: Mercator ze środkiem w starcie i skalą
// R · cos(lat startu) · k, więc 1 m to k px dla każdego biegu. Bez mapy (projekcje nie są jednym światem).
export function overlayRoutes(
  polylines: string[],
  box: Box,
): { projections: (GeoProjection | null)[]; routes: (FittedRoute | null)[] } | null {
  const decoded = polylines.map(decodePolyline);
  const unit = (points: [number, number][], k: number, at: [number, number]) =>
    geoMercator()
      .center([points[0][1], points[0][0]])
      .scale(EARTH_RADIUS_M * Math.cos((points[0][0] * Math.PI) / 180) * k)
      .translate(at);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const points of decoded) {
    if (points.length < 2) continue;
    const p = unit(points, 1, [0, 0]);
    for (const [lat, lng] of points) {
      const [x, y] = p([lng, lat])!;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!(maxX >= minX)) return null;
  const [[x0, y0], [x1, y1]] = box;
  let k = Math.min(maxX > minX ? (x1 - x0) / (maxX - minX) : Infinity, maxY > minY ? (y1 - y0) / (maxY - minY) : Infinity);
  if (!Number.isFinite(k)) k = 1;
  // Start w punkcie, przy którym prostokąt wszystkich tras jest na środku box.
  const at: [number, number] = [x0 + (x1 - x0 - (maxX - minX) * k) / 2 - minX * k, y0 + (y1 - y0 - (maxY - minY) * k) / 2 - minY * k];
  const projections = decoded.map((points) => (points.length < 2 ? null : unit(points, k, at)));
  return { projections, routes: decoded.map((points, i) => (projections[i] ? project(points, projections[i]) : null)) };
}

// Projekcja trasy dopasowana do obszaru box (x0, y0, x1, y1) i jej ścieżka SVG; null gdy są mniej niż 2 punkty.
// Tę samą projekcję dostają warstwy pod trasą (mapa), żeby się pokrywały.
export function fitRoute(polyline: string, box: Box): ({ projection: GeoProjection } & FittedRoute) | null {
  const fit = fitRoutes([polyline], box);
  const route = fit?.routes[0];
  return fit && route ? { projection: fit.projection, ...route } : null;
}

export function routePath(polyline: string, box: Box): string | null {
  return fitRoute(polyline, box)?.d ?? null;
}
