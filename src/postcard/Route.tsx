import type { Box } from '../lib/routePath';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

export type RouteStyle = { stroke?: string; width?: number; filter?: string; dash?: string }; // dash: stroke-dasharray

// Kreska i przerwy w jednostkach ekranu: przy zoomie kamery dzielimy je jak grubość linii.
export const scaleDash = (dash: string | undefined, zoom: number) => dash?.split(/[\s,]+/).map((n) => +n / zoom).join(' ');

export function Route({
  d,
  stroke = '#ffffff',
  width = 14,
  filter,
  dash,
  zoom = 1,
}: { d: string; zoom?: number } & RouteStyle) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width / zoom}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={scaleDash(dash, zoom)}
      filter={filter}
    />
  );
}
