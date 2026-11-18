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
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5 },
};

export const light: MapTheme = {
  label: 'Light',
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#111111', width: 14 },
    text: { color: '#1a1a1a' },
    mark: 'black',
  }),
};
