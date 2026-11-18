import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { Postcard } from './Postcard';
import { ROUTE_BOX } from './Route';
import { CHARTS, DATA, resolveLayout } from './slots';

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
