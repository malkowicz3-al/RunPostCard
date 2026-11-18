import type { Box } from '../lib/routePath';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

export type RouteStyle = { stroke?: string; width?: number; filter?: string };

export function Route({ d, stroke = '#ffffff', width = 14, filter }: { d: string } & RouteStyle) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={filter}
    />
  );
}
