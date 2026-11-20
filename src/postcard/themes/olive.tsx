import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Khaki i oliwka jak mapa terenowa, trasa pomarańczowa.
const STYLE: MapStyle = {
  background: '#d9d4b5',
  colors: {
    water: '#a9bcb0',
    waterway: '#93ab9d',
    green: '#c7c79c',
    building: '#cfc8a6',
    path: '#a39a6c',
    minor: '#8c8455',
    mid: '#736c42',
    major: '#585230',
    field: '#d3cdaa',
    landuse: '#d1cba9',
    industrial: '#cbc4a1',
    civic: '#cec7a4',
    sport: '#c6c79f',
    rail: '#3d3a22',
    tunnel: '#e9e5cf',
    bridge: '#e6e2c8',
    runway: '#c9c29f',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const olive: MapTheme = {
  label: 'Olive',
  font: 'alfa',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#e2571c', width: 14 },
    text: { color: '#2f2c18' },
    mark: 'black',
  }),
};
