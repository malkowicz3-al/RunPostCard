import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { TERRAIN_ATTRIBUTION } from '../lib/dem';
import { Postcard } from './Postcard';
import { ROUTE_BOX } from './Route';
import { CHARTS, DATA, defaultLayout, resolveLayout } from './slots';
import { GRID_H, GRID_W } from '../lib/cutout';
import type { Rect } from '../lib/mapTiles';
import { SlotNumber } from './SlotNumber';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);

describe('Postcard 3D', () => {
  it('3D z tłem map: mapa jako podłoga, podpis OSM, tylko lokalne i unikalne id, bez zewnętrznych adresów', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="neon" streams={streams} view="3d" />,
    );
    expect(svg).toContain('transform="matrix(');
    expect(svg).toContain(MAP_ATTRIBUTION);
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    // xmlns to identyfikator, nie zasób.
    expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    expect(svg).toContain('stroke="#ff9a3d"'); // trasa 3D kolorowana nachyleniem
  });

  it('3D: kamera w SVG, wypełniona kurtyna, podpis przewyższenia u góry pola trasy', () => {
    const svg = renderToStaticMarkup(
      <Postcard
        activity={hills}
        background="map"
        map={LAYERS}
        theme="neon"
        streams={streams}
        view="3d"
        camera={{ zoom: 2, x: 10, y: -20 }}
      />,
    );
    // Skala 2 wokół (540, 720) + przesunięcie (10, -20).
    expect(svg).toContain('transform="translate(-530 -740) scale(2)"');
    expect(svg).toContain('id="iso-curtain-grad"');
    expect(svg).toContain('fill="url(#iso-curtain-grad)"');
    expect(svg).toContain('filter="url(#neon-route)"');
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(svg).not.toContain('elevation ×');
  });

  it('ostrzejsza mapa (3D i płasko): warstwa przycięta do prostokąta, id unikalne; bez niej brak', () => {
    const refined = { rect: [100, 200, 600, 900] as [number, number, number, number], layers: LAYERS };
    for (const theme of ['neon', 'blueprint'] as const) {
      const svg = renderToStaticMarkup(
        <Postcard activity={hills} background="map" map={LAYERS} theme={theme} streams={streams} view="3d" refined={refined} />,
      );
      expect(svg).toContain('id="refined-clip"');
      expect(svg).toContain('clip-path="url(#refined-clip)"');
      for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'neon' as const, streams };
    expect(renderToStaticMarkup(<Postcard {...base} view="3d" />)).not.toContain('refined-clip');
    expect(renderToStaticMarkup(<Postcard {...base} refined={refined} />)).toContain('clip-path="url(#refined-clip)"');
  });

  it('płasko: kamera na mapie i trasie, trasa cieńsza o zoom', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="dark" camera={{ zoom: 2, x: 10, y: -20 }} />,
    );
    expect(svg.split('transform="translate(-530 -740) scale(2)"')).toHaveLength(3);
    expect(svg).toContain('stroke-width="7"'); // dark: 14 / 2
  });

  it('podpis mapy pionowo przy prawej krawędzi, tylko z mapą', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} background="map" map={LAYERS} theme="dark" />);
    expect(svg).toContain('transform="translate(1056 1890) rotate(-90)" font-size="18"');
    expect(renderToStaticMarkup(<Postcard activity={hills} />)).not.toContain(MAP_ATTRIBUTION);
  });
});

describe('Postcard teren', () => {
  const terrain = { href: 'data:image/jpeg;base64,AAAA', rect: [-10, -20, 1100, 2000] as [number, number, number, number] };
  it('3D: relief zamiast podłogi, trasa bez kurtyny, podpis terenu; płasko cienie nad mapą', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="dark" streams={streams} view="3d" terrain={terrain} />,
    );
    expect(svg).toContain('href="data:image/jpeg;base64,AAAA"');
    expect(svg).not.toContain('transform="matrix(');
    expect(svg).not.toContain('iso-curtain-grad');
    expect(svg).toContain(TERRAIN_ATTRIBUTION);
    const flat = renderToStaticMarkup(<Postcard activity={hills} background="map" map={LAYERS} theme="dark" terrain={terrain} />);
    expect(flat).toContain('href="data:image/jpeg;base64,AAAA"');
    // Bez tła map teren nie jest rysowany.
    const plain = renderToStaticMarkup(<Postcard activity={hills} terrain={terrain} />);
    expect(plain).not.toContain('data:image/jpeg');
    expect(plain).not.toContain(TERRAIN_ATTRIBUTION);
  });
});

describe('Postcard zdjęcie i font', () => {
  const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };

  it('tło ze zdjęcia z przyciemnieniem, bez zewnętrznych adresów', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} background="photo" photo={photo} />);
    expect(svg).toContain('data:image/jpeg');
    expect(svg).toContain('opacity="0.35"');
    expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
  });

  it('3D ze zdjęciem: bez podłogi mapy, zdjęcie zostaje', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="photo" photo={photo} streams={streams} view="3d" />,
    );
    expect(svg).not.toContain('matrix(');
    expect(svg).toContain('data:image/jpeg');
  });

  it('wybrany font zastępuje Barlow', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} font="bebas" />);
    expect(svg).toContain('Bebas Neue');
    expect(svg).not.toContain('Barlow Condensed');
  });
});

describe('Postcard układy', () => {
  it('z układem i bez: wartości w SVG, bez nakładki i zewnętrznych adresów; układ zmienia pozycje', () => {
    const plain = renderToStaticMarkup(<Postcard activity={hills} />);
    const corners = renderToStaticMarkup(<Postcard activity={hills} layout={resolveLayout('corners', { a: { data: 'cadence', form: 'number' } })} />);
    for (const svg of [plain, corners]) {
      for (const bad of ['slot-hit', '<button', '<dialog', 'data-active']) expect(svg).not.toContain(bad);
      expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    }
    expect(plain).toContain(`>${DATA.distance.value(hills)}<`);
    expect(corners).toContain(`>${DATA.cadence.value(hills)}<`);
    expect(corners).toContain('CADENCE (SPM)');
    expect(plain).toContain('x="540"');
    expect(corners).not.toContain('x="540"');
  });

  it('wykresy ze strumieni mock; bez strumieni liczby tych samych danych', () => {
    const run = mockActivities().find((r) => r.average_heartrate)!;
    const s = mockStreams(run);
    for (const id of ['poster', 'hud', 'scoreboard', 'splits', 'pulse', 'duo', 'climb', 'strip', 'table'] as const) {
      const layout = resolveLayout(id);
      const chart = layout.find((i) => i.box)!;
      const label = `>${CHARTS[chart.slot.form as keyof typeof CHARTS].label}<`;
      const withCharts = renderToStaticMarkup(<Postcard activity={run} layout={layout} streams={s} />);
      expect(withCharts).toContain(label);
      expect(withCharts).not.toMatch(/NaN|Infinity/);
      const plain = renderToStaticMarkup(<Postcard activity={run} layout={layout} />);
      expect(plain).not.toContain(label);
      expect(plain).toContain(`>${DATA[chart.slot.data].value(run)}<`);
      expect(plain).toContain(DATA[chart.slot.data].label);
    }
    // Każda forma na każdym biegu mock (też bez tętna i kadencji): has() decyduje, rysunek bez NaN.
    for (const r of mockActivities())
      for (const form of Object.keys(CHARTS) as (keyof typeof CHARTS)[]) {
        const layout = resolveLayout('table', { chart: { data: CHARTS[form].data, form } });
        const svg = renderToStaticMarkup(<Postcard activity={r} layout={layout} streams={mockStreams(r)} />);
        expect(svg).not.toMatch(/NaN|Infinity/);
        expect(svg.includes(`>${CHARTS[form].label}<`)).toBe(CHARTS[form].has(mockStreams(r)));
      }
    // Linia tętna i pierścień w kolorach stref.
    expect(renderToStaticMarkup(<Postcard activity={run} layout={resolveLayout('hud')} streams={s} />)).toMatch(/stroke="#(3b9cff|3ccf6e|ffa630|ff4d4d|a0a7b4)"/);
  });
});

describe('Postcard „Behind”', () => {
  const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };
  const person = { href: 'data:image/png;base64,BBBB', rect: [100, 200, 700, 800] as Rect, grid: new Uint8Array(GRID_W * GRID_H) };
  const values = defaultLayout.filter((i) => !i.box).map((i) => DATA[i.slot.data].value(hills));
  const render = (view: 'flat' | '3d' = 'flat', route = true) =>
    renderToStaticMarkup(
      <Postcard activity={hills} background="photo" photo={photo} person={person} streams={streams} view={view} route={route} />,
    );

  for (const view of ['flat', '3d'] as const) {
    it(`${view}: góra trasy za obiektem, dół i wszystkie statystyki przed; tylko lokalne i unikalne id`, () => {
      const svg = render(view);
      for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
      expect(svg).toContain('id="person-dim"');
      const img = svg.indexOf('data:image/png');
      expect(svg.indexOf('url(#route-behind)')).toBeGreaterThan(-1);
      expect(svg.indexOf('url(#route-behind)')).toBeLessThan(img);
      expect(svg.indexOf('url(#route-front)')).toBeGreaterThan(img);
      for (const v of values) expect(svg.indexOf(`>${v}<`)).toBeGreaterThan(img);
      expect(svg.indexOf('data:image/svg+xml')).toBeGreaterThan(img); // znak Stravy na wierzchu
    });
  }

  it('bez trasy: nic za obiektem, statystyki przed', () => {
    const svg = render('flat', false);
    const img = svg.indexOf('data:image/png');
    expect(svg).not.toContain('route-behind');
    for (const v of values) expect(svg.indexOf(`>${v}<`)).toBeGreaterThan(img);
  });

  it('bez osoby albo bez tła ze zdjęcia: nic z „Behind”', () => {
    const svgs = [
      renderToStaticMarkup(<Postcard activity={hills} background="photo" photo={photo} />),
      renderToStaticMarkup(<Postcard activity={hills} background="gradient" photo={photo} person={person} />),
      renderToStaticMarkup(<Postcard activity={hills} background="photo" person={person} streams={streams} view="3d" />),
    ];
    for (const svg of svgs) {
      for (const bad of ['person-dim', 'route-behind', 'route-front', 'data:image/png']) expect(svg).not.toContain(bad);
    }
  });
});

describe('SlotNumber part', () => {
  const props = { x: 0, y: 0, size: 100, label: 'LBL', value: 'VAL' };
  it('tylko wartość, tylko etykieta albo obie', () => {
    const both = renderToStaticMarkup(<svg><SlotNumber {...props} /></svg>);
    const value = renderToStaticMarkup(<svg><SlotNumber {...props} part="value" /></svg>);
    const label = renderToStaticMarkup(<svg><SlotNumber {...props} part="label" /></svg>);
    expect(both).toContain('VAL');
    expect(both).toContain('LBL');
    expect(value).toContain('VAL');
    expect(value).not.toContain('LBL');
    expect(label).toContain('LBL');
    expect(label).not.toContain('VAL');
  });
});

describe('Postcard styl linii', () => {
  const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };
  const person = { href: 'data:image/png;base64,BBBB', rect: [100, 200, 700, 800] as Rect, grid: new Uint8Array(GRID_W * GRID_H) };
  const paths = (svg: string) => svg.match(/<path /g)?.length ?? 0;

  it('każdy styl w 2D, 3D i Behind: bez NaN, unikalne id, tylko lokalne url(#)', () => {
    for (const routeColor of ['theme', 'rainbow', 'pace', 'heartrate', 'elevation'] as const) {
      for (const view of ['flat', '3d'] as const) {
        for (const props of [{ background: 'map' as const, map: LAYERS, theme: 'neon' as const }, { background: 'photo' as const, photo, person }]) {
          const svg = renderToStaticMarkup(<Postcard activity={hills} streams={streams} view={view} routeColor={routeColor} {...props} />);
          expect(svg).not.toMatch(/NaN|Infinity/);
          for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
          const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
          expect(new Set(ids).size).toBe(ids.length);
        }
      }
    }
  });

  it('theme bez zmian (jedna ścieżka), inne style w odcinkach; bez strumieni tempo jak theme', () => {
    const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'neon' as const };
    const theme = renderToStaticMarkup(<Postcard {...base} streams={streams} />);
    expect(renderToStaticMarkup(<Postcard {...base} streams={streams} routeColor="theme" />)).toBe(theme);
    expect(renderToStaticMarkup(<Postcard {...base} routeColor="pace" />)).toBe(renderToStaticMarkup(<Postcard {...base} />));
    const pace = renderToStaticMarkup(<Postcard {...base} streams={streams} routeColor="pace" />);
    expect(paths(pace) - paths(theme)).toBe(149);
    expect(pace).toContain('filter="url(#neon-route)"');
  });
});
