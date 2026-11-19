import { useMemo } from 'react';
import type { Box } from '../lib/routePath';
import { segments, trimAt } from './routeColor';

// Obszar trasy na płótnie 1080x1920 (x0, y0, x1, y1).
export const ROUTE_BOX: Box = [
  [90, 260],
  [990, 1180],
];

export type RouteStyle = { stroke?: string; width?: number; filter?: string; dash?: string }; // dash: stroke-dasharray

// Kreska i przerwy w jednostkach ekranu: przy zoomie kamery dzielimy je jak grubość linii.
export const scaleDash = (dash: string | undefined, zoom: number) => dash?.split(/[\s,]+/).map((n) => +n / zoom).join(' ');

// Kropka „biegacza” na czele rysowanej trasy (animacja): kolor trasy z białą obwódką, grubości niezależne od zoomu.
export const RunnerDot = ({ at: [x, y], color, r, zoom }: { at: [number, number]; color: string; r: number; zoom: number }) => (
  <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={r / zoom} fill={color} stroke="#ffffff" strokeWidth={5 / zoom} />
);

// progress < 1 (animacja): linia tylko do tego ułamka długości, z kropką na czele; 1 = jak dotąd.
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
  progress = 1,
}: { d: string; zoom?: number; points?: [number, number][]; color?: (t: number) => string; progress?: number } & RouteStyle) {
  const line = useMemo(() => (points && progress < 1 ? trimAt(points, progress).pts(points) : points), [points, progress]);
  // Odcinki przyciętej linii: t liczone od jej długości, czyli razy progress względem całej trasy.
  const segs = useMemo(
    () => (color && line ? segments(line).map((s) => ({ ...s, color: color(s.t * progress) })) : null),
    [line, color, progress],
  );
  const dot = line && progress < 1 && (
    <RunnerDot at={line[line.length - 1]} color={color ? color(progress) : stroke} r={width * 1.1} zoom={zoom} />
  );
  if (segs) {
    // Zaokrąglone końce nachodzą na siebie na łączeniach: niewidoczne przy pełnym kolorze, przy półprzezroczystym dałyby kropki.
    return (
      <>
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
        {dot}
      </>
    );
  }
  return (
    <>
      <path
        d={line && progress < 1 ? `M${line.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}` : d}
        fill="none"
        stroke={stroke}
        strokeWidth={width / zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={scaleDash(dash, zoom)}
        filter={filter}
      />
      {dot}
    </>
  );
}
