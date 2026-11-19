import { useMemo } from 'react';
import type { Activity } from '../strava/api';
import { decodePolyline } from '../lib/polyline';
import { fitRoutes, type Box } from '../lib/routePath';
import { DEFAULT_FONT, FONTS, fontStack, type FontId } from '../lib/fonts';
import { formatDate, formatDistanceKm, formatDuration } from '../lib/format';
import { MAP_ATTRIBUTION, type MapLayers } from '../lib/vectorMap';
import { Background } from './Background';
import { Route } from './Route';
import { SlotNumber } from './SlotNumber';
import { StravaMark } from './StravaMark';
import { THEMES, type ThemeId } from './themes';

// Pole tras pod nagłówkiem ze statystykami.
export const TOGETHER_BOX: Box = [
  [90, 440],
  [990, 1760],
];

export type TogetherColors = 'run' | 'heat';
export type TogetherSync = 'real' | 'together';

// Wszystkie trasy w jednej projekcji, płasko na wspólnej mapie.
export const togetherFit = (runs: Activity[]) => fitRoutes(runs.map((r) => r.map.summary_polyline), TOGETHER_BOX);

const FAR_SPAN_KM = 50;
const FAR_KM = FAR_SPAN_KM / 2;

// Układ geograficzny: gdy środki biegów rozciągają się na ponad 50 km, ukrywamy te dalej niż 25 km od mediany
// środków (jeden bieg w innym mieście zmniejszyłby resztę do kropek). Przybliżenie równoodległościowe wystarcza.
export function nearRuns(runs: Activity[]): { kept: Activity[]; hidden: number } {
  const centres = runs.map((r) => {
    const pts = decodePolyline(r.map.summary_polyline);
    const n = Math.max(1, pts.length);
    return pts.reduce(([la, lo], [a, b]) => [la + a / n, lo + b / n], [0, 0]);
  });
  const median = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const mid = [median(centres.map(([la]) => la)), median(centres.map(([, lo]) => lo))];
  const km = ([la, lo]: number[], [la2, lo2]: number[]) =>
    Math.hypot((lo - lo2) * 111.32 * Math.cos((mid[0] * Math.PI) / 180), (la - la2) * 110.57);
  const lats = centres.map(([la]) => la);
  const lngs = centres.map(([, lo]) => lo);
  const span = km([Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]);
  if (span <= FAR_SPAN_KM) return { kept: runs, hidden: 0 };
  const kept = runs.filter((_, i) => km(centres[i], mid) <= FAR_KM);
  return kept.length ? { kept, hidden: runs.length - kept.length } : { kept: runs, hidden: 0 };
}

const HEAT_OPACITY = 0.35;

// Kolor biegu: złoty kąt odcieni, więc sąsiednie biegi się różnią, a kolor zależy tylko od pozycji.
export const runColor = (i: number) => `hsl(${Math.round((i * 137.508) % 360)}, 85%, 60%)`;

// Postęp biegu przy postępie animacji P: „real” = wspólny zegar (krótsze kończą wcześniej), „together” = meta razem.
export function runProgress(P: number, movingTime: number, maxTime: number, sync: TogetherSync): number {
  if (sync === 'together' || !(movingTime > 0)) return P;
  return Math.min(1, (P * maxTime) / movingTime);
}

export function TogetherCard({
  runs,
  map,
  theme = 'dark',
  accent,
  font = DEFAULT_FONT,
  fontCss,
  colors = 'run',
  sync = 'real',
  progress = 1,
}: {
  runs: Activity[];
  map?: MapLayers; // do wczytania mapy gradient
  theme?: ThemeId;
  accent?: string;
  font?: FontId;
  fontCss?: string;
  colors?: TogetherColors;
  sync?: TogetherSync;
  progress?: number; // animacja 0..1
}) {
  const fit = useMemo(() => togetherFit(runs), [runs]);
  // Mapa liczona raz: w podglądzie animacji zmienia się tylko postęp, więc React pomija całe drzewo mapy.
  const out = useMemo(() => (fit && map ? THEMES[theme].render(map, { accent }) : null), [fit, map, theme, accent]);
  const mapBackground = useMemo(() => out && <rect width={1080} height={1920} fill={THEMES[theme].style({ accent }).background} />, [out, theme, accent]);
  const text = out?.text ?? { color: '#ffffff' };
  const { weight, scale } = FONTS[font];
  const heat = colors === 'heat';
  const heatColor = out?.route.stroke ?? '#ffffff';
  const maxTime = Math.max(...runs.map((r) => r.moving_time));
  const dates = runs.map((r) => r.start_date_local).sort();
  const total = runs.reduce((acc, r) => ({ distance: acc.distance + r.distance, time: acc.time + r.moving_time }), { distance: 0, time: 0 });
  const range = dates.length ? `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}` : '';
  const color = (i: number) => (heat ? heatColor : runColor(i));
  const p = (r: Activity) => runProgress(progress, r.moving_time, maxTime, sync);

  return (
    <svg className="postcard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" fontFamily={fontStack(font)} fontWeight={weight}>
      {fontCss && <style>{fontCss}</style>}
      {!out && <Background />}
      {mapBackground}
      {out?.scene}
      {out?.overlay}
      <g filter={out?.route.filter}>
        {fit?.routes.map(
          (route, i) =>
            route && (
              <g key={runs[i].id} opacity={heat ? HEAT_OPACITY : undefined}>
                <Route d={route.d} points={route.points} stroke={color(i)} width={8} progress={p(runs[i])} />
              </g>
            ),
        )}
      </g>
      <g color={text.color} filter={text.filter}>
        <SlotNumber x={190} y={220} size={110 * scale} scale={scale} label="RUNS" value={String(runs.length)} />
        <SlotNumber x={540} y={220} size={110 * scale} scale={scale} label="KM" value={formatDistanceKm(total.distance)} />
        <SlotNumber x={890} y={220} size={90 * scale} scale={scale} label="TIME" value={formatDuration(total.time)} />
        <text x={540} y={380} fontSize={40 * scale} textAnchor="middle" fill="currentColor" opacity={0.8}>
          {range}
        </text>
      </g>
      <StravaMark x={60} y={1820} variant={out?.mark} />
      {out && (
        <text
          transform="translate(1056 1890) rotate(-90)"
          fontSize={18}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          fill={text.color}
          opacity={0.6}
        >
          {MAP_ATTRIBUTION}
        </text>
      )}
    </svg>
  );
}
