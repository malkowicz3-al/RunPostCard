import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Prawie czerń z ciepłym odcieniem, pomarańczowe ulice, trasa biała.
const STYLE: MapStyle = {
  background: '#16120f',
  colors: {
    water: '#1a1d22',
    waterway: '#20252c',
    green: '#1b1a14',
    building: '#211b16',
    path: '#4a2a14',
    minor: '#7a3c14',
    mid: '#b45a1c',
    major: '#e87a28',
    field: '#1a1611',
    landuse: '#1b1612',
    industrial: '#1e1814',
    civic: '#1f1915',
    sport: '#1b1b14',
    rail: '#c0601e',
    tunnel: '#2a211a',
    bridge: '#0c0a08',
    runway: '#2a221c',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const coal: MapTheme = {
  label: 'Coal',
  font: 'russo',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffffff', width: 14 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
