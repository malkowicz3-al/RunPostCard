import { afterEach, describe, expect, it, vi } from 'vitest';
import { geoMercator } from 'd3-geo';
import { VectorTileFeature } from '@mapbox/vector-tile';
import { PbfWriter } from 'pbf';
import {
  buildMapLayers,
  loadMapLayers,
  loadTile,
  loadTileJson,
  parseTileJson,
  POSTCARD,
  THUMB,
  type MapFeature,
} from './vectorMap';

const TILE = { z: 14, x: 0, y: 0, left: 0, top: 0, size: 1000 };
const SIZE: [number, number] = [1000, 1000];

// Kafelek 1:1 (extent = size), żeby współrzędne geometrii były od razu jednostkami płótna.
const feature = (f: Partial<MapFeature>): MapFeature => ({
  layer: 'transportation',
  type: 2,
  cls: 'minor',
  geometry: [[{ x: 10, y: 10 }, { x: 100, y: 10 }]],
  tile: TILE,
  extent: 1000,
  ...f,
});
const square = (x: number, y: number, s: number) => [
  [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }],
];

describe('buildMapLayers', () => {
  it('klasyfikuje klasy transportation i pomija rail oraz tunele', () => {
    const classes = ['path', 'track', 'minor', 'service', 'secondary', 'tertiary', 'motorway', 'trunk', 'primary'];
    const layers = buildMapLayers(
      [
        ...classes.map((cls) => feature({ cls })),
        feature({ cls: 'rail' }),
        feature({ cls: 'ferry' }),
        feature({ cls: 'primary', brunnel: 'tunnel', geometry: [[{ x: 0, y: 500 }, { x: 900, y: 500 }]] }),
      ],
      SIZE,
      POSTCARD,
    );
    expect(Object.keys(layers)).toEqual(['path', 'minor', 'mid', 'major']);
    expect(layers.path!.match(/M/g)).toHaveLength(2);
    expect(layers.major!.match(/M/g)).toHaveLength(3);
    expect(layers.major).not.toContain('500');
  });

  it('woda, waterway, zieleń i budynki trafiają do swoich kluczy', () => {
    const layers = buildMapLayers(
      [
        feature({ layer: 'water', type: 3, geometry: square(0, 0, 50) }),
        feature({ layer: 'waterway', type: 2 }),
        feature({ layer: 'park', type: 3, geometry: square(0, 0, 50) }),
        feature({ layer: 'landcover', type: 3, cls: 'wood', geometry: square(0, 0, 50) }),
        feature({ layer: 'landcover', type: 3, cls: 'rock', geometry: square(200, 0, 50) }),
        feature({ layer: 'building', type: 3, geometry: square(0, 0, 50) }),
      ],
      SIZE,
      POSTCARD,
    );
    expect(Object.keys(layers)).toEqual(['water', 'waterway', 'green', 'building']);
    expect(layers.water).toBe('M0 0L50 0L50 50L0 50Z');
    expect(layers.green).not.toContain('200');
  });

  it('profil THUMB nie zwraca budynków ani ścieżek', () => {
    const layers = buildMapLayers(
      [feature({ cls: 'path' }), feature({ layer: 'building', type: 3, geometry: square(0, 0, 50) }), feature({})],
      SIZE,
      THUMB,
    );
    expect(Object.keys(layers)).toEqual(['minor']);
  });

  it('mały budynek pominięty, duży zostaje', () => {
    const layers = buildMapLayers(
      [
        feature({ layer: 'building', type: 3, geometry: square(0, 0, 3) }),
        feature({ layer: 'building', type: 3, geometry: square(100, 100, 5) }),
      ],
      SIZE,
      POSTCARD,
    );
    expect(layers.building).toBe('M100 100L105 100L105 105L100 105Z');
  });

  it('scalony multipoligon budynków: otwór dziedzińca w d, budynek poza płótnem pominięty', () => {
    const merged = [square(100, 100, 40)[0], square(110, 110, 10)[0].reverse(), square(2000, 2000, 20)[0]];
    const layers = buildMapLayers([feature({ layer: 'building', type: 3, geometry: merged })], SIZE, POSTCARD);
    expect(layers.building).toBe('M100 100L140 100L140 140L100 140ZM110 120L120 120L120 110L110 110Z');
  });

  it('scalony multipoligon: mały budynek pominięty osobno, otwór budynku odrzuconego po zaokrągleniu nie trafia do poprzedniego', () => {
    // 500..500.3 -> jeden punkt po zaokrągleniu; otwór 400..600 przetrwa zaokrąglenie.
    const merged = [square(100, 100, 40)[0], square(600, 600, 2)[0], square(500, 500, 0.3)[0], square(400, 400, 200)[0].reverse()];
    const layers = buildMapLayers([feature({ layer: 'building', type: 3, geometry: merged })], SIZE, POSTCARD);
    expect(layers.building).toBe('M100 100L140 100L140 140L100 140Z');
  });

  it('obiekt poza płótnem pominięty', () => {
    const layers = buildMapLayers(
      [feature({ geometry: [[{ x: 1100, y: 10 }, { x: 1200, y: 10 }]] }), feature({ geometry: [[{ x: -50, y: -9 }, { x: -1, y: -2 }]] })],
      SIZE,
      POSTCARD,
    );
    expect(layers).toEqual({});
  });

  it('gx = extent trafia w left + size', () => {
    const tile = { ...TILE, left: 300, top: -200, size: 724.5 };
    const layers = buildMapLayers(
      [feature({ tile, extent: 4096, geometry: [[{ x: 0, y: 4096 }, { x: 4096, y: 4096 }]] })],
      SIZE,
      POSTCARD,
    );
    expect(layers.minor).toBe(`M300 ${Math.round(-200 + 724.5)}L${Math.round(300 + 724.5)} 525`);
  });

  it('zaokrągla do precision i usuwa kolejne duplikaty', () => {
    const geometry = [[{ x: 1.04, y: 2.01 }, { x: 1.02, y: 1.98 }, { x: 5.53, y: 2 }, { x: 5.549, y: 2 }]];
    expect(buildMapLayers([feature({ geometry })], SIZE, THUMB).minor).toBe('M1 2L5.5 2');
    expect(buildMapLayers([feature({ geometry })], SIZE, POSTCARD).minor).toBe('M1 2L6 2');
  });

  it('linia krótsza niż 1 jednostka pominięta', () => {
    expect(buildMapLayers([feature({ geometry: [[{ x: 1, y: 1 }, { x: 1.2, y: 1.3 }]] })], SIZE, THUMB)).toEqual({});
  });

  it('jeden string d na klucz', () => {
    const layers = buildMapLayers([feature({}), feature({ geometry: [[{ x: 0, y: 50 }, { x: 99, y: 50 }]] })], SIZE, POSTCARD);
    expect(layers.minor).toBe('M10 10L100 10M0 50L99 50');
  });
});

const OFM = 'https://tiles.openfreemap.org/planet/v1/{z}/{x}/{y}.pbf';

describe('parseTileJson', () => {
  it('przyjmuje poprawny szablon i przycina maxzoom do 14', () => {
    expect(parseTileJson({ tiles: [OFM], maxzoom: 15 })).toEqual({ template: OFM, maxZoom: 14 });
    expect(parseTileJson({ tiles: [OFM], maxzoom: 12 }).maxZoom).toBe(12);
  });

  it('odrzuca zły albo brakujący tiles[0] i obcy host', () => {
    for (const tiles of [
      undefined,
      [],
      [42],
      ['http://tiles.openfreemap.org/{z}/{x}/{y}'],
      ['https://tiles.openfreemap.org/{z}/{x}'],
      ['https://evil.example/{z}/{x}/{y}.pbf'],
      ['https://tiles.openfreemap.org.evil.example/{z}/{x}/{y}.pbf'],
      ['https://{z}.example/{x}/{y}'],
    ])
      expect(() => parseTileJson({ tiles })).toThrow();
    expect(() => parseTileJson(null)).toThrow();
  });
});

// Kafelek MVT z jedną warstwą "water" i jednym poligonem.
function waterTile(): Uint8Array {
  const pbf = new PbfWriter();
  pbf.writeMessage(3, (_: unknown, p: PbfWriter) => {
    p.writeVarintField(15, 2);
    p.writeStringField(1, 'water');
    p.writeMessage(2, (__: unknown, f: PbfWriter) => {
      f.writeVarintField(3, 3);
      f.writePackedVarint(4, [9, 4096, 4096, 18, 800, 0, 0, 800, 15]);
    }, null);
    p.writeVarintField(5, 4096);
  }, null);
  return pbf.finish();
}

describe('pobieranie', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('najwyżej 4 równoległe zapytania, ten sam URL pobierany raz', async () => {
    let inFlight = 0;
    let max = 0;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          max = Math.max(max, ++inFlight);
          setTimeout(() => {
            inFlight--;
            resolve(new Response(null, { status: 204 }));
          }, 2);
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const urls = Array.from({ length: 10 }, (_, i) => `https://q.example/${i}`);
    const tiles = await Promise.all([...urls, ...urls].map(loadTile));
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(max).toBe(4);
    expect(Object.keys(tiles[0].layers)).toEqual([]);
  });

  it('błąd kafelka nie zostaje w cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadTile('https://e.example/1')).rejects.toThrow();
    await expect(loadTile('https://e.example/1')).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('błąd TileJSON nie zostaje w cache, sukces tak', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ tiles: [] }))
      .mockResolvedValueOnce(Response.json({ tiles: [OFM], maxzoom: 14 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadTileJson()).rejects.toThrow();
    await expect(loadTileJson()).resolves.toEqual({ template: OFM, maxZoom: 14 });
    await loadTileJson();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('wspólny kafelek dekodowany raz na profil', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('.pbf') ? new Response(waterTile().slice().buffer as ArrayBuffer) : Response.json({ tiles: [OFM], maxzoom: 14 }),
      ),
    );
    const decode = vi.spyOn(VectorTileFeature.prototype, 'loadGeometry');
    const projection = () => geoMercator().scale(50).translate([50, 50]);
    const first = await loadMapLayers(projection(), [100, 100], THUMB);
    const calls = decode.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(first.water).toBeDefined();
    // Inna projekcja tego samego kafelka: ten sam obiekt, ale inne położenie na płótnie.
    const second = await loadMapLayers(geoMercator().scale(50).translate([60, 50]), [100, 100], THUMB);
    expect(decode.mock.calls.length).toBe(calls);
    expect(second.water).not.toBe(first.water);
    decode.mockRestore();
  });
});
