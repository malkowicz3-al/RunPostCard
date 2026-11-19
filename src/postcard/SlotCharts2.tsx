import { climbRates, cadenceBins, distanceGoal, halfSplits, kmSplits, series, swarm, zoneShare } from '../lib/chartData';
import { formatPace } from '../lib/format';
import { DOWN, Frame, UP, ZONE_COLORS, maxHrOf, pathOf, points, r1, smooth, spread, type ChartProps } from './SlotChart';
import { DATA } from './slots';

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const paceOf = (mps: number) => formatPace(1000, 1000 / mps);

// Tempo jako prędkość (szybciej = wyżej), skoki GPS obcięte przez spread; przerywana linia = średnia.
export function PaceLineChart(props: ChartProps) {
  const raw = smooth(series(props.streams, 'velocity'), 6);
  const [lo, hi] = spread(raw);
  const v = raw.map((x) => clamp(x, lo, hi));
  const avg = props.activity.distance / props.activity.moving_time;
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 6);
        const plot = { ...p, x0: p.x0 + fs * 2.6 };
        const pts = points(v, plot);
        const yAt = (x: number) => plot.y1 - (0.15 + (0.85 * (x - Math.min(...v))) / (Math.max(...v) - Math.min(...v) || 1)) * (plot.y1 - plot.y0);
        const ay = r1(clamp(yAt(avg), plot.y0, plot.y1));
        return (
          <>
            <text x={p.x0} y={r1(plot.y0 + fs)} fontSize={r1(fs)} opacity={0.6}>
              {paceOf(Math.max(...v))}
            </text>
            <text x={p.x0} y={r1(plot.y1)} fontSize={r1(fs)} opacity={0.6}>
              {paceOf(Math.min(...v))}
            </text>
            <path d={`M${r1(plot.x0)} ${ay}L${plot.x1} ${ay}`} stroke="currentColor" strokeWidth={2} strokeDasharray="10 10" opacity={0.4} />
            <path d={pathOf(pts)} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      }}
    </Frame>
  );
}

// Poziomy pasek 100% czasu w strefach, procent pod odcinkiem, gdy się mieści.
export function ZoneBarChart(props: ChartProps) {
  const share = zoneShare(props.streams, maxHrOf(props.activity, props.streams));
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const h = p.y1 - p.y0;
        const bh = Math.min(h * 0.45, 90);
        const fs = Math.min(36 * props.scale, h * 0.22);
        const y = p.y0 + (h - bh - fs * 2.4) / 2;
        let at = p.x0;
        return share.map((s, z) => {
          const x = at;
          at += s * w;
          if (!(s > 0)) return null;
          return (
            <g key={z}>
              <rect x={r1(x)} y={r1(y)} width={r1(Math.max(0, s * w - 4))} height={r1(bh)} rx={6} fill={ZONE_COLORS[z]} />
              {s * w >= fs * 2.4 && (
                <>
                  <text x={r1(x + (s * w) / 2)} y={r1(y + bh + fs * 1.1)} fontSize={r1(fs)} textAnchor="middle">
                    {`${Math.round(s * 100)}%`}
                  </text>
                  <text x={r1(x + (s * w) / 2)} y={r1(y + bh + fs * 2.2)} fontSize={r1(fs * 0.8)} textAnchor="middle" opacity={0.6}>
                    {`Z${z + 1}`}
                  </text>
                </>
              )}
            </g>
          );
        });
      }}
    </Frame>
  );
}

// Tabela km | tempo w kolumnach dobranych do wysokości; najszybszy km w pełnym kryciu z kreską.
export function SplitListChart(props: ChartProps) {
  const splits = kmSplits(props.streams);
  const best = splits.reduce((b, s, i) => (s.pace < splits[b].pace ? i : b), 0);
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const h = p.y1 - p.y0;
        const cols = Math.ceil(splits.length / Math.max(1, Math.floor(h / 40)));
        const rows = Math.ceil(splits.length / cols);
        const row = h / rows;
        const colW = (w + 48) / cols; // odstęp 48 px tylko między kolumnami, ostatnia kończy się na krawędzi
        // ok. 4,6 em na „12  4:59”, 48 px odstępu między kolumnami.
        const fs = Math.min(row * 0.75, 56 * props.scale, (colW - 48) / 4.6);
        return splits.map((s, i) => {
          const cx = p.x0 + Math.floor(i / rows) * colW;
          const base = p.y0 + (i % rows) * row + row * 0.5 + fs * 0.35;
          return (
            <g key={i} opacity={i === best ? 1 : 0.65}>
              <text x={r1(cx)} y={r1(base)} fontSize={r1(fs)} opacity={0.6}>
                {s.km < 1 ? (i + s.km).toFixed(1) : i + 1}
              </text>
              <text x={r1(cx + colW - 48)} y={r1(base)} fontSize={r1(fs)} textAnchor="end">
                {formatPace(1000, s.pace)}
              </text>
              {i === best && <rect x={r1(cx)} y={r1(base + fs * 0.15)} width={r1(colW - 48)} height={4} rx={2} />}
            </g>
          );
        });
      }}
    </Frame>
  );
}

// Profil wysokości jako tło i linia tempa (szybciej = wyżej) na wierzchu.
export function PaceElevChart(props: ChartProps) {
  const raw = smooth(series(props.streams, 'velocity'), 6);
  const [lo, hi] = spread(raw);
  const v = raw.map((x) => clamp(x, lo, hi));
  const alt = series(props.streams, 'altitude');
  return (
    <Frame {...props}>
      {(p) => {
        const area = pathOf(points(alt, p));
        return (
          <>
            <path d={`${area}L${p.x1} ${p.y1}L${p.x0} ${p.y1}Z`} opacity={0.22} />
            <path d={pathOf(points(v, { ...p, y0: p.y0 + 4 }))} fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      }}
    </Frame>
  );
}

// Wycinek pierścienia od kąta a0 do a1 (radiany, 0 = góra, zgodnie z zegarem).
function wedge(cx: number, cy: number, r0: number, r: number, a0: number, a1: number) {
  const pt = (rr: number, a: number) => `${r1(cx + rr * Math.sin(a))} ${r1(cy - rr * Math.cos(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(r0, a0)}L${pt(r, a0)}A${r1(r)} ${r1(r)} 0 ${large} 1 ${pt(r, a1)}L${pt(r0, a1)}A${r1(r0)} ${r1(r0)} 0 ${large} 0 ${pt(r0, a0)}Z`;
}

// Koło km: wycinek na km, długość z prędkości (szybszy = dłuższy), w środku średnie tempo.
export function PolarChart(props: ChartProps) {
  const splits = kmSplits(props.streams);
  const speed = splits.map((s) => 1 / s.pace);
  const lo = Math.min(...speed);
  const range = Math.max(...speed) - lo;
  const best = speed.indexOf(Math.max(...speed));
  return (
    <Frame {...props} value={undefined}>
      {(p) => {
        const R = Math.min(p.x1 - p.x0, p.y1 - p.y0) / 2;
        const r0 = R * 0.4;
        const cx = (p.x0 + p.x1) / 2;
        const cy = (p.y0 + p.y1) / 2;
        const step = (2 * Math.PI) / splits.length;
        const pad = Math.min(step * 0.12, 0.06);
        return (
          <>
            {speed.map((v, i) => {
              const r = r0 + (range > 0 ? 0.3 + (0.7 * (v - lo)) / range : 1) * (R - r0);
              return <path key={i} d={wedge(cx, cy, r0, r, i * step + pad, (i + 1) * step - pad)} opacity={i === best ? 1 : 0.45} />;
            })}
            <text x={r1(cx)} y={r1(cy + r0 * 0.2)} fontSize={r1(r0 * 0.55)} textAnchor="middle">
              {props.value}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Półkole od 50% do 100% tętna maks. w kolorach stref, wskazówka na średnim tętnie.
export function GaugeChart(props: ChartProps) {
  const max = maxHrOf(props.activity, props.streams);
  const hr = series(props.streams, 'heartrate');
  const avg = props.activity.average_heartrate ?? hr.reduce((a, b) => a + b, 0) / hr.length;
  const EDGES = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  // Kąt od -90° (50%) do 90° (100%), 0 = góra.
  const angle = (f: number) => ((clamp(f, 0.5, 1) - 0.5) / 0.5) * Math.PI - Math.PI / 2;
  return (
    <Frame {...props} value={undefined}>
      {(p) => {
        const R = Math.min((p.x1 - p.x0) / 2, p.y1 - p.y0 - 8);
        const cx = (p.x0 + p.x1) / 2;
        const cy = p.y1 - 4;
        const sw = R * 0.16;
        const a = angle(avg / max);
        return (
          <>
            {EDGES.slice(0, -1).map((e, z) => (
              <path key={z} d={wedge(cx, cy, R - sw, R, angle(e) + 0.015, angle(EDGES[z + 1]) - 0.015)} fill={ZONE_COLORS[z]} />
            ))}
            <path
              d={`M${r1(cx)} ${r1(cy)}L${r1(cx + R * 0.78 * Math.sin(a))} ${r1(cy - R * 0.78 * Math.cos(a))}`}
              stroke="currentColor"
              strokeWidth={r1(Math.max(4, R * 0.04))}
              strokeLinecap="round"
            />
            <circle cx={r1(cx)} cy={r1(cy)} r={r1(Math.max(6, R * 0.06))} />
            <text x={r1(cx)} y={r1(cy - R * 0.3)} fontSize={r1(R * 0.3)} textAnchor="middle">
              {props.value}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

const goalName = (g: number) => (g === 21.0975 ? 'HALF MARATHON' : g === 42.195 ? 'MARATHON' : `${g} KM`);

// Pasek postępu do najbliższego okrągłego celu, kreski co 1 km (powyżej 21 km co 5 km).
export function GoalChart(props: ChartProps) {
  const goal = distanceGoal(props.activity.distance);
  const f = clamp(props.activity.distance / 1000 / goal, 0, 1);
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const h = p.y1 - p.y0;
        const fs = Math.min(36 * props.scale, w / 13, h * 0.3);
        const bh = Math.min(h - fs * 1.6, 60);
        const y = p.y0 + (h - bh - fs * 1.4) / 2;
        const tick = goal > 21.1 ? 5 : 1;
        const ticks = Array.from({ length: Math.floor((goal - 0.001) / tick) }, (_, i) => (i + 1) * tick);
        return (
          <>
            <rect x={p.x0} y={r1(y)} width={r1(w)} height={r1(bh)} rx={r1(bh / 2)} opacity={0.15} />
            <rect x={p.x0} y={r1(y)} width={r1(Math.max(bh, f * w))} height={r1(bh)} rx={r1(bh / 2)} />
            {ticks.map((k) => (
              <rect key={k} x={r1(p.x0 + (k / goal) * w - 1)} y={r1(y + bh * 0.3)} width={2} height={r1(bh * 0.4)} opacity={0.35} />
            ))}
            <text x={p.x0} y={r1(y + bh + fs * 1.3)} fontSize={r1(fs)}>
              {`${Math.round(f * 100)}%`}
            </text>
            <text x={p.x1} y={r1(y + bh + fs * 1.3)} fontSize={r1(fs)} textAnchor="end" opacity={0.7}>
              {goalName(goal)}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Kropka na km na osi tempa (w prawo szybciej), bliskie kropki ułożone w pionie; najszybsza w pełnym kryciu.
export function SwarmChart(props: ChartProps) {
  const splits = kmSplits(props.streams);
  const speed = splits.map((s) => 1 / s.pace);
  const lo = Math.min(...speed);
  const range = Math.max(...speed) - lo || 1;
  const best = speed.indexOf(Math.max(...speed));
  return (
    <Frame {...props}>
      {(p) => {
        const fs = Math.min(30 * props.scale, (p.y1 - p.y0) / 6);
        const h = p.y1 - p.y0 - fs * 1.4;
        const r = clamp(h / 9, 6, 22);
        const x = (v: number) => p.x0 + r + ((v - lo) / range) * (p.x1 - p.x0 - 2 * r);
        const levels = swarm(speed.map(x), 2 * r + 2);
        const mid = p.y0 + h / 2;
        // Za dużo kropek na jednym tempie: ściskamy poziomy, żeby nie wyszły poza pole.
        const top = Math.max(1, ...levels.map(Math.abs));
        const dy = Math.min(2 * r + 2, (h / 2 - r) / top);
        return (
          <>
            <path d={`M${p.x0} ${r1(mid)}L${p.x1} ${r1(mid)}`} stroke="currentColor" strokeWidth={2} opacity={0.25} />
            {speed.map((v, i) => (
              <circle key={i} cx={r1(x(v))} cy={r1(mid - levels[i] * dy)} r={r1(r)} opacity={i === best ? 1 : 0.5} />
            ))}
            <text x={p.x0} y={r1(p.y1)} fontSize={r1(fs)} opacity={0.6}>
              {formatPace(1000, 1 / lo)}
            </text>
            <text x={p.x1} y={r1(p.y1)} fontSize={r1(fs)} textAnchor="end" opacity={0.6}>
              {formatPace(1000, 1 / (lo + range))}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Wysokość schodkami co 250 m (najwyżej 60 słupków, żeby maraton nie zlał się w pole).
export function SkylineChart(props: ChartProps) {
  const total = props.streams.distance[props.streams.distance.length - 1];
  const alt = series(props.streams, 'altitude', clamp(Math.round(total / 250), 4, 60));
  const min = Math.min(...alt);
  const range = Math.max(...alt) - min || 1;
  return (
    <Frame {...props}>
      {(p) => {
        const slot = (p.x1 - p.x0) / alt.length;
        const gap = Math.min(4, slot * 0.15);
        return alt.map((a, i) => {
          const f = (a - min) / range;
          const h = (0.15 + 0.85 * f) * (p.y1 - p.y0);
          return <rect key={i} x={r1(p.x0 + i * slot)} y={r1(p.y1 - h)} width={r1(slot - gap)} height={r1(h)} opacity={r1(0.3 + 0.7 * f)} />;
        });
      }}
    </Frame>
  );
}

// Rozkład kadencji (kroki obu nóg); najczęstszy przedział w pełnym kryciu, skrajne wartości pod osią.
export function CadenceHistChart(props: ChartProps) {
  const bins = cadenceBins(props.streams);
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
              {bins[0].lo * 2}
            </text>
            <text x={p.x1} y={r1(p.y1)} fontSize={r1(fs)} textAnchor="end" opacity={0.6}>
              {(bins[bins.length - 1].lo + 2) * 2}
            </text>
          </>
        );
      }}
    </Frame>
  );
}

// Jedno uderzenie (P, QRS, T) jako [ułamek szerokości, ułamek amplitudy w górę].
const BEAT: [number, number][] = [
  [0, 0], [0.22, 0], [0.28, 0.12], [0.34, 0], [0.42, -0.15], [0.5, 1], [0.57, -0.3], [0.63, 0], [0.74, 0.2], [0.84, 0], [1, 0],
];

// Stylizowany zapis EKG: uderzenia wzdłuż dystansu, wyższe przy wyższym tętnie (to ozdoba, nie prawdziwy sygnał).
export function EcgChart(props: ChartProps) {
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const h = p.y1 - p.y0;
        const n = clamp(Math.round(w / 48), 8, 24);
        const hr = series(props.streams, 'heartrate', n);
        const [lo, hi] = spread(hr);
        const base = p.y0 + h * 0.7;
        const bw = w / n;
        const pts = hr.flatMap((v, i) => {
          const amp = (0.35 + 0.65 * clamp((v - lo) / (hi - lo), 0, 1)) * h * 0.66;
          return BEAT.map(([fx, fy]): [number, number] => [p.x0 + (i + fx) * bw, base - fy * amp]);
        });
        return <path d={pathOf(pts)} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />;
      }}
    </Frame>
  );
}

// Tempo pierwszej i drugiej połowy (dłuższy pasek = szybciej) i różnica: ujemna = druga połowa szybsza.
export function HalvesChart(props: ChartProps) {
  const [a, b] = halfSplits(props.streams)!;
  const delta = Math.round(b - a);
  const verdict = Math.abs(delta) < 1 ? 'EVEN SPLIT' : `${delta < 0 ? '−' : '+'}${formatPace(1000, Math.abs(delta))} ${delta < 0 ? 'NEGATIVE' : 'POSITIVE'} SPLIT`;
  const fast = Math.min(a, b);
  return (
    <Frame {...props}>
      {(p) => {
        const w = p.x1 - p.x0;
        const row = (p.y1 - p.y0) / 3;
        const fs = Math.min(row * 0.5, 48 * props.scale, w / 13);
        return (
          <>
            {[a, b].map((pace, i) => {
              const base = p.y0 + i * row + fs;
              return (
                <g key={i} opacity={pace === fast ? 1 : 0.6}>
                  <text x={p.x0} y={r1(base)} fontSize={r1(fs * 0.8)} opacity={0.7}>
                    {i === 0 ? '1ST HALF' : '2ND HALF'}
                  </text>
                  <text x={p.x1} y={r1(base)} fontSize={r1(fs)} textAnchor="end">
                    {formatPace(1000, pace)}
                  </text>
                  <rect x={p.x0} y={r1(base + fs * 0.3)} width={r1(w)} height={r1(Math.max(6, row * 0.18))} rx={4} opacity={0.15} />
                  <rect x={p.x0} y={r1(base + fs * 0.3)} width={r1(w * (fast / pace))} height={r1(Math.max(6, row * 0.18))} rx={4} />
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

// Prędkość pionowa (m/h) w odcinkach: w górę podjazd, w dół zjazd, od linii środka (jak nachylenie na km).
export function ClimbRateChart(props: ChartProps) {
  return (
    <Frame {...props}>
      {(p) => {
        const rates = climbRates(props.streams, clamp(Math.floor((p.x1 - p.x0) / 24), 10, 40));
        const peak = Math.max(...rates.map(Math.abs)) || 1;
        const mid = (p.y0 + p.y1) / 2;
        const slot = (p.x1 - p.x0) / rates.length;
        const bw = slot * 0.7;
        return (
          <>
            <path d={`M${p.x0} ${r1(mid)}L${p.x1} ${r1(mid)}`} stroke="currentColor" strokeWidth={2} opacity={0.3} />
            {rates.map((g, i) => {
              const h = Math.max(3, (Math.abs(g) / peak) * (mid - p.y0));
              return <rect key={i} x={r1(p.x0 + i * slot + (slot - bw) / 2)} y={r1(g >= 0 ? mid - h : mid)} width={r1(bw)} height={r1(h)} rx={r1(Math.min(bw / 4, 5))} fill={g >= 0 ? UP : DOWN} />;
            })}
          </>
        );
      }}
    </Frame>
  );
}

// Trzy małe liczby (maks. tętno, maks. prędkość, czas całkowity); bez tętna przewyższenie. Szeroki box: obok siebie, wąski: wiersze.
export function TrioChart(props: ChartProps) {
  const a = props.activity;
  const keys = [a.max_heartrate ? 'maxhr' : 'elevation', 'maxspeed', 'elapsed'] as const;
  return (
    <Frame {...props} value={undefined}>
      {(p) => {
        const w = p.x1 - p.x0;
        const h = p.y1 - p.y0;
        const wide = w / h >= 2;
        return keys.map((k, i) => {
          const label = DATA[k].label;
          const value = DATA[k].value(a);
          if (wide) {
            const cw = w / 3;
            const fs = Math.min(h * 0.55, (cw - 20) / (value.length * 0.6));
            const x = p.x0 + i * cw;
            return (
              <g key={k}>
                <text x={r1(x)} y={r1(p.y0 + fs * 0.8)} fontSize={r1(fs)}>
                  {value}
                </text>
                <text x={r1(x)} y={r1(p.y1)} fontSize={r1(Math.min(26 * props.scale, (cw - 20) / (label.length * 0.68)))} opacity={0.6} letterSpacing={2}>
                  {label}
                </text>
              </g>
            );
          }
          const row = h / 3;
          const fs = Math.min(row * 0.6, 64 * props.scale);
          const base = p.y0 + i * row + row * 0.5 + fs * 0.35;
          return (
            <g key={k}>
              <text x={p.x0} y={r1(base)} fontSize={r1(Math.min(fs * 0.55, (w * 0.55) / (label.length * 0.68)))} opacity={0.6} letterSpacing={2}>
                {label}
              </text>
              <text x={p.x1} y={r1(base)} fontSize={r1(fs)} textAnchor="end">
                {value}
              </text>
            </g>
          );
        });
      }}
    </Frame>
  );
}
