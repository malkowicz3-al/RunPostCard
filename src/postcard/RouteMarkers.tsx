import { formatPace } from '../lib/format';
import type { Highlight } from '../lib/runHighlights';

const label = ({ kind, value }: Highlight): string => {
  switch (kind) {
    case 'fastest':
      return `FASTEST ${formatPace(value, 1)}/km`; // value w m/s: 1 s na value metrów
    case 'maxHr':
      return `MAX HR ${Math.round(value)}`;
    case 'minHr':
      return `MIN HR ${Math.round(value)}`;
    case 'highest':
      return `HIGHEST ${Math.round(value)} m`;
  }
};

export function RouteMarkers({ points, items, color }: {
  points: ([number, number] | null)[];
  items: Highlight[];
  color: string;
}) {
  return (
    <g>
      {items.map((h) => {
        const p = points[h.index];
        if (!p) return null;
        const [x, y] = p;
        const left = x < 540;
        return (
          <g key={h.kind}>
            <circle cx={x} cy={y} r={12} fill={color} stroke="#000000" strokeOpacity={0.6} strokeWidth={4} />
            <text
              x={left ? x + 22 : x - 22}
              y={y + 10}
              fontSize={30}
              fontWeight={700}
              fontFamily="'Barlow Condensed', system-ui, sans-serif"
              textAnchor={left ? 'start' : 'end'}
              fill={color}
              stroke="#000000"
              strokeOpacity={0.6}
              strokeWidth={6}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {label(h)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
