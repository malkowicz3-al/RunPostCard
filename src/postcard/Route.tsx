import type { Box } from '../lib/routePath';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

// outlineWidth = grubość obwódki z każdej strony (pod spodem druga, szersza ścieżka).
export type RouteStyle = {
  stroke?: string;
  width?: number;
  outline?: string;
  outlineWidth?: number;
  dash?: string;
  filter?: string;
  crisp?: boolean;
};

export function Route({
  d,
  stroke = '#ffffff',
  width = 14,
  outline,
  outlineWidth = 0,
  dash,
  filter,
  crisp,
}: { d: string } & RouteStyle) {
  const common = {
    d,
    fill: 'none',
    strokeLinecap: crisp ? 'square' : 'round',
    strokeLinejoin: crisp ? 'miter' : 'round',
    shapeRendering: crisp ? 'crispEdges' : undefined,
  } as const;
  return (
    <g filter={filter}>
      {outline && <path {...common} stroke={outline} strokeWidth={width + 2 * outlineWidth} strokeDasharray={dash} />}
      <path {...common} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />
    </g>
  );
}
