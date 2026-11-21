import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { FILTER_AREA, Grain, Overlay, Vignette } from '../postcard/themes/texture';
import { box, parseLines, poly } from './geom';
import type { Pt } from './grid';
import { center, corners, houseIcons, landmarks } from './icons';

const INK = '#1b140e';
const DUST = '#cdb98c';
const RUST = '#7a3b24';
const RUBBLE = '#8f826a';
const CLOUD = '#ecd3a0';
const EMBER = '#d9772e';
const HAZARD = '#e8b923';
const SLUDGE = '#9fd23a';

// Ilustrowana mapa po katastrofie na prawdziwym szkielecie: zakurzona ochra, trująca woda, martwe lasy, popękane pola
// z kraterami, ruiny zamiast obrysów brył, grzyby atomowe na punktach orientacyjnych, ramka w ostrzegawcze pasy,
// znak promieniowania i tablica z czaszką w górnych rogach. Tylko widok płaski (Genre.flat); ulice bez filtrów.
const STYLE: MapStyle = {
  background: DUST,
  colors: {
    field: '#d8c48e',
    landuse: '#cbbb8a',
    industrial: '#c4b48c',
    civic: '#d4c09a',
    water: '#7d8a6a',
    waterway: '#6d7a5a',
    green: '#8a8a5a',
    sport: '#c9bf8a',
    building: '#a8956a', // obrysy nierysowane: ruiny zamiast nich
    tunnel: INK,
    rail: '#2b2118',
    runway: '#d9cfae',
    path: '#6b5a40',
    bridge: '#3a2e22',
    minor: '#5a4a36',
    mid: '#3e3428',
    major: '#3e3428', // trasa rysowana osobno
  },
  widths: { water: 4, green: 4, waterway: 3, path: 1.2, minor: 2, mid: 3.4, major: 3.4, rail: 1.6, tunnel: 1.4, bridge: 4, runway: 5 },
  // Popękany asfalt: przerywane ulice.
  dashes: { path: '1 4', minor: '9 4', mid: '16 5', rail: '6 4', tunnel: '4 4' },
  fills: {
    water: 'url(#world-postapo-water)',
    green: 'url(#world-postapo-dead)',
    field: 'url(#world-postapo-field)',
    landuse: 'url(#world-postapo-scrub)',
    sport: 'url(#world-postapo-scrub)',
  },
  outlines: { water: INK, green: INK },
};

// Ruina ok. 24×22: ściana z wyszczerbionym szczytem, ciemne otwory (okno, wyrwa), gruz u stóp.
const WALL: Pt[] = [[-11, 11], [-11, -5], [-8, -8], [-6, -3], [-3, -10], [0, -6], [3, -11], [5, -4], [8, -7], [11, -2], [11, 11]];
const HOLES: Pt[][] = [box(-7, -1, -3, 4), [[1, 11], [1, 3], [4, 0], [7, 4], [7, 11]]];
const RUBBLE_PTS: Pt[][] = [[[-16, 11], [-14, 7], [-11, 9], [-11, 11]], [[11, 11], [11, 6], [15, 8], [17, 11]], [[13, 5], [15, 3], [17, 5]]];

// Grzyb atomowy ok. 64×56 nad punktem orientacyjnym: kapelusz z falistym spodem, trzon, kołnierz i kurz u podstawy;
// żar pod kapeluszem i w trzonie. Ścieżki względne, więc wystarczy przesunąć M.
const cloud = (x: number, y: number) =>
  `M${x - 28} ${y - 6}a8 8 0 0 1 6 -12a10 10 0 0 1 14 -10a10 10 0 0 1 16 0a10 10 0 0 1 14 10a8 8 0 0 1 6 12` +
  `q-7 6 -14 0t-14 0t-14 0t-14 0Z` +
  `M${x - 7} ${y - 3}c2 10 0 20 -6 29h26c-6 -9 -8 -19 -6 -29Z` +
  `M${x - 16} ${y + 8}q16 -7 32 0q-16 6 -32 0Z` +
  `M${x - 32} ${y + 28}q6 -10 16 -8q8 -8 16 -2q8 -6 16 2q10 -2 16 8Z`;
const embers = (x: number, y: number) => `M${x - 20} ${y - 7}q20 7 40 0q-20 4 -40 0Z` + `M${x - 2} ${y}q1 12 -2 24h4q-3 -12 -2 -24Z`;

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  const shown = layers.building ? layers.buildings : undefined;
  const lm = landmarks(shown);
  const clouds = lm.map((b) => center(b).map(Math.round) as Pt);
  const ruins = houseIcons(shown, lm, RUST);
  const walls = new Map<string, string>();
  for (const r of ruins) walls.set(r.roof, (walls.get(r.roof) ?? '') + poly(WALL, r.x, r.y));
  const all = (shapes: Pt[][]) => ruins.map((r) => shapes.map((s) => poly(s, r.x, r.y)).join('')).join('');
  const ink = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const };
  return (
    <>
      <MapBackground layers={{ ...layers, building: undefined, major: undefined }} style={STYLE} rect={rect} />
      {ruins.length > 0 && (
        <>
          <path d={all(RUBBLE_PTS)} fill={RUBBLE} {...ink} strokeWidth={1} />
          {[...walls].map(([color, d]) => (
            <path key={color} d={d} fill={color} {...ink} />
          ))}
          <path d={all(HOLES)} fill={INK} />
        </>
      )}
      {clouds.length > 0 && (
        <>
          <path d={clouds.map(([x, y]) => cloud(x, y)).join('')} fill={CLOUD} {...ink} strokeWidth={1.6} />
          <path d={clouds.map(([x, y]) => embers(x, y)).join('')} fill={EMBER} />
        </>
      )}
    </>
  );
}

// Znak promieniowania w kole (promień TREFOIL_R) i tablica ostrzegawcza z czaszką i beczką (zasięg SIGN względem
// środka rogu); oba mieszczą się w COMPASS_BOX i SERPENT_BOX z icons.ts (test kolizji ze statystykami).
export const TREFOIL_R = 52;
export const SIGN = [-62, -34, 58, 38];

function Trefoil({ at: [cx, cy] }: { at: Pt }) {
  const p = (r: number, deg: number) => `${Math.round((cx + r * Math.cos((deg * Math.PI) / 180)) * 10) / 10} ${Math.round((cy + r * Math.sin((deg * Math.PI) / 180)) * 10) / 10}`;
  const blades = [-150, -30, 90]
    .map((a) => `M${p(12, a - 30)}L${p(42, a - 30)}A42 42 0 0 1 ${p(42, a + 30)}L${p(12, a + 30)}A12 12 0 0 0 ${p(12, a - 30)}Z`)
    .join('');
  return (
    <g stroke={INK} strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={TREFOIL_R - 1.5} fill={HAZARD} strokeWidth={3} />
      <circle cx={cx} cy={cy} r={TREFOIL_R - 7} fill="none" strokeWidth={1} strokeDasharray="3 4" />
      <path d={blades + `M${cx + 7} ${cy}a7 7 0 1 1 -14 0a7 7 0 1 1 14 0Z`} fill={INK} stroke="none" />
    </g>
  );
}

function Warning({ at: [cx, cy] }: { at: Pt }) {
  const [x, y] = [cx - 20, cy + 6]; // środek czaszki
  return (
    <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
      <path d={`M${cx - 20} ${cy - 32}L${cx + 20} ${cy + 34}H${cx - 60}Z`} fill={HAZARD} strokeWidth={4} />
      <path d={`M${x - 16} ${y + 9}L${x + 16} ${y + 22}M${x + 16} ${y + 9}L${x - 16} ${y + 22}`} strokeWidth={5} />
      <path d={`M${x - 12} ${y + 4}a12 12 0 1 1 24 0v5h-5v5h-14v-5h-5Z`} fill={INK} stroke="none" />
      <path d={`M${x - 8} ${y + 1}a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0ZM${x + 1} ${y + 1}a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0ZM${x} ${y + 5}l-2 4h4Z`} fill={HAZARD} stroke="none" />
      <path d={`M${x - 3} ${y + 10}v4M${x + 1} ${y + 10}v4M${x + 4.5} ${y + 10}v4`} stroke={HAZARD} strokeWidth={1.2} />
      {/* Beczka z wyciekiem obok tablicy. */}
      <path d={`M${cx + 30} ${cy + 4}v26a13 4 0 0 0 26 0v-26a13 4 0 0 0 -26 0Z`} fill="#5f6b3a" strokeWidth={1.6} />
      <path d={`M${cx + 30} ${cy + 13}a13 4 0 0 0 26 0M${cx + 30} ${cy + 22}a13 4 0 0 0 26 0`} fill="none" strokeWidth={1.2} />
      <path d={`M${cx + 34} ${cy + 3}q2 8 0 14q2 2 4 0q-2 -6 0 -14ZM${cx + 26} ${cy + 34}a10 3 0 0 1 20 0a10 3 0 0 1 -20 0Z`} fill={SLUDGE} strokeWidth={1} />
    </g>
  );
}

// Ramka w ostrzegawcze pasy i cienka wewnętrzna; prawy bok poza pionowym podpisem OSM (x 1038–1056), dolny pod znakiem Stravy.
function Frame() {
  return (
    <g fill="none">
      <rect x={8} y={8} width={1064} height={1904} stroke={INK} strokeWidth={12} />
      <rect x={8} y={8} width={1064} height={1904} stroke={HAZARD} strokeWidth={12} strokeDasharray="22 22" />
      <rect x={20} y={20} width={1040} height={1880} stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

const CRACKS = 'M4 20l14 6l6 14l16 4M60 0l-4 18l10 10l-2 14M70 60l18 8l6 16l20 2M10 92l16 -6l10 10l14 -2M96 30l12 10l12 -4';

export const postapo: MapTheme = {
  label: 'Post-apo',
  font: 'blackops',
  style: () => STYLE,
  floor,
  render: (layers) => {
    const [trefoil, sign] = corners(parseLines(layers.major)[0] ?? []);
    return {
      scene: (
        <>
          <defs>
            <pattern id="world-postapo-water" patternUnits="userSpaceOnUse" width={48} height={32}>
              <rect width={48} height={32} fill={STYLE.colors.water} />
              <path d="M6 12q6 -4 12 0t12 0M28 27q5 -4 10 0" fill="none" stroke="#56623f" strokeWidth={1.4} strokeLinecap="round" />
              <circle cx={38} cy={10} r={2} fill="#a6b276" />
              <circle cx={12} cy={24} r={1.4} fill="#a6b276" />
            </pattern>
            <pattern id="world-postapo-dead" patternUnits="userSpaceOnUse" width={96} height={96}>
              <rect width={96} height={96} fill={STYLE.colors.green} />
              <path
                d="M20 40V18M20 28l-7 -7M20 24l6 -8M62 72V52M62 60l-6 -5M62 57l7 -7M66 53l3 -4M78 22v-4M14 82v-3"
                fill="none"
                stroke="#3e3428"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </pattern>
            <pattern id="world-postapo-field" patternUnits="userSpaceOnUse" width={120} height={120}>
              <rect width={120} height={120} fill={STYLE.colors.field} />
              <path d={CRACKS} fill="none" stroke="#7a6848" strokeWidth={1} opacity={0.7} />
              <circle cx={84} cy={34} r={9} fill="#b29d6c" stroke="#6b5a40" strokeWidth={1.2} />
              <circle cx={30} cy={66} r={5} fill="#b29d6c" stroke="#6b5a40" strokeWidth={1} />
            </pattern>
            <pattern id="world-postapo-scrub" patternUnits="userSpaceOnUse" width={32} height={32}>
              <rect width={32} height={32} fill={STYLE.colors.landuse} />
              <path d="M6 14l-2 -5M8 14v-6M10 14l3 -4M22 30l-2 -4M24 30l3 -5" stroke="#8a7346" strokeWidth={1.1} strokeLinecap="round" />
            </pattern>
            {/* Trasa jak malowana farbą: drżenie i ciemny kontur w jednym filtrze. */}
            <filter id="world-postapo-route" {...FILTER_AREA} colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={0.05} numOctaves={2} seed={7} result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={3} xChannelSelector="R" yChannelSelector="G" result="wobble" />
              <feMorphology in="wobble" operator="dilate" radius={2.5} result="wide" />
              <feFlood floodColor="#1a1410" />
              <feComposite operator="in" in2="wide" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="wobble" />
              </feMerge>
            </filter>
            <Vignette id="world-postapo-vignette" color="#2b1d10" opacity={0.6} />
            <Grain id="world-postapo-grain" color="#3a2a18" frequency={0.9} slope={0.35} offset={-0.05} />
          </defs>
          {floor(layers)}
        </>
      ),
      overlay: (
        <>
          <Overlay fill="url(#world-postapo-vignette)" />
          <Overlay filter="url(#world-postapo-grain)" />
          <Frame />
          <Trefoil at={trefoil} />
          <Warning at={sign} />
        </>
      ),
      route: { stroke: '#d6481b', width: 16, filter: 'url(#world-postapo-route)' },
      text: { color: INK },
      mark: 'black',
    };
  },
};
