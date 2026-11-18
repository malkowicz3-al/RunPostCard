import { useMemo } from 'react';
import type { IsoRoute as Iso } from '../lib/isoRoute';

const DOWNHILL = '#5ab4ff';
const UPHILL = '#ff9a3d';
const MAX_DRAWN = 800; // rysujemy co k-ty punkt; markery dalej używają pełnych iso.points

const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// flat: kolor płaskich odcinków i podpisu (biały na gradiencie, kolor trasy motywu na mapie).
export function IsoRoute({ iso, flat = '#ffffff', text = '#ffffff' }: { iso: Iso; flat?: string; text?: string }) {
  const { curtain, shadow, runs, bottom } = useMemo(() => {
    const { points, ground, slope } = iso;
    const k = Math.ceil(points.length / MAX_DRAWN);
    const idx = points.map((_, i) => i).filter((i) => i % k === 0 || i === points.length - 1);
    // Kurtyna: czworokąty między podłożem a trasą, jedna ścieżka.
    const curtain = idx
      .slice(1)
      .map((i, j) => `M${pt(ground[idx[j]])}L${pt(points[idx[j]])}L${pt(points[i])}L${pt(ground[i])}Z`)
      .join('');
    const shadow = `M${idx.map((i) => pt(ground[i])).join('L')}`;
    // Kolejne odcinki w tym samym kolorze łączymy w jedną ścieżkę.
    const runs: { color: string; d: string }[] = [];
    idx.slice(1).forEach((i, j) => {
      const s = slope[idx[j]];
      const color = s < 0 ? DOWNHILL : s > 0 ? UPHILL : flat;
      const lastRun = runs[runs.length - 1];
      if (lastRun?.color === color) lastRun.d += `L${pt(points[i])}`;
      else runs.push({ color, d: `M${pt(points[idx[j]])}L${pt(points[i])}` });
    });
    const bottom = [...points, ...ground].reduce((max, [, y]) => Math.max(max, y), -Infinity);
    return { curtain, shadow, runs, bottom };
  }, [iso, flat]);

  return (
    <g>
      <path d={curtain} fill={flat} fillOpacity={0.07} stroke="none" />
      <path d={shadow} fill="none" stroke="#000000" strokeOpacity={0.2} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {runs.map((r, i) => (
        <path key={i} d={r.d} fill="none" stroke={r.color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {iso.exaggeration > 1.05 && (
        <text
          x={540}
          y={Math.min(bottom + 48, 1230)}
          fontSize={28}
          fontWeight={700}
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
          textAnchor="middle"
          fill={text}
          opacity={0.8}
        >
          elevation ×{iso.exaggeration.toFixed(1)}
        </text>
      )}
    </g>
  );
}
