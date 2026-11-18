import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { Postcard } from './Postcard';
import { ROUTE_BOX } from './Route';
import { DATA, resolveLayout } from './slots';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);

describe('Postcard 3D i markery', () => {
  it('3D z tłem map: mapa jako podłoga, podpis OSM, tylko lokalne i unikalne id, bez zewnętrznych adresów', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="neon" streams={streams} view="3d" highlights />,
    );
    expect(svg).toContain('transform="matrix(');
    expect(svg).toContain(MAP_ATTRIBUTION);
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    // xmlns to identyfikator, nie zasób.
    expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    expect(svg).toContain('MAX HR');
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
        highlights
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

  it('3D z ostrzejszą mapą: warstwa przycięta do prostokąta, id unikalne; bez niej i w płaskim brak', () => {
    const refined = { rect: [100, 200, 600, 900] as [number, number, number, number], layers: LAYERS };
    for (const theme of ['neon', 'blueprint'] as const) {
      const svg = renderToStaticMarkup(
        <Postcard activity={hills} background="map" map={LAYERS} theme={theme} streams={streams} view="3d" refined={refined} />,
      );
      expect(svg).toContain('id="iso-refined-clip"');
      expect(svg).toContain('clip-path="url(#iso-refined-clip)"');
      for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const base = { activity: hills, background: 'map' as const, map: LAYERS, theme: 'neon' as const, streams };
    expect(renderToStaticMarkup(<Postcard {...base} view="3d" />)).not.toContain('iso-refined-clip');
    expect(renderToStaticMarkup(<Postcard {...base} refined={refined} />)).not.toContain('iso-refined-clip');
  });

  it('widok płaski z markerami pokazuje MAX HR', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} streams={streams} highlights />);
    expect(svg).toContain('MAX HR');
    expect(renderToStaticMarkup(<Postcard activity={hills} streams={streams} />)).not.toContain('MAX HR');
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
    const corners = renderToStaticMarkup(<Postcard activity={hills} layout={resolveLayout('corners', { a: 'cadence' })} />);
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
});
