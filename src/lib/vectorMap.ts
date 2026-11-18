import type { GeoProjection } from 'd3-geo';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { mapTiles, tileUrlFrom, type Tile } from './mapTiles';

// Wektorowe kafelki OpenFreeMap (schemat OpenMapTiles) -> jedna ścieżka SVG na warstwę (ADR 0004).
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const TIMEOUT_MS = 15000;
const MAX_PARALLEL = 4; // zalecenie OpenFreeMap

export const MAP_ATTRIBUTION = '© OpenMapTiles © OpenStreetMap contributors';

// Kolejność rysowania od spodu.
export const MAP_KEYS = ['water', 'waterway', 'green', 'building', 'path', 'minor', 'mid', 'major'] as const;
export type MapKey = (typeof MAP_KEYS)[number];
export type MapLayers = Partial<Record<MapKey, string>>;
// Linie się obrysowuje, resztę (poligony) tylko wypełnia.
export const LINE_KEYS: ReadonlySet<MapKey> = new Set(['waterway', 'path', 'minor', 'mid', 'major']);

export type MapProfile = {
  keys: MapKey[];
  tileUnits: number;
  precision: number;
  minBuildingArea: number;
  objects: boolean; // czy liczyć MapObjects (motywy, ADR 0005)
};

export const POSTCARD: MapProfile = {
  keys: [...MAP_KEYS],
  tileUnits: 1024,
  precision: 1,
  minBuildingArea: 16,
  objects: true,
};
export const THUMB: MapProfile = {
  keys: ['water', 'waterway', 'minor', 'mid', 'major'],
  tileUnits: 256,
  precision: 0.1,
  minBuildingArea: 0,
  objects: false,
};
// Motyw 8-bit: mapa przyciągnięta do siatki 24 przez samo zaokrąglanie.
export const PIXEL: MapProfile = { ...POSTCARD, precision: 24, minBuildingArea: 576 };

// [x0, y0, x1, y1] w układzie płótna.
export type Rect = [number, number, number, number];
export type Ring = [number, number][];
export type Area = { rings: Ring[]; area: number; box: Rect };
export type MapObjects = {
  buildings: { x: number; y: number; area: number }[]; // x, y = środek bbox
  green: Area[];
  water: Area[];
};
export type MapData = { layers: MapLayers; objects: MapObjects };

// type jak w MVT: 2 = linia, 3 = poligon.
export type MapFeature = {
  layer: string;
  type: number;
  cls: string;
  brunnel?: string;
  geometry: { x: number; y: number }[][];
  tile: Tile;
  extent: number;
};

const ROAD: Record<string, MapKey> = {
  path: 'path',
  track: 'path',
  minor: 'minor',
  service: 'minor',
  secondary: 'mid',
  tertiary: 'mid',
  motorway: 'major',
  trunk: 'major',
  primary: 'major',
};

function classify(f: Pick<MapFeature, 'layer' | 'type' | 'cls' | 'brunnel'>): MapKey | null {
  switch (f.layer) {
    case 'water':
      return f.type === 3 ? 'water' : null;
    case 'waterway':
      return f.type === 2 ? 'waterway' : null;
    case 'park':
      return f.type === 3 ? 'green' : null;
    case 'landcover':
      return f.type === 3 && (f.cls === 'wood' || f.cls === 'grass') ? 'green' : null;
    case 'building':
      return f.type === 3 ? 'building' : null;
    case 'transportation':
      return f.type === 2 && f.brunnel !== 'tunnel' ? (ROAD[f.cls] ?? null) : null;
    default:
      return null;
  }
}

type Projected = { key: MapKey; rings: Ring[]; box: Rect };

// Rzutowanie na płótno, zaokrąglanie i filtrowanie wspólne dla warstw i obiektów.
function projectFeatures(features: MapFeature[], [width, height]: [number, number], profile: MapProfile): Projected[] {
  const step = profile.precision;
  const k = 1 / step;
  // Dla precision >= 1 dzielenie zamiast mnożenia przez 1/p: v * (1/12) daje np. 36.00000000000001.
  const round = step >= 1 ? (v: number) => Math.round(v / step) * step : (v: number) => Math.round(v * k) / k;
  const out: Projected[] = [];

  for (const f of features) {
    const key = classify(f);
    if (!key || !profile.keys.includes(key)) continue;
    const line = LINE_KEYS.has(key);
    const scale = f.tile.size / f.extent;
    // null = pierścień odrzucony po zaokrągleniu; indeksy zgodne z f.geometry.
    const rings: (Ring | null)[] = f.geometry.map((ring) => {
      const pts: [number, number][] = [];
      for (const p of ring) {
        const x = round(f.tile.left + p.x * scale);
        const y = round(f.tile.top + p.y * scale);
        const last = pts[pts.length - 1];
        if (last && last[0] === x && last[1] === y) continue;
        pts.push([x, y]);
      }
      return pts.length >= (line ? 2 : 3) ? pts : null;
    });
    // OpenMapTiles scala budynki kafelka w jeden multipoligon (setki pierścieni), więc dzielimy na budynki.
    for (const part of key === 'building' ? polygons(f.geometry, rings) : [rings.filter((r) => r !== null)]) {
      if (!part.length) continue;
      const [minX, minY, maxX, maxY] = boxOf(part);
      if (maxX < 0 || minX > width || maxY < 0 || minY > height) continue;
      if (key === 'building' && (maxX - minX) * (maxY - minY) < profile.minBuildingArea) continue;
      if (line && Math.hypot(maxX - minX, maxY - minY) < 1) continue;
      out.push({ key, rings: part, box: [minX, minY, maxX, maxY] });
    }
  }
  return out;
}

function boxOf(rings: Ring[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings)
    for (const [x, y] of r) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

const signedArea = (r: Ring) => {
  let sum = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) sum += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return sum / 2;
};

// MVT 4.3.4.4: pierścień o kierunku pierwszego zaczyna nowy poligon, przeciwny to otwór poprzedniego.
// Kierunek z surowych współrzędnych kafelka: zaokrąglenie do siatki może go zmienić albo wyzerować.
function polygons(raw: MapFeature['geometry'], rings: (Ring | null)[]): Ring[][] {
  const out: Ring[][] = [];
  let outer = 0;
  let current: Ring[] | null = null;
  raw.forEach((ring, i) => {
    const s = Math.sign(signedArea(ring.map((p): [number, number] => [p.x, p.y])));
    if (!s) return;
    outer ||= s;
    const r = rings[i];
    if (s === outer) {
      // Odrzucony zewnętrzny pierścień: cały budynek znika razem z otworami.
      current = r ? [r] : null;
      if (current) out.push(current);
    } else if (r) current?.push(r);
  });
  return out;
}

function layersFrom(projected: Projected[]): MapLayers {
  const parts: Partial<Record<MapKey, string[]>> = {};
  for (const { key, rings } of projected) {
    const line = LINE_KEYS.has(key);
    const d = rings.map((r) => 'M' + r.map(([x, y]) => `${x} ${y}`).join('L') + (line ? '' : 'Z')).join('');
    (parts[key] ??= []).push(d);
  }
  const layers: MapLayers = {};
  for (const key of MAP_KEYS) if (parts[key]) layers[key] = parts[key].join('');
  return layers;
}

// |suma pól ze znakiem| (shoelace): otwory w MVT mają przeciwny kierunek, więc same się odejmują.
const ringsArea = (rings: Ring[]) => Math.abs(rings.reduce((sum, r) => sum + signedArea(r), 0));

function objectsFrom(projected: Projected[], profile: MapProfile): MapObjects {
  const objects: MapObjects = { buildings: [], green: [], water: [] };
  if (!profile.objects) return objects;
  for (const { key, rings, box } of projected) {
    if (key === 'building')
      objects.buildings.push({ x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, area: ringsArea(rings) });
    else if (key === 'green' || key === 'water') objects[key].push({ rings, area: ringsArea(rings), box });
  }
  return objects;
}

export function buildMapLayers(features: MapFeature[], size: [number, number], profile: MapProfile): MapLayers {
  return layersFrom(projectFeatures(features, size, profile));
}

export function buildMapObjects(features: MapFeature[], size: [number, number], profile: MapProfile): MapObjects {
  return objectsFrom(projectFeatures(features, size, profile), profile);
}

type TileJson = { template: string; maxZoom: number };

export function parseTileJson(json: unknown): TileJson {
  const { tiles, maxzoom } = (json ?? {}) as { tiles?: unknown[]; maxzoom?: unknown };
  const template = tiles?.[0];
  if (
    typeof template !== 'string' ||
    !['{z}', '{x}', '{y}'].every((s) => template.includes(s)) ||
    // Kafelki tylko z hosta OpenFreeMap, nawet gdy TileJSON wskaże inny.
    new URL(template.replace(/\{[zxy]\}/g, '0')).origin !== new URL(TILEJSON_URL).origin
  )
    throw new Error('Invalid TileJSON');
  return { template, maxZoom: Math.min(14, typeof maxzoom === 'number' ? maxzoom : 14) };
}

let tileJson: Promise<TileJson> | undefined;

export function loadTileJson(): Promise<TileJson> {
  if (!tileJson) {
    tileJson = fetch(TILEJSON_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${TILEJSON_URL}`);
        return res.json();
      })
      .then(parseTileJson);
    // Błąd nie zostaje w cache, żeby kolejna próba mogła się udać.
    tileJson.catch(() => (tileJson = undefined));
  }
  return tileJson;
}

let active = 0;
const waiting: (() => void)[] = [];

async function queuedFetch(url: string): Promise<ArrayBuffer> {
  if (active < MAX_PARALLEL) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Could not load ${url}`);
    return await res.arrayBuffer(); // 204 / puste ciało -> kafelek bez warstw
  } finally {
    // Miejsce przechodzi wprost na następne zapytanie, żeby nowe wywołanie go nie zajęło w międzyczasie.
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

async function gunzip(buf: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(buf);
  // Gzip bez nagłówka Content-Encoding: przeglądarka go nie rozpakowała.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const tileCache = new Map<string, Promise<VectorTile>>();

export function loadTile(url: string): Promise<VectorTile> {
  let tile = tileCache.get(url);
  if (!tile) {
    tile = queuedFetch(url)
      .then(gunzip)
      .then((bytes) => new VectorTile(new PbfReader(bytes)));
    tile.catch(() => tileCache.delete(url));
    tileCache.set(url, tile);
  }
  return tile;
}

const SOURCE_LAYERS = ['water', 'waterway', 'park', 'landcover', 'building', 'transportation'];

type TileFeature = Omit<MapFeature, 'tile'>;

// Adapter VectorTile -> obiekty bez położenia kafelka; geometria tylko dla obiektów potrzebnych w profilu.
function tileFeatures(vt: VectorTile, profile: MapProfile): TileFeature[] {
  const out: TileFeature[] = [];
  for (const name of SOURCE_LAYERS) {
    const layer = vt.layers[name];
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const head = {
        layer: name,
        type: f.type,
        cls: String(f.properties.class ?? ''),
        brunnel: f.properties.brunnel as string | undefined,
      };
      const key = classify(head);
      if (!key || !profile.keys.includes(key)) continue;
      out.push({ ...head, geometry: f.loadGeometry(), extent: layer.extent });
    }
  }
  return out;
}

// Miniatury dzielą kafelki, więc dekodujemy każdy kafelek raz na profil.
const featureCache = new Map<string, Promise<TileFeature[]>>();

function loadTileFeatures(url: string, profile: MapProfile): Promise<TileFeature[]> {
  const key = `${profile.keys.join()} ${url}`;
  let features = featureCache.get(key);
  if (!features) {
    features = loadTile(url).then((vt) => tileFeatures(vt, profile));
    features.catch(() => featureCache.delete(key));
    featureCache.set(key, features);
  }
  return features;
}

export async function loadMapLayers(
  projection: GeoProjection,
  size: [number, number],
  profile: MapProfile,
): Promise<MapData> {
  const { template, maxZoom } = await loadTileJson();
  const tiles = mapTiles(projection, size, profile.tileUnits, maxZoom);
  const perTile = await Promise.all(tiles.map((t) => loadTileFeatures(tileUrlFrom(template, t), profile)));
  const projected = projectFeatures(
    perTile.flatMap((features, i) => features.map((f) => ({ ...f, tile: tiles[i] }))),
    size,
    profile,
  );
  return { layers: layersFrom(projected), objects: objectsFrom(projected, profile) };
}
