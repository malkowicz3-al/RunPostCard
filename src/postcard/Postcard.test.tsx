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
import { fitRoute } from '../lib/routePath';
import { decorateWorld, worldProps } from '../world/decorate';
import type { MapLayers } from '../lib/vectorMap';
import { GENRES } from '../world/genres';

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

  it('draft (podgląd): w 3D płaskie obrysy zamiast brył; bez draft bryły i podłoga bez obrysów', () => {
    const ring: [number, number][] = [[400, 800], [460, 800], [460, 860], [400, 860]];
    const layers = { ...LAYERS, building: 'M400 800H460V860H400Z', buildings: [{ ring, h: 20, min: 0 }] };
    const base = { activity: hills, background: 'map' as const, map: layers, theme: 'dark' as const, streams, view: '3d' as const };
    const full = renderToStaticMarkup(<Postcard {...base} />);
    const draft = renderToStaticMarkup(<Postcard {...base} draft />);
    expect(full).not.toContain('M400 800H460V860H400Z');
    expect(draft).toContain('M400 800H460V860H400Z');
    expect(draft.length).toBeLessThan(full.length);
    expect(renderToStaticMarkup(<Postcard {...base} view="flat" draft />)).toBe(renderToStaticMarkup(<Postcard {...base} view="flat" />));
  });

  it('part: base ma mapę bez trasy i statystyk, top trasę i statystyki bez mapy (płasko i 3D)', () => {
    for (const view of ['flat', '3d'] as const) {
      const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'dark' as const, streams, view, progress: 0.5 };
      const full = renderToStaticMarkup(<Postcard {...base} />);
      const under = renderToStaticMarkup(<Postcard {...base} part="base" />);
      const over = renderToStaticMarkup(<Postcard {...base} part="top" />);
      const mapPath = 'M0 100L500 100';
      expect(full).toContain(mapPath);
      expect(under).toContain(mapPath);
      expect(over).not.toContain(mapPath);
      expect(full).toContain(MAP_ATTRIBUTION);
      expect(over).toContain(MAP_ATTRIBUTION);
      expect(under).not.toContain(MAP_ATTRIBUTION);
      for (const svg of [under, over]) for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
    }
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
    for (const id of ['poster', 'hud', 'scoreboard', 'splits', 'pulse', 'duo', 'climb', 'strip', 'table', 'sidebar', 'ticker', 'halfPair', 'stacked', 'compare', 'spread', 'drift', 'paceMap', 'even'] as const) {
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
  }, 20_000); // setki renderów pocztówki: przy pełnym przebiegu bywa > 5 s
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

describe('Postcard progress (animacja rysowania)', () => {
  const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'neon' as const, streams };
  const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };
  const person = { href: 'data:image/png;base64,BBBB', rect: [100, 200, 700, 800] as Rect, grid: new Uint8Array(GRID_W * GRID_H) };
  const paths = (svg: string) => svg.match(/<path /g)?.length ?? 0;
  const dots = (svg: string) => svg.match(/<circle [^>]*stroke="#ffffff"/g)?.length ?? 0;

  it('progress=1 daje to samo co bez propa (2D, 3D, styl linii, Behind)', () => {
    for (const view of ['flat', '3d'] as const) {
      for (const extra of [{}, { routeColor: 'pace' as const }, { background: 'photo' as const, photo, person }]) {
        const props = { ...base, view, ...extra };
        expect(renderToStaticMarkup(<Postcard {...props} progress={1} />)).toBe(renderToStaticMarkup(<Postcard {...props} />));
      }
    }
  });

  it('progress=0.5: krótsza trasa z kropką, dystans i czas o połowę, bez NaN i z unikalnymi id', () => {
    for (const view of ['flat', '3d'] as const) {
      for (const extra of [{}, { routeColor: 'rainbow' as const }, { background: 'photo' as const, photo, person }]) {
        const props = { ...base, view, ...extra };
        const full = renderToStaticMarkup(<Postcard {...props} />);
        const half = renderToStaticMarkup(<Postcard {...props} progress={0.5} />);
        expect(half).not.toMatch(/NaN|Infinity/);
        expect(dots(full)).toBe(0);
        expect(dots(half)).toBe('person' in extra ? 2 : 1); // Behind: kropka w obu warstwach obręczy
        expect(half).toContain('>3.20<'); // 6.4 km
        expect(half).toContain('>19:00<'); // 38 min
        expect(full).toContain('>6.40<');
        if (extra && 'routeColor' in extra) expect(paths(half)).toBe(paths(full)); // ta sama liczba odcinków, krótszych
        const ids = [...half.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it('wykresy: przy 0.5 przycięte do połowy (unikalne id), przy 1 bez przycięcia', () => {
    const layout = resolveLayout('duo');
    const half = renderToStaticMarkup(<Postcard {...base} layout={layout} progress={0.5} />);
    expect(half).toContain('clip-path="url(#slot-clip-left)"');
    expect(half).toContain('clip-path="url(#slot-clip-right)"');
    expect(half).toContain(`width="${(520 - 60 + 80) / 2}"`);
    expect(half).not.toMatch(/NaN|Infinity/);
    const ids = [...half.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    const full = renderToStaticMarkup(<Postcard {...base} layout={layout} progress={1} />);
    expect(full).not.toContain('slot-clip');
    expect(full).toBe(renderToStaticMarkup(<Postcard {...base} layout={layout} />));
    // Tempo na km (słupki) nie ma danych cząstkowych wzdłuż trasy: stoi gotowe.
    expect(renderToStaticMarkup(<Postcard {...base} layout={resolveLayout('splits')} progress={0.5} />)).not.toContain('slot-clip');
  });

  it('płasko: przycięta ścieżka ma mniej punktów niż pełna', () => {
    const d = (svg: string) => svg.match(/<path d="([^"]+)"[^>]*filter="url\(#neon-route\)"/)![1];
    const full = d(renderToStaticMarkup(<Postcard {...base} />));
    const half = d(renderToStaticMarkup(<Postcard {...base} progress={0.5} />));
    expect(half.split('L').length).toBeLessThan(full.split('L').length);
  });
});

describe('Postcard styl tekstu', () => {
  const run = mockActivities()[0];
  it('kontur bez wypełnienia z obrysem, cień i kursywa; pusty styl bez zmian', () => {
    const plain = renderToStaticMarkup(<Postcard activity={run} />);
    expect(renderToStaticMarkup(<Postcard activity={run} textStyle={{}} />)).toBe(plain);
    const svg = renderToStaticMarkup(<Postcard activity={run} textStyle={{ outline: true, shadow: true, italic: true }} />);
    expect(svg).toMatch(/fill="none"[^>]*stroke="currentColor"/);
    expect(svg).toContain('id="text-shadow"');
    expect(svg).toContain('filter="url(#text-shadow)"');
    expect(svg).toContain('font-style="italic"');
  });
});

describe('Postcard poświata i przyciemnienie mapy', () => {
  const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'dark' as const, streams };
  const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };
  const person = { href: 'data:image/png;base64,BBBB', rect: [100, 200, 700, 800] as Rect, grid: new Uint8Array(GRID_W * GRID_H) };
  const dimRect = /<rect width="1080" height="1920" fill="#000" opacity="0.4"/;

  it('zera nic nie zmieniają (2D, 3D, Behind)', () => {
    for (const view of ['flat', '3d'] as const) {
      for (const extra of [{}, { background: 'photo' as const, photo, person }]) {
        const props = { ...base, view, ...extra };
        expect(renderToStaticMarkup(<Postcard {...props} glow={0} mapDim={0} />)).toBe(renderToStaticMarkup(<Postcard {...props} />));
      }
    }
  });

  it('mapDim: czarny prostokąt tylko z mapą', () => {
    for (const view of ['flat', '3d'] as const) expect(renderToStaticMarkup(<Postcard {...base} view={view} mapDim={40} />)).toMatch(dimRect);
    expect(renderToStaticMarkup(<Postcard {...base} background="gradient" mapDim={40} />)).not.toMatch(dimRect);
  });

  it('glow: filtr #route-glow na trasie (w Behind na obu częściach); bez trasy brak', () => {
    for (const view of ['flat', '3d'] as const) {
      const svg = renderToStaticMarkup(<Postcard {...base} view={view} glow={60} />);
      expect(svg).toContain('id="route-glow"');
      expect(svg.split('filter="url(#route-glow)"')).toHaveLength(2);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const behind = renderToStaticMarkup(<Postcard {...base} background="photo" photo={photo} person={person} glow={60} />);
    expect(behind.split('filter="url(#route-glow)"')).toHaveLength(3);
    expect(renderToStaticMarkup(<Postcard {...base} route={false} glow={60} />)).not.toContain('route-glow');
  });
});

describe.each(['scifi', 'bright', 'christmas', 'newyear', 'easter', 'valentine'] as const)('Postcard World %s', (genre) => {
  const points = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!.points;
  // Ręczna mapa: siatka brył i ulic na płótnie, dekorowana jak w PostcardScreen.
  const buildings = Array.from({ length: 40 }, (_, k) => {
    const [x, y] = [60 + (k % 8) * 125, 100 + Math.floor(k / 8) * 380];
    return { ring: [[x, y], [x + 50, y], [x + 50, y + 40], [x, y + 40]] as [number, number][], h: 20 + ((k * 7) % 40), min: 0 };
  });
  const layers: MapLayers = {
    minor: Array.from({ length: 9 }, (_, k) => `M${k * 125 + 30} 0L${k * 125 + 30} 1920`).join(''),
    mid: 'M0 500L1080 500',
    major: 'M0 1300L1080 1300',
    building: buildings.map((b) => `M${b.ring.join('L')}Z`).join(''),
    buildings,
  };
  const decorated = decorateWorld(layers, points, 1, genre);
  const { theme, accents } = GENRES[genre];
  const base = {
    activity: hills,
    background: 'map' as const,
    map: decorated,
    theme,
    props: worldProps(layers, points, 1, genre),
    streams,
  };
  // Ulica trasy pod trasą: asfalt 28 px (Sci-fi), jasna jezdnia 24 px (Bright i święta).
  const road = new RegExp(`stroke="${theme.style().colors.major}" stroke-width="${genre === 'scifi' ? 28 : 24}"`);

  it('2D i 3D: z podpisem OSM, lokalne i unikalne id, bez NaN, pojazdy nad mapą i pod trasą', () => {
    for (const view of ['flat', '3d'] as const) {
      const svg = renderToStaticMarkup(<Postcard {...base} view={view} />);
      expect(svg).toContain(MAP_ATTRIBUTION);
      for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg, `${view}: #${ref}`).toContain(`id="${ref}"`);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg.includes('class="world-props"')).toBe(base.props.length > 0);
      expect(svg.includes(`world-${genre}-props-glow`)).toBe(GENRES[genre].props.look.glow && base.props.length > 0);
      if (genre === 'scifi') {
        const props = svg.indexOf('class="world-props"');
        expect(props).toBeGreaterThan(svg.indexOf('id="world-scifi-lines"'));
        expect(props).toBeLessThan(svg.indexOf('filter="url(#world-scifi-route)"'));
      }
      expect(svg, view).toMatch(road); // ulica pod trasą
      if (view === 'flat') {
        // Każda bryła narysowana raz (obrysy z kolorem gatunku zamiast warstwy building).
        const ring = decorated.buildings![0].ring.map(([x, y]) => `${x} ${y}`).join('L');
        expect(svg.split(ring)).toHaveLength(2);
        // Ozdoby świąt (lampki, serca…) tylko płasko.
        expect(svg.includes('class="world-decor"')).toBe(genre !== 'scifi' && genre !== 'bright');
        for (const id of ids.filter((i) => i.startsWith('world-'))) expect(id).toMatch(new RegExp(`^world-${genre}-`));
      }
      if (view === '3d') {
        expect(svg).toContain('transform="matrix(');
        // Auta pod bryłami, statki nad nimi (dwie grupy, gdy są pojazdy).
        if (base.props.length) expect(svg.split('class="world-props"')).toHaveLength(3);
        expect(svg).not.toContain('class="world-decor"');
        if (genre !== 'scifi' && genre !== 'bright') expect(svg).toContain(`filter="url(#world-${genre}-text)"`);
        // Prezenty (wstążka) i choinki, jajka i króliki zamiast części brył.
        if (genre === 'christmas') expect(svg).toContain('fill="#fff3c4"');
        if (genre === 'easter') expect(decorated.buildings!.some((b) => b.festive)).toBe(true);
        // Neon okien i krawędzi w kolorach gatunku (Bright bez akcentów); w świętach dachy w kolorach gatunku.
        if (genre === 'scifi') expect(accents.filter((c) => svg.includes(`stroke="${c}"`)).length).toBeGreaterThanOrEqual(3);
        else if (accents.length) {
          // Szukane w gotowym tekście Buildings3D (ścieżki zamknięte „/>”, nie przez Reacta): biały akcent jest też gdzie indziej.
          const solids = svg.match(/<g>((?:<path [^>]*\/>)+)<\/g>/)![1];
          expect(accents.some((c) => solids.includes(`fill="${c}"`))).toBe(true);
        }
      }
    }
  });

  it('fragment refined w stylu świata: ulica trasy w refined-clip', () => {
    const rect: Rect = [-500, -500, 1580, 2420];
    const svg = renderToStaticMarkup(<Postcard {...base} refined={{ rect, layers: decorated }} />);
    // Po scenie bazowej: bez floor fragment miałby tylko cienką linię major z MapBackground.
    expect(svg.slice(svg.indexOf('clip-path="url(#refined-clip)"'))).toMatch(road);
  });
});

describe.each(['fantasy', 'postapo'] as const)('Postcard World %s', (genre) => {
  const points = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!.points;
  // Ręczna mapa: gęsta siatka małych domków, kilka dużych brył, las, pole i duże jezioro pod trasą.
  const ring = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const buildings = [
    ...Array.from({ length: 600 }, (_, k) => ({ ring: ring(20 + (k % 40) * 26, 1250 + Math.floor(k / 40) * 40, 12, 10), h: 8, min: 0 })),
    ...[[100, 300], [700, 320], [400, 900]].map(([x, y]) => ({ ring: ring(x, y, 50, 40), h: 15, min: 0 })),
  ];
  const layers: MapLayers = {
    minor: 'M0 1240L1080 1240',
    mid: 'M30 0L30 1920',
    water: 'M0 1300L1080 1300L1080 1920L0 1920Z',
    green: 'M600 400L1000 400L1000 700L600 700Z',
    field: 'M100 400L400 400L400 600L100 600Z',
    building: buildings.map((b) => `M${b.ring.join('L')}Z`).join(''),
    buildings,
  };
  const decorated = decorateWorld(layers, points, 1, genre);
  const base = { activity: hills, background: 'map' as const, map: decorated, theme: GENRES[genre].theme, streams };
  const check = (svg: string) => {
    expect(svg).toContain(MAP_ATTRIBUTION);
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg, `#${ref}`).toContain(`id="${ref}"`);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(svg).not.toMatch(/NaN|Infinity/);
    return ids;
  };

  it.runIf(genre === 'fantasy')('płasko: wzory, ramka, domki do 150, trasa z filtrem, nowe id z prefiksem', () => {
    const svg = renderToStaticMarkup(<Postcard {...base} view="flat" />);
    const ids = check(svg);
    for (const id of ['world-fantasy-trees', 'world-fantasy-waves', 'world-fantasy-field', 'world-fantasy-meadow', 'world-fantasy-route'])
      expect(ids).toContain(id);
    for (const id of ids.filter((i) => i.startsWith('world-'))) expect(id).toMatch(/^world-fantasy-/);
    expect(svg).toContain('filter="url(#world-fantasy-route)"');
    expect(svg).toContain('width="1064" height="1904"'); // ramka
    expect(svg).toContain('paint-order="stroke"'); // obrys wody i lasu
    const walls = svg.match(/<path d="([^"]+)" fill="#f1e4c2"/)!;
    const houses = walls[1].split('M').length - 1;
    expect(houses).toBeGreaterThan(20);
    expect(houses).toBeLessThanOrEqual(150);
    // Obrysy brył nie są rysowane, tylko domki.
    expect(svg).not.toContain(decorated.buildings![0].ring.map(([x, y]) => `${x} ${y}`).join('L'));
    expect(svg).toMatch(/fill="#7a4a26"/); // statek na jeziorze
  });

  it.runIf(genre === 'postapo')('płasko: id z prefiksem, trasa z filtrem, ramka, ruiny 20–150 bez obrysów brył, bez statków', () => {
    const svg = renderToStaticMarkup(<Postcard {...base} view="flat" />);
    const ids = check(svg);
    for (const id of ids.filter((i) => i.startsWith('world-'))) expect(id).toMatch(/^world-postapo-/);
    expect(svg).toContain('filter="url(#world-postapo-route)"');
    expect(svg).toContain('width="1064" height="1904"'); // ramka
    const walls = [...svg.matchAll(/<path d="([^"]+)" fill="(#[0-9a-f]{6})"/g)].filter(([, , c]) => GENRES.postapo.accents.includes(c));
    const ruins = walls.reduce((n, [, d]) => n + d.split('M').length - 1, 0);
    expect(ruins).toBeGreaterThan(20);
    expect(ruins).toBeLessThanOrEqual(150);
    expect(svg).not.toContain(decorated.buildings![0].ring.map(([x, y]) => `${x} ${y}`).join('L'));
    expect(svg).not.toMatch(/fill="#7a4a26"/); // bez statków
  });

  it('refined bez zdublowanych id; 3D się renderuje', () => {
    const rect: Rect = [-500, -500, 1580, 2420];
    check(renderToStaticMarkup(<Postcard {...base} refined={{ rect, layers: decorated }} />));
    check(renderToStaticMarkup(<Postcard {...base} view="3d" />));
  });
});
