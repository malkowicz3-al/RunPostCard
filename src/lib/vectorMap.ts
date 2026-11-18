import type { GeoProjection } from 'd3-geo';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { mapTiles, tileUrlFrom, tileZoom, type Rect, type Region, type Tile } from './mapTiles';

// Wektorowe kafelki OpenFreeMap (schemat OpenMapTiles) -> jedna ścieżka SVG na warstwę (ADR 0004).
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const TIMEOUT_MS = 15000;
const MAX_PARALLEL = 4; // zalecenie OpenFreeMap

export const MAP_ATTRIBUTION = '© OpenMapTiles © OpenStreetMap contributors';

// Kolejność rysowania od spodu; poligony szczegółów pod wodą, most pod drogą jako obwódka.
export const MAP_KEYS = [
  'field',
  'landuse',
  'industrial',
  'civic',
  'water',
  'waterway',
  'green',
  'sport',
  'building',
  'tunnel',
  'rail',
  'runway',
  'path',
  'bridge',
  'minor',
  'mid',
  'major',
] as const;
export type MapKey = (typeof MAP_KEYS)[number];
export type MapLayers = Partial<Record<MapKey, string>>;
// Linie się obrysowuje, resztę (poligony) tylko wypełnia.
export const LINE_KEYS: ReadonlySet<MapKey> = new Set([
  'waterway',
  'path',
  'minor',
  'mid',
  'major',
  'rail',
  'tunnel',
  'bridge',
  'runway',
]);

export type MapProfile = {
  keys: MapKey[];
  tileUnits: number;
  precision: number;
  minBuildingArea: number;
};

export const BASE_KEYS: MapKey[] = ['water', 'waterway', 'green', 'building', 'path', 'minor', 'mid', 'major'];
export const POSTCARD: MapProfile = { keys: BASE_KEYS, tileUnits: 1024, precision: 1, minBuildingArea: 16 };
export const POSTCARD_DETAILED: MapProfile = { ...POSTCARD, keys: [...MAP_KEYS] };
export const THUMB: MapProfile = {
  keys: ['water', 'waterway', 'minor', 'mid', 'major'],
  tileUnits: 256,
  precision: 0.1,
  minBuildingArea: 0,
};

type Ring = [number, number][];

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

const LANDUSE: Record<string, MapKey> = {
  residential: 'landuse',
  suburb: 'landuse',
  neighbourhood: 'landuse',
  quarter: 'landuse',
  commercial: 'industrial',
  industrial: 'industrial',
  retail: 'industrial',
  quarry: 'industrial',
  railway: 'industrial',
  military: 'industrial',
  school: 'civic',
  kindergarten: 'civic',
  university: 'civic',
  college: 'civic',
  library: 'civic',
  hospital: 'civic',
  cemetery: 'civic',
  theme_park: 'civic',
  zoo: 'civic',
  pitch: 'sport',
  stadium: 'sport',
  playground: 'sport',
  track: 'sport',
  garden: 'sport',
};

const LANDCOVER: Record<string, MapKey> = { wood: 'green', grass: 'green', farmland: 'field', sand: 'field' };

// Pusta lista = obiekt pomijany; most daje dwa klucze (droga + obwódka mostu).
function classifyAll(f: Pick<MapFeature, 'layer' | 'type' | 'cls' | 'brunnel'>): MapKey[] {
  const one = (key: MapKey | undefined | false): MapKey[] => (key ? [key] : []);
  switch (f.layer) {
    case 'water':
      return one(f.type === 3 && 'water');
    case 'waterway':
      return one(f.type === 2 && 'waterway');
    case 'park':
      return one(f.type === 3 && 'green');
    case 'landcover':
      return one(f.type === 3 && LANDCOVER[f.cls]);
    case 'landuse':
      return one(f.type === 3 && LANDUSE[f.cls]);
    case 'aeroway':
      return one(f.type === 3 ? 'industrial' : f.type === 2 && (f.cls === 'runway' || f.cls === 'taxiway') && 'runway');
    case 'building':
      return one(f.type === 3 && 'building');
    case 'transportation': {
      if (f.type !== 2) return [];
      const key = f.cls === 'rail' || f.cls === 'transit' ? 'rail' : ROAD[f.cls];
      if (!key) return [];
      if (f.brunnel === 'tunnel') return one(key !== 'rail' && 'tunnel');
      // Obwódka mostu tylko dla dróg; ścieżka i tor zostają bez niej.
      return f.brunnel === 'bridge' && (key === 'minor' || key === 'mid' || key === 'major') ? [key, 'bridge'] : [key];
    }
    default:
      return [];
  }
}

const classify = (f: Pick<MapFeature, 'layer' | 'type' | 'cls' | 'brunnel'>, profile: MapProfile) =>
  classifyAll(f).filter((key) => profile.keys.includes(key));

export function buildMapLayers(
  features: MapFeature[],
  [width, height]: [number, number],
  profile: MapProfile,
  [cx0, cy0, cx1, cy1]: Rect = [0, 0, width, height],
): MapLayers {
  const k = 1 / profile.precision;
  const round = (v: number) => Math.round(v * k) / k;
  const parts: Partial<Record<MapKey, string[]>> = {};

  for (const f of features)
    for (const key of classify(f, profile)) addFeature(f, key);

  function addFeature(f: MapFeature, key: MapKey) {
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
      if (maxX < cx0 || minX > cx1 || maxY < cy0 || minY > cy1) continue;
      if (key === 'building' && (maxX - minX) * (maxY - minY) < profile.minBuildingArea) continue;
      if (line && Math.hypot(maxX - minX, maxY - minY) < 1) continue;
      const d = part.map((r) => 'M' + r.map(([x, y]) => `${x} ${y}`).join('L') + (line ? '' : 'Z')).join('');
      (parts[key] ??= []).push(d);
    }
  }

  const layers: MapLayers = {};
  for (const key of MAP_KEYS) if (parts[key]) layers[key] = parts[key].join('');
  return layers;
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
// Kierunek z surowych współrzędnych kafelka: zaokrąglenie może go zmienić albo wyzerować.
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

async function queuedFetch(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (active < MAX_PARALLEL) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    // Przerwane w kolejce: oddajemy miejsce bez zapytania.
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
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

// Błąd i przerwanie nie zostają w cache; przy przerwaniu wpis znika od razu, żeby kolejne wywołanie go nie przejęło.
function cached<T>(cache: Map<string, Promise<T>>, key: string, make: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let value = cache.get(key);
  if (!value) {
    const created = make();
    const drop = () => cache.get(key) === created && cache.delete(key);
    created.catch(drop);
    signal?.addEventListener('abort', drop, { once: true });
    cache.set(key, created);
    value = created;
  }
  return value;
}

const tileCache = new Map<string, Promise<VectorTile>>();

export function loadTile(url: string, signal?: AbortSignal): Promise<VectorTile> {
  return cached(
    tileCache,
    url,
    () =>
      queuedFetch(url, signal)
        .then(gunzip)
        .then((bytes) => new VectorTile(new PbfReader(bytes))),
    signal,
  );
}

const SOURCE_LAYERS = ['water', 'waterway', 'park', 'landcover', 'landuse', 'aeroway', 'building', 'transportation'];

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
      if (!classify(head, profile).length) continue;
      out.push({ ...head, geometry: f.loadGeometry(), extent: layer.extent });
    }
  }
  return out;
}

// Miniatury dzielą kafelki, więc dekodujemy każdy kafelek raz na profil.
const featureCache = new Map<string, Promise<TileFeature[]>>();

function loadTileFeatures(url: string, profile: MapProfile, signal?: AbortSignal): Promise<TileFeature[]> {
  const key = `${profile.keys.join()} ${url}`;
  return cached(featureCache, key, () => loadTile(url, signal).then((vt) => tileFeatures(vt, profile)), signal);
}

export async function loadMapLayers(
  projection: GeoProjection,
  size: [number, number],
  profile: MapProfile,
): Promise<MapLayers> {
  const { template, maxZoom } = await loadTileJson();
  return layersFromTiles(template, mapTiles(projection, size, profile.tileUnits, maxZoom), size, profile);
}

const MAX_REGION_TILES = 24;

// Ostrzejsza mapa dla przybliżonego fragmentu (zoom 3D); null = nie ma czego doczytać albo za dużo kafelków.
export async function loadRegionLayers(
  projection: GeoProjection,
  size: [number, number],
  profile: MapProfile,
  region: Region,
  signal?: AbortSignal,
): Promise<MapLayers | null> {
  const { template, maxZoom } = await loadTileJson();
  signal?.throwIfAborted();
  const { k, rect } = region;
  // Podstawowa mapa ma już najgęstsze kafelki (z14): nic nie zyskamy.
  if (!(tileZoom(projection, profile.tileUnits, maxZoom, k) > tileZoom(projection, profile.tileUnits, maxZoom))) return null;
  const tiles = mapTiles(projection, size, profile.tileUnits, maxZoom, region);
  if (tiles.length > MAX_REGION_TILES) return null;
  const sharper = { ...profile, precision: k > 2 ? 0.25 : 0.5, minBuildingArea: profile.minBuildingArea / k ** 2 };
  return layersFromTiles(template, tiles, size, sharper, rect, signal);
}

async function layersFromTiles(
  template: string,
  tiles: Tile[],
  size: [number, number],
  profile: MapProfile,
  clip?: Rect,
  signal?: AbortSignal,
): Promise<MapLayers> {
  const perTile = await Promise.all(tiles.map((t) => loadTileFeatures(tileUrlFrom(template, t), profile, signal)));
  return buildMapLayers(
    perTile.flatMap((features, i) => features.map((f) => ({ ...f, tile: tiles[i] }))),
    size,
    profile,
    clip,
  );
}
