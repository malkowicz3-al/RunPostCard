import type { MapKey } from '../lib/vectorMap';

// Styl warstw mapy; filters = url(#…) filtra na warstwie (np. poświata w motywie neon).
export type MapStyle = {
  background: string;
  fill?: string; // farba prostokąta tła (np. url(#wzór)); domyślnie background
  colors: Record<MapKey, string>;
  widths: Partial<Record<MapKey, number>>; // grubość obrysu linii (jednostki płótna 1080x1920)
  dashes?: Partial<Record<MapKey, string>>; // stroke-dasharray linii
  filters?: Partial<Record<MapKey, string>>;
};
