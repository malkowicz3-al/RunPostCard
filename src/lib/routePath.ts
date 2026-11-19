import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { decodePolyline } from './polyline';

export type Box = [[number, number], [number, number]];

// Projekcja trasy dopasowana do obszaru box (x0, y0, x1, y1) i jej ścieżka SVG; null gdy są mniej niż 2 punkty.
// Tę samą projekcję dostają warstwy pod trasą (mapa), żeby się pokrywały.
export function fitRoute(
  polyline: string,
  box: Box,
): { projection: GeoProjection; d: string; bounds: Box; points: [number, number][] } | null {
  const points = decodePolyline(polyline);
  if (points.length < 2) return null;

  const line = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      // GeoJSON wymaga [lng, lat]; dekoder zwraca [lat, lng].
      coordinates: points.map(([lat, lng]) => [lng, lat]),
    },
  };
  const projection = geoMercator().fitExtent(box, line);
  const path = geoPath(projection);
  const projected = points.map(([lat, lng]) => projection([lng, lat])!);
  return { projection, d: path(line) ?? '', bounds: path.bounds(line), points: projected };
}

export function routePath(polyline: string, box: Box): string | null {
  return fitRoute(polyline, box)?.d ?? null;
}
