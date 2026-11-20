import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { MapTheme } from '../postcard/themes';
import { Glow } from '../postcard/themes/neon';
import { Overlay } from '../postcard/themes/texture';

const LINES = 'url(#world-scifi-lines)';

// Miasto przyszłości nocą: granat, ulice cyjan i magenta z poświatą, ciepła żółta trasa; szczegóły przygaszone.
const STYLE: MapStyle = {
  background: '#050b1f',
  colors: {
    field: '#060f26',
    landuse: '#07112a',
    industrial: '#0a1734',
    civic: '#09152f',
    water: '#02061a',
    waterway: '#123a7a',
    green: '#062236',
    sport: '#0a2440',
    building: '#0e2350',
    tunnel: '#14306a',
    rail: '#183872',
    runway: '#1d4a8a', // lądowiska: przygaszony błękit, kontrast z trasą
    path: '#1f5c9a',
    bridge: '#050b1f',
    minor: '#1f8fd0',
    mid: '#3ff0ff',
    major: '#ff3fc8',
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 4 },
  dashes: { rail: '10 6', tunnel: '4 4', runway: '14 8' },
  filters: { mid: LINES, major: LINES },
  buildings3d: 'tower',
};

export const scifi: MapTheme = {
  label: 'Sci-fi',
  font: 'orbitron',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="world-scifi-grid" patternUnits="userSpaceOnUse" width={48} height={48}>
            <path d="M0 0.5H48M0.5 0V48" stroke="#3ff0ff" strokeWidth={1} opacity={0.06} />
          </pattern>
          <Glow id="world-scifi-lines" blur={2.5} strong={false} />
          <Glow id="world-scifi-route" blur={8} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#world-scifi-grid)" />,
    route: { stroke: '#ffe23f', width: 11, filter: 'url(#world-scifi-route)' },
    text: { color: '#c8fbff' },
    mark: 'white',
  }),
};
