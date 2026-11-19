import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const STYLE: MapStyle = {
  background: '#2a1428',
  colors: {
    water: '#3a1f45',
    waterway: '#4a2858',
    green: '#33182e',
    building: '#341a32',
    path: '#5a2847',
    minor: '#7a3354',
    mid: '#b0485e',
    major: '#e0704a',
    field: '#30172c',
    landuse: '#2e162c',
    industrial: '#321a2e',
    civic: '#341b36',
    sport: '#381a30',
    rail: '#6a3050',
    tunnel: '#46203c',
    bridge: '#1a0c19',
    runway: '#4e2442',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const sunset: MapTheme = {
  label: 'Sunset',
  font: 'righteous',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffc23d', width: 14 },
    text: { color: '#ffe8d6' },
    mark: 'white',
  }),
};
