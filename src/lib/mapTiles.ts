import type { GeoProjection } from 'd3-geo';

export type MapStyle = 'light_all' | 'dark_all';

// Kafelek XYZ i jego miejsce na płótnie (krawędzie w całych jednostkach, sąsiednie kafelki stykają się bez szczelin).
export type Tile = { z: number; x: number; y: number; left: number; top: number; width: number; height: number };

const TILE_PX = 512; // kafelki @2x

// Kafelki Web Mercator pokrywające płótno [width, height] dla projekcji d3 geoMercator (bez obrotu).
// pixelRatio = pikseli ekranu na jednostkę płótna; dobiera zoom, by kafelek miał ok. 512 px.
export function mapTiles(projection: GeoProjection, [width, height]: [number, number], pixelRatio: number): Tile[] {
  // Mercator d3 i Web Mercator różnią się tylko skalą i przesunięciem: świat ma 2*PI*scale jednostek.
  const world = 2 * Math.PI * projection.scale();
  if (!Number.isFinite(world) || world <= 0) return [];
  const z = Math.min(19, Math.max(0, Math.round(Math.log2((world * pixelRatio) / TILE_PX))));
  const n = 2 ** z;
  const size = world / n;
  // Lewy górny róg świata liczony od środka [0, 0]: dokładniej niż projection([-180, 85.0511]) przy dużym zoomie.
  const [cx, cy] = projection([0, 0])!;
  const ox = cx - world / 2;
  const oy = cy - world / 2;
  const edgeX = (i: number) => Math.round(ox + i * size);
  const edgeY = (j: number) => Math.round(oy + j * size);

  const tiles: Tile[] = [];
  for (let j = Math.floor(-oy / size); oy + j * size < height; j++) {
    if (j < 0 || j >= n) continue;
    for (let i = Math.floor(-ox / size); ox + i * size < width; i++) {
      tiles.push({
        z,
        x: ((i % n) + n) % n,
        y: j,
        left: edgeX(i),
        top: edgeY(j),
        width: edgeX(i + 1) - edgeX(i),
        height: edgeY(j + 1) - edgeY(j),
      });
    }
  }
  return tiles;
}

// Publiczny klucz CARTO (przeglądarkowy); bez niego CARTO zwraca kafelki "API KEY REQUIRED", więc mapy nie ma.
export const cartoKey: string = import.meta.env.VITE_CARTO_API_KEY ?? '';
export const MAP_ENABLED = cartoKey !== '';

// Host bez subdomen a–d: dla niego CORS * jest sprawdzony (potrzebny do fetch -> data URL na pocztówce).
export function tileUrl(style: MapStyle, { z, x, y }: Tile, key: string): string {
  const url = `https://basemaps.cartocdn.com/${style}/${z}/${x}/${y}@2x.png`;
  return key ? `${url}?key=${encodeURIComponent(key)}` : url;
}
