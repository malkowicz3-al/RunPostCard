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

describe('Buildings3D festive', () => {
  // Macierz jak w isoRoute: [f·cos, f·sin/2, -f·sin, f·cos/2, dx, dy], pxPerM = f.
  const iso = (az: number, k: number): [number, number, number, number, number, number] => {
    const [cos, sin] = [Math.cos((az * Math.PI) / 180), Math.sin((az * Math.PI) / 180)];
    return [k * cos, (k * sin) / 2, -k * sin, (k * cos) / 2, 540, 400];
  };
  const rings: [number, number][][] = [
    [[100, 100], [140, 100], [140, 130], [100, 130]],
    [[300, 300], [350, 300], [350, 320], [320, 320], [320, 350], [300, 350]],
    [[600, 200], [630, 200], [630, 240], [600, 240], [600, 200]],
  ];
  const look = { gift: ['fill="#c8102e"', 'stroke="#fff3c4"'], tree: ['fill="#2e8b4e"', 'fill="#f5c62e"'], egg: ['fill="#f4a6c0"'], bunny: ['fill="#fbf7f2"'] };

  it('prezent, choinka, jajko i królik przy każdym azymucie i zoomie: bez NaN, w swoich kolorach', () => {
    for (const [kind, colors] of Object.entries(look) as [keyof typeof look, string[]][])
      for (const az of [0, 45, 90, 180, 270])
        for (const k of [1, 2.5]) {
          const accent = kind === 'egg' ? '#f4a6c0' : '#c8102e';
          const buildings = rings.map((ring) => ({ ring, h: 15, min: 0, accent, festive: kind }));
          const svg = renderToStaticMarkup(<Buildings3D buildings={buildings} matrix={iso(az, k)} pxPerM={k} color="#808080" />);
          expect(svg, `${kind} ${az} ${k}`).not.toMatch(/NaN|Infinity/);
          for (const c of colors) expect(svg, `${kind} ${az} ${k}`).toContain(c);
          expect(svg.split('<path').length - 1).toBeGreaterThanOrEqual(rings.length * colors.length);
        }
  });
});
