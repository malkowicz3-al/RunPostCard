import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Kremowe tło, brązowe ulice, trasa morska zieleń.
const STYLE: MapStyle = {
  background: '#f3ead8',
  colors: {
    water: '#cfe0dc',
    waterway: '#b7d2cc',
    green: '#e6e3c8',
    building: '#e8dcc4',
    path: '#c9a983',
    minor: '#b58e64',
    mid: '#9c7449',
    major: '#80592f',
    field: '#efe5cc',
    landuse: '#eee3cf',
    industrial: '#e9dcc6',
    civic: '#ecdfca',
    sport: '#e3e2c4',
    rail: '#3a2a1c',
    tunnel: '#d8c6a8',
    bridge: '#f8f1e2',
    runway: '#e2d5bd',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const sand: MapTheme = {
  label: 'Sand',
  font: 'archivo',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#0f8a8a', width: 14 },
    text: { color: '#3a2a1c' },
    mark: 'black',
  }),
};
