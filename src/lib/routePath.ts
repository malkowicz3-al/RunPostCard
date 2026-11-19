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
