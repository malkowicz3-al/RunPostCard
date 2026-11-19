import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const STYLE: MapStyle = {
  background: '#13201a',
  colors: {
    water: '#16302f',
    waterway: '#1c3d3a',
    green: '#1a3020',
    building: '#1d2a20',
    path: '#2b3d2a',
    minor: '#3a5233',
    mid: '#4c6a3e',
    major: '#64844c',
    field: '#1a2a1b',
    landuse: '#18241c',
    industrial: '#1c231d',
    civic: '#1b2620',
    sport: '#1e3522',
    rail: '#40553a',
    tunnel: '#26352a',
    bridge: '#0b140f',
    runway: '#2e4030',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const forest: MapTheme = {
  label: 'Forest',
  font: 'oswald',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#f3e6c4', width: 14 },
    text: { color: '#f3e6c4' },
    mark: 'white',
  }),
};
