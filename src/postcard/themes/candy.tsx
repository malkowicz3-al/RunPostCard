import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Pastelowy róż i mięta, ulice fioletowe, trasa malinowa.
const STYLE: MapStyle = {
  background: '#fde8f1',
  colors: {
    water: '#c9ecf2',
    waterway: '#b3e2ec',
    green: '#dcf3e4',
    building: '#f7dbe8',
    path: '#d9b8e6',
    minor: '#c39ad8',
    mid: '#a97bc8',
    major: '#8a5bb3',
    field: '#fbe3ee',
    landuse: '#f9e1ec',
    industrial: '#f5dce9',
    civic: '#f8dfeb',
    sport: '#e4f1e2',
    rail: '#3a1f55',
    tunnel: '#efcfe0',
    bridge: '#fff4f9',
    runway: '#f1d6e4',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const candy: MapTheme = {
  label: 'Candy',
  font: 'bangers',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#e0115f', width: 14 },
    text: { color: '#5a2a7a' },
    mark: 'black',
  }),
};
