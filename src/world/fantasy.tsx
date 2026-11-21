import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { FILTER_AREA, Grain, Overlay, Vignette } from '../postcard/themes/texture';
import { center, corners, houseIcons, landmarks, shipIcons } from './icons';
import { box, parseLines, poly } from './geom';
import type { Pt } from './grid';

const INK = '#3a2412';
const PAPER = '#e3cf9f';
const WALL = '#f1e4c2';
const STONE = '#d6c6a0';
const ROOF = '#b5442f';
const SAIL = '#f6ecd0';
const HULL = '#7a4a26';
const SERPENT = '#55704a';

// Ilustrowana mapa na pergaminie: prawdziwy szkielet mapy, lasy i pola jako wzory, woda z falami i statkami,
// domki i zamki zamiast obrysów, ramka, róża wiatrów i wąż morski w górnych rogach; trasa malowana z drżącym konturem.
// Tylko widok płaski (Genre.flat); ulice bez filtrów (wydajność).
const STYLE: MapStyle = {
  background: PAPER,
  colors: {
    field: '#e2cf7c',
    landuse: '#d9cf96',
    industrial: '#d6c391',
    civic: '#e0c99a',
    water: '#6fa3a8',
    waterway: '#5f949a',
    green: '#a9c77e',
    sport: '#cbd38f',
    building: '#cdb98a', // obrysy nierysowane: domki zamiast nich
    tunnel: '#4a2f1a',
    rail: INK,
    runway: '#d8c690',
    path: '#8a6a44',
    bridge: '#5a3a20',
    minor: '#b0936a',
    mid: '#6b4a2a',
    major: '#6b4a2a', // trasa rysowana osobno
  },
  widths: { water: 4, green: 4, waterway: 3, path: 1.2, minor: 1.6, mid: 2.6, major: 2.6, rail: 1.6, tunnel: 1.4, bridge: 4, runway: 5 },
  dashes: { path: '1 4', rail: '6 4', tunnel: '4 4' },
  fills: {
    water: 'url(#world-fantasy-waves)',
    green: 'url(#world-fantasy-trees)',
    field: 'url(#world-fantasy-field)',
    landuse: 'url(#world-fantasy-meadow)',
    sport: 'url(#world-fantasy-meadow)',
  },
  outlines: { water: INK, green: INK },
};

// Domek 26×22: ściany, drzwi, dach.
const WALLS = box(-10, -2, 10, 11);
const DOOR = box(-2.5, 4, 2.5, 11);
const ROOF_TRI: Pt[] = [[-13, -1], [0, -11], [13, -1]];

// Zamek ok. 64×56: mur z blankami, dwie wieże, donżon; dachy wież i chorągiew.
const crenels = (x0: number, x1: number, y: number): Pt[] => {
  const out: Pt[] = [];
  for (let x = x0; x < x1; x += 8) out.push([x, y], [x, y - 5], [x + 4, y - 5], [x + 4, y]);
  return [...out, [x1, y]];
};
const CASTLE_STONE: Pt[][] = [
  [[-22, 28], ...crenels(-22, 22, -2), [22, 28]],
  box(-32, -10, -18, 28),
  box(18, -10, 32, 28),
  box(-9, -16, 9, 28),
];
const CASTLE_ROOFS: Pt[][] = [
  [[-34, -10], [-25, -26], [-16, -10]],
  [[16, -10], [25, -26], [34, -10]],
  [[-11, -16], [0, -30], [11, -16]],
];
const CASTLE_INK: Pt[][] = [
  [[-5, 28], [-5, 19], [-3, 16], [3, 16], [5, 19], [5, 28]], // brama
  box(-27, 0, -23, 6),
  box(23, 0, 27, 6),
  box(-2, -8, 2, -2),
  box(-0.8, -40, 0.8, -30), // maszt chorągwi
];
const FLAG: Pt[] = [[0.8, -40], [12, -37], [0.8, -34]];

// Statek ok. 70 px: kadłub, maszt, dwa żagle.
const HULL_PTS: Pt[] = [[-35, 0], [35, 0], [28, 8], [16, 12], [-20, 12], [-30, 7]];
const SAILS: Pt[][] = [
  [[-4, -4], [-4, -42], [-26, -4]],
  [[4, -6], [4, -36], [24, -6]],
];
const MAST = box(-1.5, -46, 1.5, 0);

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  const shown = layers.building ? layers.buildings : undefined;
  const castleSet = landmarks(shown);
  const castles = castleSet.map((b) => center(b).map(Math.round) as Pt);
  const houses = houseIcons(shown, castleSet, ROOF);
  const ships = shipIcons(layers.water, parseLines(layers.major)[0] ?? []);
  const roofs = new Map<string, string>();
  for (const h of houses) roofs.set(h.roof, (roofs.get(h.roof) ?? '') + poly(ROOF_TRI, h.x, h.y));
  const all = (shapes: Pt[][], at: Pt[]) => at.map(([x, y]) => shapes.map((s) => poly(s, x, y)).join('')).join('');
  const sail = (parts: Pt[][]) => ships.map((s) => parts.map((p) => poly(p, s.x, s.y, s.angle)).join('')).join('');
  const ink = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const };
  return (
    <>
      <MapBackground layers={{ ...layers, building: undefined, major: undefined }} style={STYLE} rect={rect} />
      {houses.length > 0 && (
        <>
          <path d={houses.map((h) => poly(WALLS, h.x, h.y)).join('')} fill={WALL} {...ink} />
          <path d={houses.map((h) => poly(DOOR, h.x, h.y)).join('')} fill={INK} />
          {[...roofs].map(([color, d]) => (
            <path key={color} d={d} fill={color} {...ink} />
          ))}
        </>
      )}
      {castles.length > 0 && (
        <>
          <path d={all(CASTLE_STONE, castles)} fill={STONE} {...ink} />
          <path d={all(CASTLE_ROOFS, castles)} fill={ROOF} {...ink} />
          <path d={all(CASTLE_INK, castles)} fill={INK} />
          <path d={all([FLAG], castles)} fill={ROOF} {...ink} strokeWidth={1} />
        </>
      )}
      {ships.length > 0 && (
        <>
          <path d={sail([HULL_PTS])} fill={HULL} {...ink} />
          <path d={sail([MAST])} fill={INK} />
          <path d={sail(SAILS)} fill={SAIL} {...ink} />
        </>
      )}
    </>
  );
}

// Róża wiatrów: 4 długie i 4 krótkie ramiona, każde z połową ciemną i jasną, litera N jako kreska.
function Compass({ at: [cx, cy] }: { at: Pt }) {
  const dark: string[] = [];
  const light: string[] = [];
  for (let k = 0; k < 8; k++) {
    const angle = k * 45 - 90;
    const [len, w] = k % 2 ? [34, 8] : [56, 11];
    dark.push(poly([[0, 0], [len, 0], [w * 0.7, -w * 0.7]], cx, cy, angle));
    light.push(poly([[0, 0], [len, 0], [w * 0.7, w * 0.7]], cx, cy, angle));
  }
  return (
    <g stroke={INK} strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={52} fill={PAPER} fillOpacity={0.6} strokeWidth={2} />
      <circle cx={cx} cy={cy} r={45} fill="none" strokeWidth={1} strokeDasharray="2 4" />
      <path d={light.join('')} fill={WALL} strokeWidth={1.2} />
      <path d={dark.join('')} fill={INK} strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={4} fill={ROOF} strokeWidth={1.2} />
      <path d={`M${cx - 6} ${cy - 62}V${cy - 74}L${cx + 6} ${cy - 62}V${cy - 74}`} fill="none" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

// Wąż morski: trzy garby nad falami, płetwa ogona i głowa z otwartą paszczą (ok. 160×75 po skali 0,8).
function Serpent({ at: [cx, cy] }: { at: Pt }) {
  return (
    <g transform={`translate(${cx} ${cy + 8}) scale(0.8)`} stroke={INK} strokeLinejoin="round" strokeLinecap="round">
      <path
        d={
          'M-100 20C-112 10 -112 -4 -102 -9C-105 2 -101 11 -90 18Z' +
          'M-92 20C-92 -12 -62 -12 -62 20L-71 20C-71 1 -83 1 -83 20Z' +
          'M-48 20C-48 -28 -8 -28 -8 20L-19 20C-19 -12 -37 -12 -37 20Z' +
          'M6 20C6 -26 22 -52 48 -54L70 -46L74 -37L56 -35L68 -27L50 -26C36 -26 28 -10 18 20Z'
        }
        fill={SERPENT}
        strokeWidth={2}
      />
      <path d="M-82 -6L-77 -16L-72 -6ZM-38 -16L-32 -28L-26 -16ZM-24 -14L-17 -25L-12 -11ZM14 -18L14 -32L24 -24Z" fill={ROOF} strokeWidth={1.2} />
      <circle cx={52} cy={-45} r={3} fill={WALL} strokeWidth={1} />
      <path d="M-118 24q10 -7 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" strokeWidth={2} />
      <path d="M-104 36q8 -5 16 0t16 0M-20 36q8 -5 16 0t16 0M50 36q8 -5 16 0t16 0" fill="none" strokeWidth={1.4} />
    </g>
  );
}

// Podwójna ramka z rombami w rogach; prawy bok poza pionowym podpisem OSM (x 1038–1056), dolny pod znakiem Stravy.
function Frame() {
  const knots: Pt[] = [[14, 14], [1066, 14], [14, 1906], [1066, 1906]];
  return (
    <g fill="none" stroke={INK}>
      <rect x={8} y={8} width={1064} height={1904} strokeWidth={4} />
      <rect x={20} y={20} width={1040} height={1880} strokeWidth={1.5} />
      <path d={knots.map(([x, y]) => poly([[0, -6], [6, 0], [0, 6], [-6, 0]], x, y)).join('')} fill={INK} stroke="none" />
    </g>
  );
}

const TREES =
  'M18 8L27 28H9Z' + 'M42 50L51 70H33Z' + 'M14 66L22 84H6Z' + 'M74 74L82 90H66Z';
const TRUNKS = 'M17 28h2v4h-2ZM41 70h2v4h-2ZM13 84h2v4h-2ZM73 90h2v4h-2ZM63 34h2v6h-2ZM83 52h2v5h-2Z';

export const fantasy: MapTheme = {
  label: 'Fantasy',
  font: 'pirata',
  style: () => STYLE,
  floor,
  render: (layers) => {
    const [compass, serpent] = corners(parseLines(layers.major)[0] ?? []);
    return {
      scene: (
        <>
          <defs>
            <pattern id="world-fantasy-trees" patternUnits="userSpaceOnUse" width={96} height={96}>
              <rect width={96} height={96} fill={STYLE.colors.green} />
              <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
                <path d={TRUNKS} fill={INK} stroke="none" />
                <path d={TREES} fill="#5f8a4a" />
                <circle cx={64} cy={26} r={9} fill="#7fa65a" />
                <circle cx={84} cy={45} r={8} fill="#7fa65a" />
              </g>
            </pattern>
            <pattern id="world-fantasy-waves" patternUnits="userSpaceOnUse" width={48} height={32}>
              <rect width={48} height={32} fill={STYLE.colors.water} />
              <path d="M6 12q6 -6 12 0M30 28q6 -6 12 0" fill="none" stroke="#3f6f78" strokeWidth={1.4} strokeLinecap="round" opacity={0.75} />
            </pattern>
            <pattern id="world-fantasy-field" patternUnits="userSpaceOnUse" width={24} height={24} patternTransform="rotate(30)">
              <rect width={24} height={24} fill={STYLE.colors.field} />
              <path d="M0 6H24M0 18H24" stroke="#b39a4a" strokeWidth={1.4} opacity={0.6} />
            </pattern>
            <pattern id="world-fantasy-meadow" patternUnits="userSpaceOnUse" width={32} height={32}>
              <rect width={32} height={32} fill={STYLE.colors.sport} />
              <path d="M6 14l2 -6M10 14v-7M14 14l-2 -6M22 30l2 -6M26 30v-7M30 30l-2 -6" stroke="#7a8a3e" strokeWidth={1.2} strokeLinecap="round" />
            </pattern>
            {/* Trasa jak malowana tuszem: drżenie i kontur w jednym filtrze. */}
            <filter id="world-fantasy-route" {...FILTER_AREA} colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={0.04} numOctaves={2} seed={5} result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={3} xChannelSelector="R" yChannelSelector="G" result="wobble" />
              <feMorphology in="wobble" operator="dilate" radius={2.5} result="wide" />
              <feFlood floodColor={INK} />
              <feComposite operator="in" in2="wide" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="wobble" />
              </feMerge>
            </filter>
            <Vignette id="world-fantasy-vignette" color={INK} opacity={0.5} />
            <Grain id="world-fantasy-grain" color="#5a3a1a" frequency={0.9} slope={0.25} offset={-0.05} />
          </defs>
          {floor(layers)}
        </>
      ),
      overlay: (
        <>
          <Overlay fill="url(#world-fantasy-vignette)" />
          <Overlay filter="url(#world-fantasy-grain)" />
          <Frame />
          <Compass at={compass} />
          <Serpent at={serpent} />
        </>
      ),
      route: { stroke: '#e0502a', width: 16, filter: 'url(#world-fantasy-route)' },
      text: { color: INK },
      mark: 'black',
    };
  },
};
