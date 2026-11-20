import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Jasny pudrowy róż, trasa ciemna.
const STYLE: MapStyle = {
  background: '#fbe9ee',
  colors: {
    water: '#e3e4f2',
    waterway: '#d2d4ea',
    green: '#f1e6e4',
    building: '#f2d9e0',
    path: '#e8bfcc',
    minor: '#dca8b8',
    mid: '#cf93a6',
    major: '#c27d93',
    field: '#f8e6e9',
    landuse: '#f7e3e8',
    industrial: '#f3dde3',
    civic: '#f5e0e6',
    sport: '#efe2e2',
    rail: '#c99aa8',
    tunnel: '#e9cdd6',
    bridge: '#ffffff',
    runway: '#efd5dc',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const rose: MapTheme = {
  label: 'Rose',
  font: 'bebas',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#2b1b2e', width: 14 },
    text: { color: '#2b1b2e' },
    mark: 'black',
  }),
};
