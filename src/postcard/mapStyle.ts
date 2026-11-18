import type { MapKey } from '../lib/vectorMap';

// Styl warstw mapy; background i colors mogą być url(#…) (gradient, wzór).
export type MapStyle = {
  background: string;
  colors: Record<MapKey, string>;
  widths: Partial<Record<MapKey, number>>; // grubość obrysu linii (jednostki płótna 1080x1920)
  linecap?: 'round' | 'square';
};

// Motyw "minimal". Kolory pełne: nakładanie się nie zmienia odcienia.
export const MINIMAL: MapStyle = {
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
  widths: {
    waterway: 3,
    path: 1.2,
    minor: 2,
    mid: 3.5,
    major: 5,
  },
};
