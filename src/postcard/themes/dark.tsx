import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Kolory pełne: nakładanie się nie zmienia odcienia.
const STYLE: MapStyle = {
  background: '#121215',
  colors: {
    water: '#16232f',
    waterway: '#16232f',
    green: '#161f19',
    building: '#1c1c21',
    path: '#2c2c32',
    minor: '#34343b',
    mid: '#44444c',
    major: '#56565f',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5 },
};

export const dark: MapTheme = {
  label: 'Dark',
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffffff', width: 14 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
