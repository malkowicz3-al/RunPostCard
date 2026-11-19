import { useMemo } from 'react';
import type { Box } from '../lib/routePath';
import { segments } from './routeColor';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

export type RouteStyle = { stroke?: string; width?: number; filter?: string; dash?: string }; // dash: stroke-dasharray

// Kreska i przerwy w jednostkach ekranu: przy zoomie kamery dzielimy je jak grubość linii.
export const scaleDash = (dash: string | undefined, zoom: number) => dash?.split(/[\s,]+/).map((n) => +n / zoom).join(' ');

// color + points: trasa w odcinkach z kolorem wg ułamka długości (styl linii); bez nich jedna ścieżka jak dotąd.
export function Route({
  d,
  stroke = '#ffffff',
  width = 14,
  filter,
  dash,
  zoom = 1,
  points,
  color,
}: { d: string; zoom?: number; points?: [number, number][]; color?: (t: number) => string } & RouteStyle) {
  const segs = useMemo(() => (color && points ? segments(points).map((s) => ({ ...s, color: color(s.t) })) : null), [points, color]);
  if (segs) {
    // Zaokrąglone końce nachodzą na siebie na łączeniach: niewidoczne przy pełnym kolorze, przy półprzezroczystym dałyby kropki.
    return (
      <g filter={filter}>
        {segs.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={s.color}
            strokeWidth={width / zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={scaleDash(dash, zoom)}
            strokeDashoffset={dash ? s.start : undefined}
          />
        ))}
      </g>
    );
  }
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
