import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Czarne tło, ulice jak żarzące się szczeliny, trasa jasnożółta.
const STYLE: MapStyle = {
  background: '#0b0807',
  colors: {
    water: '#140d0c',
    waterway: '#1c1210',
    green: '#120c0a',
    building: '#1a110e',
    path: '#3a1308',
    minor: '#6e1d08',
    mid: '#b3300c',
    major: '#ff4a12',
    field: '#100b09',
    landuse: '#120c0a',
    industrial: '#160e0b',
    civic: '#150d0b',
    sport: '#130d0a',
    rail: '#d13a10',
    tunnel: '#24130e',
    bridge: '#050303',
    runway: '#1e120e',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const lava: MapTheme = {
  label: 'Lava',
  font: 'saira',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffe14d', width: 14 },
    text: { color: '#ffd9b0' },
    mark: 'white',
  }),
};
