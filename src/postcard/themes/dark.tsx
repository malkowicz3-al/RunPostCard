import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Kolory pełne: nakładanie się nie zmienia odcienia.
const STYLE: MapStyle = {
  background: '#121215',
  colors: {
    water: '#16232f',
    waterway: '#16232f',
    green: '#161f19',
    building: '#1c1c21',
    path: '#2c2c32',
    minor: '#34343b',
    mid: '#44444c',
    major: '#56565f',
    field: '#151a17',
    landuse: '#17171b',
    industrial: '#1a181b',
    civic: '#19191f',
    sport: '#18251c',
    rail: '#3a3a42',
    tunnel: '#26262c',
    bridge: '#0e0e11',
    runway: '#2e2e36',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const dark: MapTheme = {
  label: 'Dark',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffffff', width: 14 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
