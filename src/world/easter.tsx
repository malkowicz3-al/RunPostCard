import type { MapStyle } from '../postcard/mapStyle';
import { holidayTheme, DASHES, WIDTHS, dot, oval, paint } from './holiday';
import { poly } from './geom';
import type { Pt } from './grid';

const INK = '#6a4a7a';
const EGGS = ['#f4a6c0', '#a8d8f0', '#ffd27a', '#c9b3ec'];
const STEM = '#5fa35a';

// Wiosna w pastelach: miętowa ziemia, maślane pola, liliowe tereny, pisanki w parkach, tulipany na boiskach,
// pastelowe dachy domków, duże jajka i zajączki na punktach orientacyjnych; fioletowa trasa z białym konturem.
const STYLE: MapStyle = {
  background: '#dff3e3',
  colors: {
    field: '#fff3b0',
    landuse: '#e6f1d8',
    industrial: '#e6dcf5',
    civic: '#fbe3ea',
    water: '#9fd3e6',
    waterway: '#9fd3e6',
    green: '#c4e6b0',
    sport: '#d2eec0',
    building: '#fbeee0',
    tunnel: '#a8b4a8',
    rail: '#9aa79a',
    runway: '#ffffff',
    path: '#f6fbf2',
    bridge: '#ffffff',
    minor: '#ffffff',
    mid: '#fff9e0',
    major: '#ffffff', // ulica trasy rysowana osobno
  },
  widths: WIDTHS,
  dashes: DASHES,
  fills: { green: 'url(#world-easter-eggs)', sport: 'url(#world-easter-tulips)' },
  outlines: { water: '#7fb8cf', building: '#d9b8a6' },
  buildings3d: 'gabled',
};

const ROOF: Pt[] = [[-17, -4], [0, -18], [17, -4]];
// Pas zygzaka przez środek jajka (rx, ry).
const zigzag = (x: number, y: number, rx: number) => {
  const n = 6;
  const pts: Pt[] = Array.from({ length: n + 1 }, (_, k) => [-rx + (2 * rx * k) / n, k % 2 ? -rx * 0.18 : rx * 0.18]);
  return poly([...pts, ...pts.slice().reverse().map(([px, py]): Pt => [px, py + rx * 0.3])], x, y);
};
// Tulipan: łodyga (kreska), liść, kielich z trzema płatkami; t = rozmiar.
const cup = (x: number, y: number, t: number) =>
  `M${x - t} ${y - t * 2.4}L${x - t * 0.5} ${y - t * 1.8}L${x} ${y - t * 2.6}L${x + t * 0.5} ${y - t * 1.8}L${x + t} ${y - t * 2.4}Q${x + t} ${y - t * 0.6} ${x} ${y - t * 0.5}Q${x - t} ${y - t * 0.6} ${x - t} ${y - t * 2.4}Z`;
const stem = (x: number, y: number, t: number) => `M${x} ${y - t * 0.6}L${x} ${y + t * 2.6}M${x} ${y + t * 1.8}Q${x + t * 1.2} ${y + t * 1.4} ${x + t * 1.2} ${y + t * 0.4}`;

function Egg({ x, y, rx, ry, color, outline = 1.5 }: { x: number; y: number; rx: number; ry: number; color: string; outline?: number }) {
  return (
    <>
      <path d={oval(x, y, rx, ry)} fill={color} stroke={INK} strokeWidth={outline} />
      <path d={zigzag(x, y - rx * 0.15, rx * 0.85)} fill="#ffffff" />
    </>
  );
}

export const easter = holidayTheme({
  id: 'easter',
  label: 'Easter',
  font: 'sniglet',
  style: STYLE,
  casing: '#b9cdb9',
  route: { stroke: '#7b2cbf', outline: '#ffffff' },
  text: '#4a2a6a',
  halo: '#ffffff',
  mark: 'black',
  defs: (
    <>
      <pattern id="world-easter-eggs" patternUnits="userSpaceOnUse" width={80} height={80}>
        <rect width={80} height={80} fill={STYLE.colors.green} />
        <path d="M8 30l2 -6M12 30v-7M16 30l-2 -6M48 70l2 -6M52 70v-7M56 70l-2 -6" stroke={STEM} strokeWidth={1.4} strokeLinecap="round" />
        <g stroke={INK} strokeWidth={1}>
          <path d={oval(30, 18, 8, 11)} fill={EGGS[0]} />
          <path d={oval(64, 34, 8, 11)} fill={EGGS[1]} />
          <path d={oval(22, 58, 8, 11)} fill={EGGS[2]} />
        </g>
      </pattern>
      <pattern id="world-easter-tulips" patternUnits="userSpaceOnUse" width={64} height={64}>
        <rect width={64} height={64} fill={STYLE.colors.sport} />
        <path d={stem(14, 20, 6) + stem(44, 46, 6)} fill="none" stroke={STEM} strokeWidth={2} strokeLinecap="round" />
        <path d={cup(14, 20, 6)} fill="#ef5f8a" />
        <path d={cup(44, 46, 6)} fill="#ffb347" />
      </pattern>
    </>
  ),
  decor: ({ houses, marks }) => {
    const ink = { stroke: INK, strokeWidth: 1.2, strokeLinejoin: 'round' as const };
    const bunnies = marks.filter((_, i) => i % 2 === 1);
    return (
      <>
        {paint(houses.map((h) => [h.roof, poly(ROOF, h.x, h.y)]), ink)}
        {marks.map(([x, y], i) => i % 2 === 0 && <Egg key={`${x}:${y}`} x={x} y={y} rx={32} ry={42} color={EGGS[(i / 2) % 4]} outline={2} />)}
        {bunnies.length > 0 && (
          <>
            <path d={bunnies.map(([x, y]) => oval(x - 10, y - 30, 8, 22) + oval(x + 10, y - 30, 8, 22) + dot(x, y + 6, 24)).join('')} fill="#ffffff" {...ink} strokeWidth={2} />
            <path d={bunnies.map(([x, y]) => oval(x - 10, y - 30, 3.5, 14) + oval(x + 10, y - 30, 3.5, 14) + dot(x, y + 13, 3.6)).join('')} fill={EGGS[0]} />
            <path d={bunnies.map(([x, y]) => dot(x - 8, y + 1, 3) + dot(x + 8, y + 1, 3)).join('')} fill={INK} />
          </>
        )}
      </>
    );
  },
  overlay: ([ax, ay], [bx, by]) => {
    const tulips: [number, number, string][] = [[bx - 70, by, '#ef5f8a'], [bx - 15, by - 2, '#ffb347'], [bx + 38, by, '#c77dff']];
    return (
      <>
        <Egg x={ax} y={ay - 12} rx={46} ry={60} color={EGGS[3]} outline={3} />
        <path d={dot(ax - 21, ay + 26, 4.5) + dot(ax, ay + 33, 4.5) + dot(ax + 21, ay + 26, 4.5)} fill={EGGS[0]} />
        <path d={tulips.map(([x, y]) => stem(x, y, 13)).join('')} fill="none" stroke={STEM} strokeWidth={4} strokeLinecap="round" />
        {paint(tulips.map(([x, y, c]): [string, string] => [c, cup(x, y, 13)]), { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' })}
      </>
    );
  },
});
