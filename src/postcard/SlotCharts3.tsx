import { halfHr, paceBins, pacingSeries, splitDeltas } from '../lib/chartData';
import { formatDuration, formatPace } from '../lib/format';
import { colorScale } from './routeColor';
import { Frame, pathOf, r1, type ChartProps } from './SlotChart';

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const signed = (s: number) => `${s < 0 ? '−' : '+'}${formatDuration(Math.abs(s))}`;

// Rozkład tempa co 10 s/km (w lewo szybciej); najczęstszy przedział w pełnym kryciu, skrajne tempa pod osią.
export function PaceBinsChart(props: ChartProps) {
  const bins = paceBins(props.streams);
  const top = Math.max(...bins.map((b) => b.share));
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 6);
        const y1 = p.y1 - fs * 1.3;
        const slot = (p.x1 - p.x0) / bins.length;
        const bw = slot * 0.8;
        return (
          <>
            {bins.map((b, i) => {
              const h = (b.share / top) * (y1 - p.y0);
              return h > 0 ? (
                <rect key={i} x={r1(p.x0 + i * slot + (slot - bw) / 2)} y={r1(y1 - h)} width={r1(bw)} height={r1(h)} rx={r1(Math.min(bw / 4, 6))} opacity={b.share === top ? 1 : 0.5} />
              ) : null;
            })}
            <text x={p.x0} y={r1(p.y1)} fontSize={r1(fs)} opacity={0.6}>
              {formatPace(1000, bins[0].lo)}
            </text>
            <text x={p.x1} y={r1(p.y1)} fontSize={r1(fs)} textAnchor="end" opacity={0.6}>
              {formatPace(1000, bins[bins.length - 1].lo + 10)}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Średnie tętno pierwszej i drugiej połowy (dłuższy pasek = wyższe) i różnica w bpm.
export function HrDriftChart(props: ChartProps) {
  const [a, b] = halfHr(props.streams)!;
  const delta = Math.round(b - a);
  const verdict = delta === 0 ? 'STEADY' : `${delta < 0 ? '−' : '+'}${Math.abs(delta)} BPM DRIFT`;
  const high = Math.max(a, b);
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const row = (p.y1 - p.y0) / 3;
        const fs = Math.min(row * 0.5, 48 * props.scale, w / 13);
        const bh = Math.max(6, row * 0.18);
        return (
          <>
            {[a, b].map((hr, i) => {
              const base = p.y0 + i * row + fs;
              return (
                <g key={i} opacity={hr === high ? 1 : 0.6}>
                  <text x={p.x0} y={r1(base)} fontSize={r1(fs * 0.8)} opacity={0.7}>
                    {i === 0 ? '1ST HALF' : '2ND HALF'}
                  </text>
                  <text x={p.x1} y={r1(base)} fontSize={r1(fs)} textAnchor="end">
                    {Math.round(hr)}
                  </text>
                  <rect x={p.x0} y={r1(base + fs * 0.3)} width={r1(w)} height={r1(bh)} rx={4} opacity={0.15} />
                  <rect x={p.x0} y={r1(base + fs * 0.3)} width={r1(w * (hr / high))} height={r1(bh)} rx={4} />
                </g>
              );
            })}
            <text x={p.x0} y={r1(p.y0 + 2 * row + row * 0.7)} fontSize={r1(fs)}>
              {verdict}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Odchyłka tempa km od średniej: w górę szybciej (pełne krycie), w dół wolniej; po bokach największe odchyłki.
export function SplitDeltaChart(props: ChartProps) {
  const deltas = splitDeltas(props.streams);
  const peak = Math.max(...deltas.map(Math.abs)) || 1;
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 6);
        const x0 = p.x0 + fs * 3;
        const mid = (p.y0 + p.y1) / 2;
        const slot = (p.x1 - x0) / deltas.length;
        const bw = slot * 0.7;
        return (
          <>
            <path d={`M${r1(x0)} ${r1(mid)}L${p.x1} ${r1(mid)}`} stroke="currentColor" strokeWidth={2} opacity={0.3} />
            <text x={p.x0} y={r1(p.y0 + fs)} fontSize={r1(fs)} opacity={0.6}>
              {signed(-peak)}
            </text>
            <text x={p.x0} y={r1(p.y1)} fontSize={r1(fs)} opacity={0.6}>
              {signed(peak)}
            </text>
            {deltas.map((d, i) => {
              const h = Math.max(3, (Math.abs(d) / peak) * (mid - p.y0));
              return <rect key={i} x={r1(x0 + i * slot + (slot - bw) / 2)} y={r1(d <= 0 ? mid - h : mid)} width={r1(bw)} height={r1(h)} rx={r1(Math.min(bw / 4, 5))} opacity={d <= 0 ? 1 : 0.45} />;
            })}
          </>
        );
      }}
    </Frame>
  );
}

// Pasek tempa wzdłuż dystansu w kolorach stylu linii Pace (szybko chłodno, wolno ciepło).
export function PaceStripChart(props: ChartProps) {
  const color = colorScale('pace', props.streams)!;
  const N = 60;
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 4);
        const bh = Math.min(p.y1 - p.y0 - fs * 1.6, 90);
        const y = p.y0 + (p.y1 - p.y0 - bh - fs * 1.4) / 2;
        const w = (p.x1 - p.x0) / N;
        return (
          <>
            {Array.from({ length: N }, (_, i) => (
              // +0.5 px: bez szczelin między sąsiednimi odcinkami przy wygładzaniu krawędzi
              <rect key={i} x={r1(p.x0 + i * w)} y={r1(y)} width={r1(w + 0.5)} height={r1(bh)} fill={color((i + 0.5) / N)} />
            ))}
            <text x={p.x0} y={r1(y + bh + fs * 1.3)} fontSize={r1(fs)} opacity={0.6}>
              START
            </text>
            <text x={p.x1} y={r1(y + bh + fs * 1.3)} fontSize={r1(fs)} textAnchor="end" opacity={0.6}>
              FINISH
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Zapas nad równym tempem wzdłuż dystansu: nad linią przed, pod linią za; na końcu zawsze 0.
export function PacingChart(props: ChartProps) {
  const v = pacingSeries(props.streams);
  const peak = Math.max(...v.map(Math.abs)) || 1;
  const best = Math.max(...v);
  const worst = Math.min(...v);
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 6);
        const x0 = p.x0 + fs * 3;
        const mid = (p.y0 + p.y1) / 2;
        const half = (p.y1 - p.y0) / 2 - 4;
        const pts = v.map((a, i): [number, number] => [x0 + (i / (v.length - 1)) * (p.x1 - x0), mid - clamp(a / peak, -1, 1) * half]);
        const line = pathOf(pts);
        return (
          <>
            <path d={`M${r1(x0)} ${r1(mid)}L${p.x1} ${r1(mid)}`} stroke="currentColor" strokeWidth={2} strokeDasharray="10 10" opacity={0.4} />
            <path d={`${line}L${p.x1} ${r1(mid)}L${r1(x0)} ${r1(mid)}Z`} opacity={0.15} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            <text x={p.x0} y={r1(p.y0 + fs)} fontSize={r1(fs)} opacity={0.6}>
              {signed(Math.max(0, best))}
            </text>
            <text x={p.x0} y={r1(p.y1)} fontSize={r1(fs)} opacity={0.6}>
              {signed(Math.min(0, worst))}
            </text>
          </>
        );
      }}
    </Frame>
  );
}
