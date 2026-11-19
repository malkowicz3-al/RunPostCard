import type { Tile } from './mapTiles';

// Wysokości z AWS Terrain Tiles (Terrarium PNG), ADR 0008. Tu tylko czyste funkcje; pobieranie i PNG w useTerrain.
export const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRAIN_ATTRIBUTION = 'Terrain: Mapzen, USGS, Copernicus EU-DEM, NOAA and others';
export const DEM_MAX_ZOOM = 13;
export const DEM_TILE_PX = 256;
export const TERRAIN_AUTO_M = 300;

// Siatka wysokości [m] w układzie płaskiego płótna: komórka (i, j) ma środek w (x0 + (i + 0,5)·cell, y0 + (j + 0,5)·cell).
// mPerUnit: metry na jednostkę płótna (poziomo).
export type Dem = { x0: number; y0: number; cell: number; w: number; h: number; z: Float32Array; mPerUnit: number };

export function terrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

// Mozaika kafelków jednego poziomu (mapTiles: wyrównane do osi płótna); pixels[i] = RGBA kafelka tiles[i].
export function demFromTiles(tiles: Tile[], pixels: Uint8ClampedArray[], tilePx: number, mPerUnit: number): Dem {
  const size = tiles[0].size;
  const x0 = Math.min(...tiles.map((t) => t.left));
  const y0 = Math.min(...tiles.map((t) => t.top));
  const cols = Math.round((Math.max(...tiles.map((t) => t.left)) - x0) / size) + 1;
  const rows = Math.round((Math.max(...tiles.map((t) => t.top)) - y0) / size) + 1;
  const w = cols * tilePx;
  const h = rows * tilePx;
  const z = new Float32Array(w * h);
  tiles.forEach((t, k) => {
    const ox = Math.round((t.left - x0) / size) * tilePx;
    const oy = Math.round((t.top - y0) / size) * tilePx;
    const p = pixels[k];
    for (let y = 0; y < tilePx; y++)
      for (let x = 0; x < tilePx; x++) {
        const s = (y * tilePx + x) * 4;
        z[(oy + y) * w + ox + x] = terrarium(p[s], p[s + 1], p[s + 2]);
      }
  });
  return { x0, y0, cell: size / tilePx, w, h, z, mPerUnit };
}

// Dwuliniowo między środkami komórek; poza siatką wartość brzegu.
export function sampleGrid(grid: ArrayLike<number>, dem: Dem, x: number, y: number): number {
  const fx = Math.min(dem.w - 1, Math.max(0, (x - dem.x0) / dem.cell - 0.5));
  const fy = Math.min(dem.h - 1, Math.max(0, (y - dem.y0) / dem.cell - 0.5));
  const i = Math.min(dem.w - 2, Math.floor(fx));
  const j = Math.min(dem.h - 2, Math.floor(fy));
  const i0 = Math.max(0, i);
  const j0 = Math.max(0, j);
  const i1 = Math.min(dem.w - 1, i0 + 1);
  const j1 = Math.min(dem.h - 1, j0 + 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const top = grid[j0 * dem.w + i0] * (1 - tx) + grid[j0 * dem.w + i1] * tx;
  const bottom = grid[j1 * dem.w + i0] * (1 - tx) + grid[j1 * dem.w + i1] * tx;
  return top * (1 - ty) + bottom * ty;
}

export function demAt(dem: Dem, x: number, y: number): number {
  return sampleGrid(dem.z, dem, x, y);
}
