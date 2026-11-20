import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Buildings3D, gable } from './Buildings3D';
import type { BuildingShape } from './mapStyle';

// Punkty kalenicy (s = 0): krawędzie przecinające kalenicę dostają punkt w połowie krótszego boku.
const ridge = (ring: [number, number][]) => gable(ring).pts.filter(([, , s]) => s === 0);

describe('gable', () => {
  it('kalenica wzdłuż dłuższej osi prostokąta, także obróconego', () => {
    expect(ridge([[0, 0], [100, 0], [100, 40], [0, 40]])).toEqual([[100, 20, 0], [0, 20, 0]]);
    expect(ridge([[0, 0], [40, 0], [40, 100], [0, 100]])).toEqual([[20, 0, 0], [20, 100, 0]]);
    // 100 x 40 obrócony o 45°: kalenica równoległa do (1, 1).
    const r = Math.SQRT1_2;
    const [[x0, y0], [x1, y1]] = ridge([[0, 0], [100 * r, 100 * r], [60 * r, 140 * r], [-40 * r, 40 * r]]);
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeCloseTo(100);
    expect(x1 - x0).toBeCloseTo(y1 - y0);
  });

  it('wierzchołki obrysu zostają, s w zakresie -1..1', () => {
    const ring: [number, number][] = [[0, 0], [60, 0], [60, 30], [30, 30], [30, 50], [0, 50]];
    const { pts } = gable(ring);
    for (const pt of ring) expect(pts.some(([x, y]) => x === pt[0] && y === pt[1])).toBe(true);
    for (const [, , s] of pts) expect(Math.abs(s)).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe('Buildings3D', () => {
  const MATRIX: [number, number, number, number, number, number] = [0.7, 0.35, -0.7, 0.35, 540, 400];
  const big = { ring: [[400, 600], [700, 600], [700, 700], [400, 700]] as [number, number][], h: 40, min: 0 };
  const tiny = { ring: [[10, 10], [12, 10], [12, 12]] as [number, number][], h: 5, min: 0 };
  const render = (shape: BuildingShape) =>
    renderToStaticMarkup(
      <svg>
        <Buildings3D buildings={[big, tiny]} matrix={MATRIX} pxPerM={1} color="#808080" shape={shape} accent="#00ffff" />
      </svg>,
    );

  it('każdy wariant: bez NaN, bez defs i url(#), ściany w obu odcieniach', () => {
    for (const shape of ['plain', 'gabled', 'castle', 'tower', 'voxel'] as const) {
      const svg = render(shape);
      expect(svg, shape).not.toContain('NaN');
      expect(svg, shape).not.toMatch(/<defs|url\(#| id="/);
      expect(svg, shape).toContain('fill="#464646"');
    }
  });

  it('gabled: spadek odwrócony od kamery pominięty, żeby nie zamalował szczytu', () => {
    const roofs = (ring: [number, number][]) =>
      renderToStaticMarkup(
        <svg>
          <Buildings3D buildings={[{ ring, h: 40, min: 0 }]} matrix={MATRIX} pxPerM={1} color="#808080" shape="gabled" />
        </svg>,
      ).match(/fill="#808080"/g)?.length;
    expect(roofs([[400, 600], [700, 600], [700, 700], [400, 700]])).toBe(2); // łagodny dach: oba spadki widać
    expect(roofs([[400, 600], [700, 600], [700, 640], [400, 640]])).toBe(1); // stromy: dalszy schowany za kalenicą
  });

  it('detale tylko w swoim wariancie', () => {
    const plain = render('plain');
    expect(plain).not.toContain('stroke=');
    expect(render('tower')).toContain('stroke="#00ffff"');
    // Dach dwuspadowy: spadek w cieniu; voxel: linie pięter; castle: wysoka bryła to wieża z blankami (więcej ścieżek niż plain).
    expect(render('gabled')).toContain('opacity="0.18"');
    expect(render('voxel')).toContain('opacity="0.5"');
    const paths = (svg: string) => svg.split('<path').length;
    expect(paths(render('castle'))).toBeGreaterThan(paths(plain));
  });

  it('tower: własny neon bryły i szyld; bez nich bez zmian', () => {
    const tower = (bld: typeof big & { accent?: string; sign?: boolean }) =>
      renderToStaticMarkup(
        <svg>
          <Buildings3D buildings={[bld]} matrix={MATRIX} pxPerM={1} color="#808080" shape="tower" accent="#00ffff" />
        </svg>,
      );
    const tall = { ...big, h: 120 };
    const own = tower({ ...tall, accent: '#ff2bd6', sign: true });
    expect(own).toContain('stroke="#ff2bd6"');
    expect(own).not.toContain('#00ffff');
    expect(own).toContain('fill="#ff2bd6" opacity="0.9"');
    expect(own.split('<path').length).toBe(tower({ ...tall, accent: '#ff2bd6' }).split('<path').length + 2);
    expect(tower({ ...tall, sign: true })).toBe(tower(tall)); // szyld tylko z własnym neonem
    expect(tower(big)).toContain('stroke="#00ffff"');
  });

  it('gabled, castle i voxel: własny kolor bryły jako dach; bez niego bez zmian', () => {
    const one = (shape: BuildingShape, bld: typeof big & { accent?: string }) =>
      renderToStaticMarkup(
        <svg>
          <Buildings3D buildings={[bld]} matrix={MATRIX} pxPerM={1} color="#808080" shape={shape} />
        </svg>,
      );
    for (const shape of ['gabled', 'castle', 'voxel'] as const) {
      const own = one(shape, { ...big, accent: '#b5442f' });
      expect(own, shape).toContain('fill="#b5442f"');
      expect(own.replaceAll('#b5442f', '#808080'), shape).toBe(one(shape, big));
    }
  });
});
