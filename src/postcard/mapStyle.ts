import type { MapKey } from '../lib/vectorMap';

// Styl mapy pocztówki w jednym miejscu (pod przyszłe presety). Kolory pełne: nakładanie się nie zmienia odcienia.
export const MAP_BACKGROUND = '#121215';

export const MAP_COLORS: Record<MapKey, string> = {
  water: '#16232f',
  waterway: '#16232f',
  green: '#161f19',
  building: '#1c1c21',
  path: '#2c2c32',
  minor: '#34343b',
  mid: '#44444c',
  major: '#56565f',
};

// Grubość obrysu linii (jednostki płótna 1080x1920).
export const MAP_WIDTHS: Partial<Record<MapKey, number>> = {
  waterway: 3,
  path: 1.2,
  minor: 2,
  mid: 3.5,
  major: 5,
};
