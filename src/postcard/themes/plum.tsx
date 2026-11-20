import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Głęboka śliwka, różowe ulice, trasa limonkowa.
const STYLE: MapStyle = {
  background: '#2a1030',
  colors: {
    water: '#24164a',
    waterway: '#2c1c5c',
    green: '#2c1636',
    building: '#36173e',
    path: '#6e2a5e',
    minor: '#9a3c7c',
    mid: '#c84d92',
    major: '#e0609a',
    field: '#2e1334',
    landuse: '#2f1236',
    industrial: '#331539',
    civic: '#34143c',
    sport: '#311a3a',
    rail: '#a04878',
    tunnel: '#4a2050',
    bridge: '#1c0a20',
    runway: '#3e1a46',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const plum: MapTheme = {
  label: 'Plum',
  font: 'righteous',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#b8ff3c', width: 14 },
    text: { color: '#ffe6f2' },
    mark: 'white',
  }),
};
