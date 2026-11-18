import type { GeoProjection } from 'd3-geo';

// Kafelek XYZ i jego miejsce na płótnie (liczby rzeczywiste; wektorów nie trzeba wyrównywać do pikseli).
export type Tile = { z: number; x: number; y: number; left: number; top: number; size: number };

// Kafelki Web Mercator pokrywające płótno [width, height] dla projekcji d3 geoMercator (bez obrotu).
// tileUnits = docelowy rozmiar kafelka w jednostkach płótna; z niego wynika zoom.
export function mapTiles(
  projection: GeoProjection,
  [width, height]: [number, number],
  tileUnits: number,
  maxZoom = 14,
): Tile[] {
  // Mercator d3 i Web Mercator różnią się tylko skalą i przesunięciem: świat ma 2*PI*scale jednostek.
  const world = 2 * Math.PI * projection.scale();
  if (!Number.isFinite(world) || world <= 0) return [];
  const z = Math.min(maxZoom, Math.max(0, Math.round(Math.log2(world / tileUnits))));
  const n = 2 ** z;
  const size = world / n;
  // Lewy górny róg świata liczony od środka [0, 0]: dokładniej niż projection([-180, 85.0511]) przy dużym zoomie.
  const [cx, cy] = projection([0, 0])!;
  const ox = cx - world / 2;
  const oy = cy - world / 2;

  const tiles: Tile[] = [];
  for (let j = Math.floor(-oy / size); oy + j * size < height; j++) {
    if (j < 0 || j >= n) continue;
    const i0 = Math.floor(-ox / size);
    // left narasta o size, więc sąsiednie kafelki stykają się dokładnie (bez błędu zaokrąglenia).
    for (let i = i0, left = ox + i0 * size; left < width; i++, left += size) {
      tiles.push({ z, x: ((i % n) + n) % n, y: j, left, top: oy + j * size, size });
    }
  }
  return tiles;
}

export function tileUrlFrom(template: string, { z, x, y }: Tile): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
