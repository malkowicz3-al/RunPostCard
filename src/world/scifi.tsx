import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import { mix, shiftHue } from '../lib/color';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Glow } from '../postcard/themes/neon';
import { Overlay } from '../postcard/themes/texture';
import type { Variant } from './genres';
import { outlines } from './outlines';

const LINES = 'url(#world-scifi-lines)';

// Warianty koloru: obrót odcienia całej palety (liczony raz, nie filtr); trasa w kolorze odcinającym się od palety.
export const SCIFI_VARIANTS: Variant[] = [
  { id: 'violet', label: 'Violet', swatch: '#a45bff', hue: 0, route: '#ffe23f' },
  { id: 'crimson', label: 'Crimson', swatch: '#ff2a3d', hue: 100, route: '#ffe23f' },
  { id: 'toxic', label: 'Toxic', swatch: '#39ff6a', hue: -115, route: '#ff8ae0' },
  { id: 'ice', label: 'Ice', swatch: '#2ea8ff', hue: -35, route: '#ffe23f' },
  { id: 'gold', label: 'Gold', swatch: '#ffc21f', hue: 145, route: '#3fd8ff' },
];

// Miasto przyszłości nocą w stylu cyberpunk: fiolet i granat, ulice magenta i cyjan z poświatą, neonowe obrysy brył,
// różowo-cyjanowa mgła, ciepła żółta trasa po ulicy z neonowymi krawężnikami; szczegóły przygaszone.
export function scifiTheme(variant?: Variant): MapTheme {
  const hue = variant?.hue ?? 0;
  const h = (c: string) => (hue ? shiftHue(c, hue) : c);
  const ROAD = h('#120a2a');
  const CURB = h('#2ef2ff');
  const STYLE: MapStyle = {
    background: h('#0a0620'),
    colors: {
      field: h('#0c0726'),
      landuse: h('#0e082b'),
      industrial: h('#140b36'),
      civic: h('#120a31'),
      water: h('#04021a'),
      waterway: h('#123a7a'),
      green: h('#0a1f33'),
      sport: h('#0a2440'),
      building: h('#1b1145'),
      tunnel: h('#14306a'),
      rail: h('#183872'),
      runway: h('#1d4a8a'), // lądowiska: przygaszony błękit, kontrast z trasą
      path: h('#1f5c9a'),
      bridge: h('#0a0620'),
      minor: h('#b03cff'),
      mid: CURB,
      major: ROAD, // ulica trasy rysowana osobno
    },
    widths: { waterway: 1.5, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 4 },
    dashes: { rail: '10 6', tunnel: '4 4', runway: '14 8' },
    filters: { mid: LINES },
    buildings3d: 'tower',
  };

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
          {[...outlines(layers.building ? layers.buildings : undefined, STYLE.colors.building)].map(([color, d]) => (
            <path key={color} d={d} stroke={color} strokeWidth={1.5} fill={mix(color, STYLE.colors.building, 0.88)} />
          ))}
        </g>
        {layers.major && <path d={layers.major} fill="none" stroke={ROAD} strokeWidth={28} strokeLinejoin="round" strokeLinecap="round" />}
      </>
    );
  }

  return {
    label: 'Sci-fi',
    font: 'orbitron',
    style: () => STYLE,
    floor,
    render: (layers) => ({
      scene: (
        <>
          <defs>
            <pattern id="world-scifi-grid" patternUnits="userSpaceOnUse" width={48} height={48}>
              <path d="M0 0.5H48M0.5 0V48" stroke={CURB} strokeWidth={1} opacity={0.06} />
            </pattern>
            <linearGradient id="world-scifi-haze" x1={0} y1={0} x2={0} y2={1}>
              <stop offset={0} stopColor={h('#ff2bd6')} stopOpacity={0.22} />
              <stop offset={0.5} stopColor={h('#a45bff')} stopOpacity={0} />
              <stop offset={1} stopColor={CURB} stopOpacity={0.18} />
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
      route: { stroke: variant?.route ?? '#ffe23f', width: 11, filter: 'url(#world-scifi-route)' },
      text: { color: h('#c8fbff') },
      mark: 'white',
    }),
  };
}

export const scifi = scifiTheme();
