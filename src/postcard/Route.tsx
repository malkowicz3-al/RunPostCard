import type { Box } from '../lib/routePath';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

export function Route({ d }: { d: string }) {
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
