import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Czysta czerń i biel; hierarchię ulic niosą tylko grubości.
const STYLE: MapStyle = {
  background: '#ffffff',
  colors: {
    water: '#e6e6e6',
    waterway: '#cccccc',
    green: '#f2f2f2',
    building: '#ececec',
    path: '#000000',
    minor: '#000000',
    mid: '#000000',
    major: '#000000',
    field: '#f7f7f7',
    landuse: '#f4f4f4',
    industrial: '#eeeeee',
    civic: '#f0f0f0',
    sport: '#eaeaea',
    rail: '#000000',
    tunnel: '#bbbbbb',
    bridge: '#000000',
    runway: '#dddddd',
  },
  widths: { waterway: 3, path: 0.8, minor: 2, mid: 4, major: 7, rail: 1.5, tunnel: 1.5, bridge: 9, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const mono: MapTheme = {
  label: 'Mono',
  font: 'anton',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#e0201b', width: 14 },
    text: { color: '#000000' },
    mark: 'black',
  }),
};
