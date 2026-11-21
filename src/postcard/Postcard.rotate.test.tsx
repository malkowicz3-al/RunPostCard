import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { GRID_H, GRID_W } from '../lib/cutout';
import type { Rect } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import { isoRoute } from '../lib/isoRoute';
import { applyCamera } from '../lib/camera';
import { Postcard } from './Postcard';
import { ROUTE_BOX } from './Route';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);
const photo = { href: 'data:image/jpeg;base64,AAAA', dim: 0.35 };
const person = { href: 'data:image/png;base64,BBBB', rect: [100, 200, 700, 800] as Rect, grid: new Uint8Array(GRID_W * GRID_H) };

// Treść grup <g> zaczynających się od danego znacznika (bez DOM: liczenie <g i </g>).
function groups(svg: string, open: string): string[] {
  const out: string[] = [];
  for (let at = svg.indexOf(open); at >= 0; at = svg.indexOf(open, at + 1)) {
    let depth = 0;
    const re = /<g[\s>]|<\/g>/g;
    re.lastIndex = at;
    for (let m = re.exec(svg); m; m = re.exec(svg)) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) {
        out.push(svg.slice(at, re.lastIndex));
        break;
      }
    }
  }
  return out;
}

describe('Postcard: obrót sceny', () => {
  it('płasko, kąt 90: mapa i trasa w obróconej grupie, statystyki i podpis OSM poza nią', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="dark" camera={{ zoom: 1, x: 0, y: 0, angle: 90 }} />,
    );
    const rotated = groups(svg, '<g transform="translate(540 720) scale(1) rotate(90) translate(-540 -720)"');
    expect(rotated).toHaveLength(2); // mapa i trasa
    expect(svg).toContain(MAP_ATTRIBUTION);
    for (const g of rotated) {
      expect(g).not.toContain(MAP_ATTRIBUTION);
      expect(g).not.toContain('<text');
    }
    expect(svg).not.toContain('NaN');
  });

  it('3D z azymutem: iso obrócone, kamera bez rotate(, bez NaN', () => {
    const fit = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!;
    const iso = isoRoute(streams, ROUTE_BOX, fit.projection, undefined, 90)!;
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="map" map={LAYERS} theme="neon" streams={streams} view="3d" iso={iso} />,
    );
    expect(svg).toContain(`matrix(${iso.matrix.join(' ')})`);
    expect(svg).not.toMatch(/scale\([\d.]+\) rotate\(/); // rotate(-90) ma tylko podpis OSM
    expect(svg).not.toContain('NaN');
  });

  it('Behind płasko, kąt 90: linia podziału w połowie zakresu y trasy na ekranie', () => {
    const fit = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!;
    const camera = { zoom: 1.2, x: 30, y: -40, angle: 90 };
    const svg = renderToStaticMarkup(
      <Postcard activity={hills} background="photo" photo={photo} person={person} camera={camera} />,
    );
    const mid = Number(/<clipPath id="route-front"><rect x="-100000" y="([-\d.e]+)"/.exec(svg)![1]);
    const ys = fit.points.map((p) => applyCamera(camera, p)[1]);
    expect(mid).toBeGreaterThan(Math.min(...ys));
    expect(mid).toBeLessThan(Math.max(...ys));
    expect(mid).toBeCloseTo((Math.min(...ys) + Math.max(...ys)) / 2, 6);
  });

  it('Behind z obrotem: klip obręczy poza grupą kamery (linia podziału pozioma na ekranie)', () => {
    for (const view of ['flat', '3d'] as const) {
      const svg = renderToStaticMarkup(
        <Postcard
          activity={hills}
          background="photo"
          photo={photo}
          person={person}
          streams={streams}
          view={view}
          camera={{ zoom: 1.5, x: 20, y: 0, angle: view === 'flat' ? 30 : 0 }}
        />,
      );
      for (const part of ['behind', 'front']) {
        const [clip] = groups(svg, `<g clip-path="url(#route-${part})"`);
        expect(clip.startsWith(`<g clip-path="url(#route-${part})"><g transform="translate(`)).toBe(true);
      }
      expect(svg).not.toContain('NaN');
    }
  });
});
