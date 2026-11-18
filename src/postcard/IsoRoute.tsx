import type { IsoRoute as Iso } from '../lib/isoRoute';

// Stałe kolory: w 3D nie ma motywu mapy (ThemeOutput nie istnieje).
const DOWNHILL = '#5ab4ff';
const FLAT = '#ffffff';
const UPHILL = '#ff9a3d';
const THRESHOLD = 0.03; // ±3% nachylenia

const colorOf = (g: number) => (g < -THRESHOLD ? DOWNHILL : g > THRESHOLD ? UPHILL : FLAT);
const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

export function IsoRoute({ iso }: { iso: Iso }) {
  const { points, ground, grade, exaggeration } = iso;
  // Kurtyna: czworokąty między podłożem a trasą, jedna ścieżka.
  const curtain = grade
    .map((_, i) => `M${pt(ground[i])}L${pt(points[i])}L${pt(points[i + 1])}L${pt(ground[i + 1])}Z`)
    .join('');
  const shadow = `M${ground.map(pt).join('L')}`;
  // Kolejne odcinki w tym samym kolorze łączymy w jedną ścieżkę.
  const runs: { color: string; d: string }[] = [];
  grade.forEach((g, i) => {
    const color = colorOf(g);
    const lastRun = runs[runs.length - 1];
    if (lastRun?.color === color) lastRun.d += `L${pt(points[i + 1])}`;
    else runs.push({ color, d: `M${pt(points[i])}L${pt(points[i + 1])}` });
  });
  const bottom = [...points, ...ground].reduce((max, [, y]) => Math.max(max, y), -Infinity);

  return (
    <g>
      <path d={curtain} fill="#ffffff" fillOpacity={0.12} stroke="none" />
      <path d={shadow} fill="none" stroke="#000000" strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
      {runs.map((r, i) => (
        <path key={i} d={r.d} fill="none" stroke={r.color} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {exaggeration > 1.05 && (
        <text
          x={540}
          y={Math.min(bottom + 48, 1230)}
          fontSize={28}
          fontWeight={700}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          textAnchor="middle"
          fill="#ffffff"
          opacity={0.8}
        >
          elevation ×{exaggeration.toFixed(1)}
        </text>
      )}
    </g>
  );
}
