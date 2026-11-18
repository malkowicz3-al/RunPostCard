import type { ReactNode } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { kmSplits, series, zoneOf, zoneShare } from '../lib/chartData';
import type { Box } from './slots';

export type ChartProps = { box: Box; streams: RunStreams; activity: Activity; label: string; value: string; scale: number };

// Jedyny wyjątek od currentColor (ADR 0007): strefy tętna Z1–Z5.
export const ZONE_COLORS = ['#a0a7b4', '#3b9cff', '#3ccf6e', '#ffa630', '#ff4d4d'];

const r1 = (n: number) => Math.round(n * 10) / 10;
const pathOf = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');

// Etykieta w lewym górnym rogu (jak w SlotNumber), wartość po prawej; reszta box to pole wykresu.
function Frame({ box, label, value, scale, children }: Omit<ChartProps, 'streams' | 'activity' | 'value'> & {
  value?: string;
  children: (plot: Box) => ReactNode;
}) {
  const fs = 36 * scale;
  const base = box.y0 + 0.75 * 48 * scale;
  return (
    <g fill="currentColor">
      <text x={box.x0} y={base} fontSize={fs} letterSpacing={4 * scale} opacity={0.8}>
        {label}
      </text>
      {value && (
        <text x={box.x1} y={base} fontSize={48 * scale} textAnchor="end">
          {value}
        </text>
      )}
      {children({ ...box, y0: base + 24 })}
    </g>
  );
}

// Punkty serii w polu: najniższa wartość na 15% wysokości, żeby płaska trasa nie leżała na krawędzi.
function points(v: number[], p: Box): [number, number][] {
  const min = Math.min(...v);
  const range = Math.max(...v) - min || 1;
  return v.map((a, i) => [p.x0 + (i / (v.length - 1)) * (p.x1 - p.x0), p.y1 - (0.15 + (0.85 * (a - min)) / range) * (p.y1 - p.y0)]);
}

const maxHrOf = (a: Activity, s: RunStreams) => a.max_heartrate ?? (s.heartrate ?? []).reduce((m, x) => Math.max(m, x), 0);

export function AreaChart(props: ChartProps) {
  return (
    <Frame {...props}>
      {(p) => {
        const line = pathOf(points(series(props.streams, 'altitude'), p));
        return (
          <>
            <path d={`${line}L${p.x1} ${p.y1}L${p.x0} ${p.y1}Z`} opacity={0.3} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={5} strokeLinejoin="round" />
          </>
        );
      }}
    </Frame>
  );
}

// Linia tętna podzielona na odcinki o stałej strefie; sąsiednie odcinki dzielą punkt, więc linia jest ciągła.
export function LineChart(props: ChartProps) {
  const v = series(props.streams, 'heartrate');
  const max = maxHrOf(props.activity, props.streams);
  return (
    <Frame {...props}>
      {(p) => {
        const pts = points(v, p);
        const segs: { zone: number; pts: [number, number][] }[] = [];
        pts.forEach((pt, i) => {
          const zone = zoneOf(v[i], max);
          const last = segs[segs.length - 1];
          if (last?.zone === zone) last.pts.push(pt);
          else segs.push({ zone, pts: last ? [last.pts[last.pts.length - 1], pt] : [pt] });
        });
        return segs.map((s, i) => (
          <path key={i} d={pathOf(s.pts)} fill="none" stroke={ZONE_COLORS[s.zone]} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        ));
      }}
    </Frame>
  );
}

// Słupek na km, wysokość z prędkości (szybszy = wyższy); najszybszy w pełnym kryciu.
export function BarsChart(props: ChartProps) {
  const splits = kmSplits(props.streams);
  const speed = splits.map((s) => 1 / s.pace);
  const lo = Math.min(...speed);
  const range = Math.max(...speed) - lo;
  const best = speed.indexOf(Math.max(...speed));
  return (
    <Frame {...props}>
      {(p) => {
        const slot = (p.x1 - p.x0) / splits.length;
        const bw = slot * 0.7;
        return speed.map((v, i) => {
          const h = (range > 0 ? 0.25 + (0.75 * (v - lo)) / range : 1) * (p.y1 - p.y0);
          return (
            <rect
              key={i}
              x={r1(p.x0 + i * slot + (slot - bw) / 2)}
              y={r1(p.y1 - h)}
              width={r1(bw)}
              height={r1(h)}
              rx={r1(Math.min(bw / 4, 8))}
              opacity={i === best ? 1 : 0.45}
            />
          );
        });
      }}
    </Frame>
  );
}

// Pierścień udziału stref (łuki z stroke-dasharray), w środku średnie tętno; legenda obok, gdy jest miejsce.
export function RingChart(props: ChartProps) {
  const share = zoneShare(props.streams, maxHrOf(props.activity, props.streams));
  return (
    <Frame {...props} value={undefined}>
      {(p) => {
        const h = p.y1 - p.y0;
        const legend = p.x1 - p.x0 - h >= 300;
        const sw = h * 0.16;
        const r = (h - sw) / 2;
        const cx = legend ? p.x0 + h / 2 : (p.x0 + p.x1) / 2;
        const cy = p.y0 + h / 2;
        const c = 2 * Math.PI * r;
        let at = 0;
        const row = h / 5;
        return (
          <>
            <circle cx={cx} cy={cy} r={r1(r)} fill="none" stroke="currentColor" strokeWidth={r1(sw)} opacity={0.15} />
            {share.map((s, z) => {
              const off = at;
              at += s;
              return s > 0 ? (
                <circle
                  key={z}
                  cx={cx}
                  cy={cy}
                  r={r1(r)}
                  fill="none"
                  stroke={ZONE_COLORS[z]}
                  strokeWidth={r1(sw)}
                  strokeDasharray={`${r1(s * c)} ${r1(c)}`}
                  strokeDashoffset={r1(-off * c)}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              ) : null;
            })}
            <text x={cx} y={r1(cy + 0.35 * r * 0.6)} fontSize={r1(r * 0.6)} textAnchor="middle">
              {props.value}
            </text>
            {legend &&
              [4, 3, 2, 1, 0].map((z, i) => (
                <g key={z}>
                  <rect x={p.x0 + h + 60} y={r1(p.y0 + i * row + row * 0.25)} width={row * 0.5} height={row * 0.5} rx={6} fill={ZONE_COLORS[z]} />
                  <text x={p.x0 + h + 60 + row * 0.8} y={r1(p.y0 + i * row + row * 0.68)} fontSize={r1(Math.min(row * 0.55, 44 * props.scale))}>
                    {`Z${z + 1}  ${Math.round(share[z] * 100)}%`}
                  </text>
                </g>
              ))}
          </>
        );
      }}
    </Frame>
  );
}
