import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Outline } from '../postcard/themes/texture';

const CASING = '#b9c0cb';

// Jasne miasto jak z zabawki w słoneczny dzień: szara ziemia, turkusowa woda, zielone parki, błękitne bryły z obrysem,
// ulice z jasnym obrzeżem; ulica trasy najszersza, różowa trasa z białym konturem. Szczegóły jasne albo ciemne
// (kontrast z trasą), bez pojazdów i szyldów.
const STYLE: MapStyle = {
  background: '#d9dde3',
  colors: {
    field: '#e8ecd2',
    landuse: '#e3e7ea',
    industrial: '#dcdbe8',
    civic: '#efe0d6',
    water: '#3fb3d6',
    waterway: '#3fb3d6',
    green: '#7cc49a',
    sport: '#bde6c8',
    building: '#9fbbe0',
    tunnel: '#4a5568',
    rail: '#3c4658',
    runway: '#eef0f3',
    path: '#f4f6f8',
    bridge: '#ffffff',
    minor: '#ffffff',
    mid: '#fff3c4',
    major: '#ffffff', // ulica trasy rysowana osobno
  },
  widths: { water: 3, building: 1.2, waterway: 3, path: 1.2, minor: 4, mid: 7, major: 24, rail: 1.6, tunnel: 1.4, bridge: 5, runway: 6 },
  dashes: { path: '2 4', rail: '8 5', tunnel: '4 4' },
  outlines: { water: '#2f95b5', building: '#86a3cf' },
};

// Ulica z obrzeżem: szersza kreska obrzeża pod wypełnieniem, jedna ścieżka na warstwę.
function Road({ d, width, casing, color }: { d?: string; width: number; casing: number; color: string }) {
  if (!d) return null;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} stroke={CASING} strokeWidth={casing} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  );
}

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  const { colors, widths } = STYLE;
  return (
    <>
      <MapBackground layers={{ ...layers, minor: undefined, mid: undefined, major: undefined }} style={STYLE} rect={rect} />
      <Road d={layers.minor} width={widths.minor!} casing={6} color={colors.minor} />
      <Road d={layers.mid} width={widths.mid!} casing={10} color={colors.mid} />
      <Road d={layers.major} width={widths.major!} casing={30} color={colors.major} />
    </>
  );
}

export const bright: MapTheme = {
  label: 'Bright',
  font: 'barlow',
  style: () => STYLE,
  floor,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Outline id="world-bright-route" color="#14213d" radius={4} />
        </defs>
        {floor(layers)}
      </>
    ),
    route: { stroke: '#ff3d8b', width: 16, filter: 'url(#world-bright-route)' },
    text: { color: '#14213d' },
    mark: 'black',
  }),
};
