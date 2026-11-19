import type { RouteLegend as Legend } from './routeColor';

// Mała legenda stylu linii w prawym dolnym rogu (obok znaku Stravy, przed pionowym podpisem mapy).
const X0 = 660;
const X1 = 1010;
const Y = 1852;

export function RouteLegend({ legend, color }: { legend: Legend; color: string }) {
  const w = X1 - X0;
  const n = legend.stops.length;
  return (
    <g fill={color} fontSize={20} fontWeight={600} fontFamily="system-ui, sans-serif" letterSpacing={2}>
      {!legend.steps && (
        <defs>
          <linearGradient id="route-legend">
            {legend.stops.map((c, i) => (
              <stop key={i} offset={i / (n - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
      )}
      <text x={X1} y={Y - 10} textAnchor="end" opacity={0.85}>
        {legend.title}
      </text>
      {legend.steps ? (
        legend.stops.map((c, i) => <rect key={i} x={X0 + (i * w) / n + 2} y={Y} width={w / n - 4} height={10} rx={3} fill={c} />)
      ) : (
        <rect x={X0} y={Y} width={w} height={10} rx={5} fill="url(#route-legend)" />
      )}
      <text x={X0} y={Y + 34} opacity={0.85}>
        {legend.from}
      </text>
      <text x={X1} y={Y + 34} textAnchor="end" opacity={0.85}>
        {legend.to}
      </text>
    </g>
  );
}
