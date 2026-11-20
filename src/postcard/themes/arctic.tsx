import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Lodowa biel i błękit, ulice stalowe, trasa głęboki granat.
const STYLE: MapStyle = {
  background: '#eef5fa',
  colors: {
    water: '#bcd9ea',
    waterway: '#a6cbe0',
    green: '#dfeaf0',
    building: '#e3edf3',
    path: '#b9cad6',
    minor: '#9fb5c4',
    mid: '#8199ac',
    major: '#5f7a90',
    field: '#e8f0f5',
    landuse: '#e6eef4',
    industrial: '#e1e9ef',
    civic: '#e4ecf2',
    sport: '#dce8ea',
    rail: '#4e6a80',
    tunnel: '#ccd9e2',
    bridge: '#f7fbfd',
    runway: '#d6e1e9',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const arctic: MapTheme = {
  label: 'Arctic',
  font: 'chakra',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#12355b', width: 14 },
    text: { color: '#12355b' },
    mark: 'black',
  }),
};
