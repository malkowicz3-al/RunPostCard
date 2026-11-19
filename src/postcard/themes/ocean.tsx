import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const STYLE: MapStyle = {
  background: '#0b1a2e',
  colors: {
    water: '#0f3d4a',
    waterway: '#13505e',
    green: '#0e2433',
    building: '#12243a',
    path: '#1c3550',
    minor: '#234263',
    mid: '#2e5478',
    major: '#3b6890',
    field: '#0d2030',
    landuse: '#0f1f35',
    industrial: '#121f33',
    civic: '#13223b',
    sport: '#0f2a36',
    rail: '#2a4766',
    tunnel: '#1a2f48',
    bridge: '#07111f',
    runway: '#1e3654',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const ocean: MapTheme = {
  label: 'Ocean',
  font: 'grotesk',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#8ff3ff', width: 14 },
    text: { color: '#e6fbff' },
    mark: 'white',
  }),
};
