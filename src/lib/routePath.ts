import { geoMercator, geoPath } from 'd3-geo';
import { decodePolyline } from './polyline';

export type Box = [[number, number], [number, number]];

// Ścieżka SVG trasy dopasowana do obszaru box (x0, y0, x1, y1); null gdy są mniej niż 2 punkty.
export function routePath(polyline: string, box: Box): string | null {
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
  return geoPath(projection)(line) ?? '';
}
