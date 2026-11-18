import type { MapKey } from '../lib/vectorMap';

// Styl warstw mapy; filters = url(#…) filtra na warstwie (np. poświata w motywie neon).
export type MapStyle = {
  background: string;
  colors: Record<MapKey, string>;
  widths: Partial<Record<MapKey, number>>; // grubość obrysu linii (jednostki płótna 1080x1920)
  filters?: Partial<Record<MapKey, string>>;
};
