import { routePath } from '../lib/routePath';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
const BOX: [[number, number], [number, number]] = [
  [90, 260],
  [990, 1180],
];

export function Route({ polyline }: { polyline: string }) {
  const d = routePath(polyline, BOX);
  if (d === null) return null;

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
