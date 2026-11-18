import type { ReactNode } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { bestSplits, gainSeries, hrBins, kmGrades, kmSplits, series, speedHr, zoneOf, zoneShare } from '../lib/chartData';
import { formatPace } from '../lib/format';
import type { Box } from './slots';

export type ChartProps = { box: Box; streams: RunStreams; activity: Activity; label: string; value: string; scale: number };

// Jedyny wyjątek od currentColor (ADR 0007): strefy tętna Z1–Z5; z nich też podjazd (pomarańcz) i zjazd (niebieski), jak w 3D.
export const ZONE_COLORS = ['#a0a7b4', '#3b9cff', '#3ccf6e', '#ffa630', '#ff4d4d'];
const UP = ZONE_COLORS[3];
const DOWN = ZONE_COLORS[1];

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

// Średnia ruchoma (okno 2k+1): kadencja i prędkość skaczą z próbki na próbkę.
function smooth(v: number[], k = 3): number[] {
  return v.map((_, i) => {
    const w = v.slice(Math.max(0, i - k), i + k + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
}

// Jedna seria w kolorze tekstu, z lekkim wypełnieniem pod linią.
function Trend(props: ChartProps & { v: number[] }) {
  return (
    <Frame {...props}>
      {(p) => {
        const line = pathOf(points(smooth(props.v), p));
        return (
          <>
            <path d={`${line}L${p.x1} ${p.y1}L${p.x0} ${p.y1}Z`} opacity={0.12} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      }}
    </Frame>
  );
}

export const SpeedChart = (props: ChartProps) => <Trend {...props} v={series(props.streams, 'velocity')} />;
export const CadenceChart = (props: ChartProps) => <Trend {...props} v={series(props.streams, 'cadence')} />;

// Przewyższenie narastająco: pole od zera do sumy podjazdów, więc płaskie odcinki widać jako półki.
export function GainChart(props: ChartProps) {
  const v = gainSeries(props.streams);
  const max = v[v.length - 1] || 1;
  return (
    <Frame {...props}>
      {(p) => {
        const line = pathOf(v.map((a, i) => [p.x0 + (i / (v.length - 1)) * (p.x1 - p.x0), p.y1 - (a / max) * (p.y1 - p.y0)]));
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

// Rozkład tętna: słupek na 5 bpm, wysokość = udział czasu, kolor strefy środka przedziału.
export function HrBinsChart(props: ChartProps) {
  const bins = hrBins(props.streams);
  const top = Math.max(...bins.map((b) => b.share));
  const max = maxHrOf(props.activity, props.streams);
  return (
    <Frame {...props}>
      {(p) => {
        const slot = (p.x1 - p.x0) / bins.length;
        const bw = slot * 0.8;
        return bins.map((b, i) => {
          const h = (b.share / top) * (p.y1 - p.y0);
          return h > 0 ? (
            <rect
              key={i}
              x={r1(p.x0 + i * slot + (slot - bw) / 2)}
              y={r1(p.y1 - h)}
              width={r1(bw)}
              height={r1(h)}
              rx={r1(Math.min(bw / 4, 6))}
              fill={ZONE_COLORS[zoneOf(b.lo + 2.5, max)]}
            />
          ) : null;
        });
      }}
    </Frame>
  );
}

// Nachylenie na km od linii środka: w górę podjazd, w dół zjazd; płaski km ma cienką kreskę.
export function GradeChart(props: ChartProps) {
  const grades = kmGrades(props.streams);
  const peak = Math.max(...grades.map(Math.abs)) || 1;
  return (
    <Frame {...props}>
      {(p) => {
        const mid = (p.y0 + p.y1) / 2;
        const slot = (p.x1 - p.x0) / grades.length;
        const bw = slot * 0.7;
        return (
          <>
            <path d={`M${p.x0} ${r1(mid)}L${p.x1} ${r1(mid)}`} stroke="currentColor" strokeWidth={2} opacity={0.3} />
            {grades.map((g, i) => {
              const h = Math.max(4, (Math.abs(g) / peak) * (mid - p.y0));
              return (
                <rect
                  key={i}
                  x={r1(p.x0 + i * slot + (slot - bw) / 2)}
                  y={r1(g >= 0 ? mid - h : mid)}
                  width={r1(bw)}
                  height={r1(h)}
                  rx={r1(Math.min(bw / 4, 6))}
                  fill={g >= 0 ? UP : DOWN}
                />
              );
            })}
          </>
        );
      }}
    </Frame>
  );
}

// Zakres bez skrajnych 2% (skoki GPS w prędkości), żeby reszta kropek nie zbiła się w jednym miejscu.
function spread(v: number[]): [number, number] {
  const s = [...v].sort((a, b) => a - b);
  const lo = s[Math.floor(s.length * 0.02)];
  const hi = s[Math.ceil(s.length * 0.98) - 1];
  return [lo, hi > lo ? hi : lo + 1];
}

// Prędkość (w prawo szybciej) do tętna (w górę wyżej), kropki w kolorach stref.
export function ScatterChart(props: ChartProps) {
  const pts = speedHr(props.streams);
  const [s0, s1] = spread(pts.map((q) => q.speed));
  const [h0, h1] = spread(pts.map((q) => q.hr));
  const max = maxHrOf(props.activity, props.streams);
  const f = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return (
    <Frame {...props}>
      {(p) => {
        const r = 7;
        return pts.map((q, i) => (
          <circle
            key={i}
            cx={r1(p.x0 + r + f(q.speed, s0, s1) * (p.x1 - p.x0 - 2 * r))}
            cy={r1(p.y1 - r - f(q.hr, h0, h1) * (p.y1 - p.y0 - 2 * r))}
            r={r}
            fill={ZONE_COLORS[zoneOf(q.hr, max)]}
            opacity={0.75}
          />
        ));
      }}
    </Frame>
  );
}

// Trzy najszybsze km jako wiersze (miejsce, numer km, tempo) z paskiem prędkości pod spodem (najszybszy = pełny).
export function BestChart(props: ChartProps) {
  const best = bestSplits(props.streams);
  return (
    <Frame {...props}>
      {(p) => {
        const row = (p.y1 - p.y0) / 3;
        const fs = Math.min(row * 0.55, 72 * props.scale);
        return best.map((b, i) => {
          const base = p.y0 + i * row + row * 0.62;
          const bar = r1(base + fs * 0.25);
          return (
            <g key={b.km} opacity={i === 0 ? 1 : 0.7}>
              <text x={p.x0} y={r1(base)} fontSize={r1(fs)} opacity={0.5}>
                {i + 1}
              </text>
              <text x={r1(p.x0 + fs * 0.9)} y={r1(base)} fontSize={r1(fs)}>
                {`KM ${b.km}`}
              </text>
              <text x={p.x1} y={r1(base)} fontSize={r1(fs)} textAnchor="end">
                {formatPace(1000, b.pace)}
              </text>
              <rect x={p.x0} y={bar} width={r1(p.x1 - p.x0)} height={6} rx={3} opacity={0.15} />
              <rect x={p.x0} y={bar} width={r1((p.x1 - p.x0) * (best[0].pace / b.pace))} height={6} rx={3} />
            </g>
          );
        });
      }}
    </Frame>
  );
}

// Liczba i profil wysokości obok niej, do wąskiego paska. Szerokość liczby jak est() w slots (cyfra ok. 0,55 em),
// a szerszy font (mniejsza skala) zajmuje ok. 1/scale więcej.
export function SparkChart(props: ChartProps) {
  const alt = series(props.streams, 'altitude', 120);
  return (
    <Frame {...props} value={undefined}>
      {(p) => {
        const em = Math.max(1, props.value.length * 0.58);
        const fs = Math.min((p.y1 - p.y0) / 0.8, ((p.x1 - p.x0) * 0.4 * props.scale) / em);
        const sx = p.x0 + (em * fs) / props.scale + 40;
        const line = pathOf(points(alt, { ...p, x0: sx }));
        return (
          <>
            <text x={p.x0} y={r1(p.y1 - 0.05 * fs)} fontSize={r1(fs)}>
              {props.value}
            </text>
            <path d={`${line}L${p.x1} ${p.y1}L${sx} ${p.y1}Z`} opacity={0.2} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={4} strokeLinejoin="round" />
          </>
        );
      }}
    </Frame>
  );
}
