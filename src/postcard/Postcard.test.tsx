import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { Postcard } from './Postcard';
import { ROUTE_BOX } from './Route';

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

  it('widok płaski z markerami pokazuje MAX HR', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} streams={streams} highlights />);
    expect(svg).toContain('MAX HR');
    expect(renderToStaticMarkup(<Postcard activity={hills} streams={streams} />)).not.toContain('MAX HR');
  });
});
