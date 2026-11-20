import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import { mix } from '../lib/color';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { Building, MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Glow } from '../postcard/themes/neon';
import { Overlay } from '../postcard/themes/texture';

const LINES = 'url(#world-scifi-lines)';
const ROAD = '#120a2a';
const CURB = '#2ef2ff';

// Miasto przyszłości nocą w stylu cyberpunk: fiolet i granat, ulice magenta i cyjan z poświatą, neonowe obrysy brył,
// różowo-cyjanowa mgła, ciepła żółta trasa po ulicy z neonowymi krawężnikami; szczegóły przygaszone.
const STYLE: MapStyle = {
  background: '#0a0620',
  colors: {
    field: '#0c0726',
    landuse: '#0e082b',
    industrial: '#140b36',
    civic: '#120a31',
    water: '#04021a',
    waterway: '#123a7a',
    green: '#0a1f33',
    sport: '#0a2440',
    building: '#1b1145',
    tunnel: '#14306a',
    rail: '#183872',
    runway: '#1d4a8a', // lądowiska: przygaszony błękit, kontrast z trasą
    path: '#1f5c9a',
    bridge: '#0a0620',
    minor: '#b03cff',
    mid: '#2ef2ff',
    major: ROAD, // ulica trasy rysowana osobno
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 4 },
  dashes: { rail: '10 6', tunnel: '4 4', runway: '14 8' },
  filters: { mid: LINES },
  buildings3d: 'tower',
};

// Bryły świata w widoku płaskim: jedna ścieżka na kolor neonu (bez neonu: kolor budynków), zamiast warstwy building.
function outlines(buildings: Building[] = []): Map<string, string> {
  const out = new Map<string, string>();
  for (const { ring, accent = STYLE.colors.building } of buildings)
    out.set(accent, (out.get(accent) ?? '') + `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
  return out;
}

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  return (
    <>
      {/* building i major rysujemy niżej (obrysy z neonem, ulica trasy), więc każdy kształt tylko raz. */}
      <MapBackground layers={{ ...layers, building: layers.buildings ? undefined : layers.building, major: undefined }} style={STYLE} rect={rect} />
      {/* Jedna poświata na krawężnik i obrysy; asfalt po niej, więc z krawężnika zostają dwie linie. */}
      <g filter={LINES} strokeLinejoin="round" strokeLinecap="round">
        {layers.major && <path d={layers.major} fill="none" stroke={CURB} strokeWidth={34} opacity={0.7} />}
        {/* W 3D Postcard zdejmuje building z podłogi (bryły stoją same), więc i bez płaskich obrysów. */}
        {[...outlines(layers.building ? layers.buildings : undefined)].map(([color, d]) => (
          <path key={color} d={d} stroke={color} strokeWidth={1.5} fill={mix(color, STYLE.colors.building, 0.88)} />
        ))}
      </g>
      {layers.major && <path d={layers.major} fill="none" stroke={ROAD} strokeWidth={28} strokeLinejoin="round" strokeLinecap="round" />}
    </>
  );
}

export const scifi: MapTheme = {
  label: 'Sci-fi',
  font: 'orbitron',
  style: () => STYLE,
  floor,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="world-scifi-grid" patternUnits="userSpaceOnUse" width={48} height={48}>
            <path d="M0 0.5H48M0.5 0V48" stroke="#2ef2ff" strokeWidth={1} opacity={0.06} />
          </pattern>
          <linearGradient id="world-scifi-haze" x1={0} y1={0} x2={0} y2={1}>
            <stop offset={0} stopColor="#ff2bd6" stopOpacity={0.22} />
            <stop offset={0.5} stopColor="#a45bff" stopOpacity={0} />
            <stop offset={1} stopColor="#2ef2ff" stopOpacity={0.18} />
          </linearGradient>
          <Glow id="world-scifi-lines" blur={2.5} strong={false} />
          <Glow id="world-scifi-route" blur={8} />
        </defs>
        {floor(layers)}
      </>
    ),
    overlay: (
      <>
        <Overlay fill="url(#world-scifi-haze)" />
        <Overlay fill="url(#world-scifi-grid)" />
      </>
    ),
    route: { stroke: '#ffe23f', width: 11, filter: 'url(#world-scifi-route)' },
    text: { color: '#c8fbff' },
    mark: 'white',
  }),
};
