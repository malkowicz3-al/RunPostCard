import type { MapKey } from '../lib/vectorMap';

// Bryła budynków 3D (obrys zawsze prawdziwy): plain prostopadłościan, gabled dach dwuspadowy, castle wieże z blankami
// i dachy, tower okna i neon, voxel piętra schodkowo.
export type BuildingShape = 'plain' | 'gabled' | 'castle' | 'tower' | 'voxel';

// Styl warstw mapy; filters = url(#…) filtra na warstwie (np. poświata w motywie neon).
export type MapStyle = {
  background: string;
  fill?: string; // farba prostokąta tła (np. url(#wzór)); domyślnie background
  colors: Record<MapKey, string>;
  widths: Partial<Record<MapKey, number>>; // grubość obrysu linii (jednostki płótna 1080x1920)
  dashes?: Partial<Record<MapKey, string>>; // stroke-dasharray linii
  filters?: Partial<Record<MapKey, string>>;
  fills?: Partial<Record<MapKey, string>>; // farba poligonu (np. url(#kreskowanie)); colors zostają heksami dla miniatur
  buildings3d?: BuildingShape; // domyślnie plain
};
