import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3-geo';
import { DEM_MAX_ZOOM, DEM_TILE_PX, TERRAIN_URL, demFromTiles, type Dem } from '../lib/dem';
import { mapTiles, tileUrlFrom, type Rect } from '../lib/mapTiles';
import type { Pixels } from '../lib/relief';
import { cached, queuedFetch, type Shared } from '../lib/vectorMap';

const SIZE: [number, number] = [1080, 1920];
const MAX_DEM_TILES = 32;
const EARTH_RADIUS_M = 6371000;

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

// Bez konwersji kolorów: kanały RGB to zakodowana wysokość, nie barwa.
async function decodePng(buf: ArrayBuffer): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(new Blob([buf], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  if (bitmap.width !== DEM_TILE_PX || bitmap.height !== DEM_TILE_PX) throw new Error('Unexpected terrain tile size');
  const ctx = canvas(DEM_TILE_PX, DEM_TILE_PX).getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, DEM_TILE_PX, DEM_TILE_PX).data;
}

const demCache = new Map<string, Shared<Uint8ClampedArray>>();

// Siatka wysokości dla prostokąta płótna; przy zbyt wielu kafelkach poziom lub dwa rzadziej. null = za duży obszar.
// Błąd dowolnego kafelka odrzuca całość (cichy powrót do wyglądu bez terenu).
export async function loadDem(projection: GeoProjection, rect: Rect, signal?: AbortSignal): Promise<Dem | null> {
  const lat = projection.invert?.([(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2])?.[1] ?? 0;
  const mPerUnit = (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180)) / projection.scale();
  for (const k of [1, 0.5, 0.25]) {
    const tiles = mapTiles(projection, SIZE, 1024, DEM_MAX_ZOOM, { k, rect });
    if (tiles.length > MAX_DEM_TILES) continue;
    if (!tiles.length) return null;
    const pixels = await Promise.all(
      tiles.map((t) => {
        const url = tileUrlFrom(TERRAIN_URL, t);
        return cached(demCache, url, (shared) => queuedFetch(url, shared).then(decodePng), signal);
      }),
    );
    return demFromTiles(tiles, pixels, DEM_TILE_PX, mPerUnit);
  }
  return null;
}

type TerrainState = { dem: Dem | null; loading: boolean };
// projection i area: dla jakiego zapytania jest dem (stary DEM po zmianie biegu lub widoku nie wycieka ani na jeden render).
type Loaded = { dem: Dem | null; projection: GeoProjection; area: Rect };

// Wysokości terenu dla obszaru (area musi być stałą referencją między renderami, jak region w useRegionLayers).
export function useTerrain(projection: GeoProjection | null, area: Rect | null, enabled: boolean): TerrainState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const active = enabled && !!projection && !!area;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const { signal } = controller;
    loadDem(projection!, area!, signal).then(
      (dem) => !signal.aborted && setLoaded({ dem, projection: projection!, area: area! }),
      () => !signal.aborted && setLoaded({ dem: null, projection: projection!, area: area! }),
    );
    return () => controller.abort();
  }, [projection, area, active]);

  if (!active) return { dem: null, loading: false };
  const current = loaded?.projection === projection && loaded.area === area;
  return current ? { dem: loaded.dem, loading: false } : { dem: null, loading: true };
}

export function toDataUrl({ width, height, data }: Pixels, type: 'image/png' | 'image/jpeg'): string {
  const c = canvas(width, height);
  c.getContext('2d')!.putImageData(new ImageData(data, width, height), 0, 0);
  const url = c.toDataURL(type, 0.9);
  c.width = c.height = 0; // zwalnia pamięć canvasa od razu (do 32 MB przy 8 MP)
  return url;
}
