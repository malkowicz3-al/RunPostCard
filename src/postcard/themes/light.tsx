import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const STYLE: MapStyle = {
  background: '#f2f2ef',
  colors: {
    water: '#cfe2ee',
    waterway: '#a8c9df',
    green: '#dcead3',
    building: '#e3e3df',
    path: '#c4c4bf',
    minor: '#a3a39e',
    mid: '#7a7a75',
    major: '#545450',
    field: '#eef0e2',
    landuse: '#ebebe7',
    industrial: '#e4e2de',
    civic: '#e8e6ee',
    sport: '#d6e8cc',
    rail: '#9a9a95',
    tunnel: '#c0c0bb',
    bridge: '#8f8f8a',
    runway: '#c4c4bf',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const light: MapTheme = {
  label: 'Light',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#111111', width: 14 },
    text: { color: '#1a1a1a' },
    mark: 'black',
  }),
};
