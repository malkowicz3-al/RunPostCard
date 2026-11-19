import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const STYLE: MapStyle = {
  background: '#e3f4ec',
  colors: {
    water: '#c4e6e4',
    waterway: '#a6d6d4',
    green: '#d2ecd9',
    building: '#d6e8df',
    path: '#bcd3c8',
    minor: '#a2bdb1',
    mid: '#86a596',
    major: '#6b8c7d',
    field: '#e8f5e4',
    landuse: '#dcefe6',
    industrial: '#d9e6e0',
    civic: '#dfe8ec',
    sport: '#cdebd6',
    rail: '#9fbfb2',
    tunnel: '#c0d6cc',
    bridge: '#94b3a6',
    runway: '#c4d9cf',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const mint: MapTheme = {
  label: 'Mint',
  font: 'grotesk',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#0d5c5a', width: 14 },
    text: { color: '#12302c' },
    mark: 'black',
  }),
};
