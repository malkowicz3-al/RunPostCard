import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { Postcard } from './Postcard';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);

describe('Postcard 3D i markery', () => {
  it('3D z tłem map: bez mapy i podpisu OSM, tylko lokalne url(#…), bez zewnętrznych adresów', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="neon" streams={streams} view="3d" highlights />,
    );
    expect(svg).not.toContain(MAP_ATTRIBUTION);
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
    // xmlns to identyfikator, nie zasób.
    expect(svg.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
    expect(svg).toContain('MAX HR');
    expect(svg).toContain('stroke="#ff9a3d"'); // trasa 3D kolorowana nachyleniem
  });

  it('widok płaski z markerami pokazuje MAX HR', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} streams={streams} highlights />);
    expect(svg).toContain('MAX HR');
    expect(renderToStaticMarkup(<Postcard activity={hills} streams={streams} />)).not.toContain('MAX HR');
  });
});
