import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { MAP_ATTRIBUTION, type MapLayers } from '../lib/vectorMap';
import { fitRoute } from '../lib/routePath';
import { Postcard } from '../postcard/Postcard';
import { ROUTE_BOX } from '../postcard/Route';
import { KEEP_OUT } from './icons';
import { TOP_STATS, medieval } from './medieval';

const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
const streams = mockStreams(hills);
const points = fitRoute(hills.map.summary_polyline, ROUTE_BOX)!.points;

// Ręczna mapa jak w teście Fantasy: gęsta siatka małych brył z dachami w kolorach gatunku, kilka dużych brył,
// las, pole i jezioro; ulica trasy jak z decorateWorld.
const ring = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ROOFS = ['#a5502f', '#8a5a3a', '#7d7a72', '#b86a3c'];
const buildings = [
  ...Array.from({ length: 600 }, (_, k) => ({ ring: ring(20 + (k % 40) * 26, 1250 + Math.floor(k / 40) * 40, 12, 10), h: 8, min: 0, accent: ROOFS[k % 4] })),
  ...[[100, 300], [700, 320], [400, 900]].map(([x, y]) => ({ ring: ring(x, y, 50, 40), h: 15, min: 0 })),
];
const layers: MapLayers = {
  minor: 'M0 1240L1080 1240',
  mid: 'M30 0L30 1920',
  major: `M${points.map(([x, y]) => `${x} ${y}`).join('L')}`,
  water: 'M0 1300L1080 1300L1080 1920L0 1920Z',
  green: 'M600 400L1000 400L1000 700L600 700Z',
  field: 'M100 400L400 400L400 600L100 600Z',
  building: buildings.map((b) => `M${b.ring.join('L')}Z`).join(''),
  buildings,
};

describe('World medieval', () => {
  it('płasko: id z prefiksem i unikalne, url(#) rozwiązane, trasa z filtrem, dachy z obrysów z kalenicami, mgła, podpis OSM', () => {
    const svg = renderToStaticMarkup(<Postcard activity={hills} background="map" map={layers} theme={medieval} streams={streams} view="flat" />);
    expect(svg).toContain(MAP_ATTRIBUTION);
    for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg, `#${ref}`).toContain(`id="${ref}"`);
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['world-medieval-land', 'world-medieval-field', 'world-medieval-woods', 'world-medieval-water', 'world-medieval-route'])
      expect(ids).toContain(id);
    for (const id of ids.filter((i) => i.startsWith('world-'))) expect(id).toMatch(/^world-medieval-/);
    expect(svg).toContain('filter="url(#world-medieval-route)"');
    expect(svg).not.toMatch(/NaN|Infinity/);
    // Każda bryła jako dach w swoim kolorze, raz.
    const roof = svg.match(new RegExp(`<path d="([^"]+)" fill="${ROOFS[0]}"`))!;
    expect(roof[1]).toContain(`M${buildings[0].ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
    expect(svg.split(buildings[0].ring.map(([x, y]) => `${x} ${y}`).join('L'))).toHaveLength(2);
    expect(ROOFS.filter((c) => svg.includes(`fill="${c}"`)).length).toBe(4);
    expect(svg).toContain('M23.5 1255H28.5'); // kalenica wzdłuż dłuższego boku 12×10 (wcięta o 3,5 px)
    const fog = svg.match(/<path d="([^"]+)" fill="#211f23"/)!;
    expect(fog[1].split('M').length - 1).toBeGreaterThan(100);
  });

  it('mgła: boki do 24 px, góra i dół do 58 px, rogi do 140 px; z dala od znaku Stravy, podpisu OSM i statystyk', () => {
    const rim = renderToStaticMarkup(<svg>{medieval.render({}).overlay}</svg>).match(/<path d="([^"]+)" fill="#6a6670"/)![1];
    const puffs = [...rim.matchAll(/M([-\d.]+) ([-\d.]+)a([\d.]+)/g)].map(([, x, y, r]) => [Number(x) + Number(r), Number(y), Number(r)]);
    expect(puffs.length).toBeGreaterThan(100);
    for (const [cx, cy, r] of puffs) {
      const reach = Math.max(0, r - Math.min(Math.abs(cx), Math.abs(1080 - cx))); // w głąb od boku
      const reachY = Math.max(0, r - Math.min(Math.abs(cy), Math.abs(1920 - cy))); // w głąb od góry/dołu
      const corner = Math.min(cx, 1080 - cx) < 200 && Math.min(cy, 1920 - cy) < 200;
      expect(Math.max(reach, reachY), `${cx} ${cy} ${r}`).toBeLessThanOrEqual(corner ? 140 : reachY > 0 ? 64 : 30);
      for (const [x0, y0, x1, y1] of [...KEEP_OUT, TOP_STATS]) {
        const d = Math.hypot(Math.max(x0 - cx, 0, cx - x1), Math.max(y0 - cy, 0, cy - y1));
        expect(d, `${cx} ${cy} ${r}`).toBeGreaterThanOrEqual(r);
      }
    }
  });
});
