import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Chłodna ciemna szarość, trasa cyjan.
const STYLE: MapStyle = {
  background: '#1c2128',
  colors: {
    water: '#243444',
    waterway: '#2c4256',
    green: '#222b2a',
    building: '#2a3139',
    path: '#333c46',
    minor: '#3d4753',
    mid: '#4c5866',
    major: '#5e6b7a',
    field: '#1f2529',
    landuse: '#20262d',
    industrial: '#232930',
    civic: '#242a33',
    sport: '#21302e',
    rail: '#4a5562',
    tunnel: '#2c333c',
    bridge: '#14181d',
    runway: '#2f3741',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const slate: MapTheme = {
  label: 'Slate',
  font: 'teko',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#3fe0ff', width: 14 },
    text: { color: '#e6edf3' },
    mark: 'white',
  }),
};
