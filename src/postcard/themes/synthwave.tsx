import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';

const STREETS = 'url(#synthwave-streets)';

// Lata 80.: niebo od granatu do fioletu, ulice magenta i cyjan z poświatą, pomarańczowa trasa.
const STYLE: MapStyle = {
  background: '#1a0b3d',
  fill: 'url(#synthwave-sky)',
  colors: {
    field: '#1d0d42',
    landuse: '#200e46',
    industrial: '#25104c',
    civic: '#221048',
    water: '#0b1f5c',
    waterway: '#2f6fd6',
    green: '#1f1048',
    sport: '#2a1252',
    building: '#2b1258',
    tunnel: '#4a1f70',
    rail: '#6a2a8a', // przygaszony fiolet: kontrast z pomarańczową trasą
    runway: '#3a1866',
    path: '#7a2a9a',
    bridge: '#1a0b3d',
    minor: '#b52fb8',
    mid: '#ff3ec8',
    major: '#3ef2ff',
  },
  widths: { waterway: 2, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { waterway: STREETS, minor: STREETS, mid: STREETS, major: STREETS },
};

export const synthwave: MapTheme = {
  label: 'Synthwave',
  // Monoton (linie wewnątrz liter) jest nieczytelny w małych etykietach: TIME, PACE, data.
  font: 'racing',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <linearGradient id="synthwave-sky" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={1920}>
            <stop offset="0" stopColor="#0d0628" />
            <stop offset="0.6" stopColor="#1a0b3d" />
            <stop offset="1" stopColor="#3d0f55" />
          </linearGradient>
          <Glow id="synthwave-streets" blur={2.5} strong={false} />
          <Glow id="synthwave-route" blur={9} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffa31a', width: 12, filter: 'url(#synthwave-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
