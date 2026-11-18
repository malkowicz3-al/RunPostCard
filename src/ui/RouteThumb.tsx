import { routePath } from '../lib/routePath';

// Miniatura w viewBox 100x100; margines 8, żeby zaokrąglone końce nie były ucinane.
const BOX: [[number, number], [number, number]] = [
  [8, 8],
  [92, 92],
];

export function RouteThumb({ polyline }: { polyline: string }) {
  return (
    <svg className="route-thumb" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d={routePath(polyline, BOX) ?? ''}
        fill="none"
        stroke="#fc4c02"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
