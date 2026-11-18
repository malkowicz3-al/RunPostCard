import { geoMercator, geoPath } from 'd3-geo';
import { decodePolyline } from '../lib/polyline';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
const BOX: [[number, number], [number, number]] = [
  [90, 260],
  [990, 1180],
];

export function Route({ polyline }: { polyline: string }) {
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
  const projection = geoMercator().fitExtent(BOX, line);
  const d = geoPath(projection)(line) ?? '';

  return (
    <path
      d={d}
      fill="none"
      stroke="#ffffff"
      strokeWidth={14}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}
