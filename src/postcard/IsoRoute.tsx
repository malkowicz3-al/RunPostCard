import { useMemo } from 'react';
import type { IsoRoute as Iso } from '../lib/isoRoute';
import { scaleDash } from './Route';

const DOWNHILL = '#5ab4ff';
const UPHILL = '#ff9a3d';
const MAX_DRAWN = 800; // rysujemy co k-ty punkt; markery dalej używają pełnych iso.points

const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

// flat: kolor płaskich odcinków i kurtyny (biały na gradiencie, kolor trasy motywu na mapie).
// zoom: skala kamery nad tą grupą; grubości linii dzielimy przez nią, żeby trasa nie grubła po przybliżeniu.
export function IsoRoute({
  iso,
  flat = '#ffffff',
  filter,
  dash,
  zoom = 1,
  gradientId = 'iso-curtain-grad',
  onSurface = false,
}: {
  iso: Iso;
  flat?: string;
  filter?: string;
  dash?: string; // stroke-dasharray trasy motywu
  zoom?: number;
  gradientId?: string; // tło ekranu to osobny <svg> w tym samym dokumencie: inne id, bez duplikatów
  onSurface?: boolean; // trasa leży na reliefie terenu: bez kurtyny i cienia, lekko nad powierzchnią
}) {
  const { curtain, shadow, runs, top, bottom } = useMemo(() => {
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
    const top = points.reduce((min, [, y]) => Math.min(min, y), Infinity);
    const bottom = ground.reduce((max, [, y]) => Math.max(max, y), -Infinity);
    return { curtain, shadow, runs, top, bottom };
  }, [iso, flat]);

  const dashed = scaleDash(dash, zoom);
  const line = (
    <g filter={filter}>
      {runs.map((r, i) => (
        <path key={i} d={r.d} fill="none" stroke={r.color} strokeWidth={7 / zoom} strokeDasharray={dashed} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
  if (onSurface) return <g transform={`translate(0 ${-2 / zoom})`}>{line}</g>;
  return (
    <g>
      <defs>
        {/* Pionowy gradient kurtyny: mocniej przy trasie, prawie przezroczysto przy podłożu. */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={0} y1={top} x2={0} y2={Math.max(bottom, top + 1)}>
          <stop offset="0" stopColor={flat} stopOpacity={0.45} />
          <stop offset="1" stopColor={flat} stopOpacity={0.08} />
        </linearGradient>
      </defs>
      <path d={curtain} fill={`url(#${gradientId})`} stroke="none" />
      <path d={shadow} fill="none" stroke="#000000" strokeOpacity={0.2} strokeWidth={6 / zoom} strokeLinecap="round" strokeLinejoin="round" />
      {line}
    </g>
  );
}
