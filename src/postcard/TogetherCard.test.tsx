import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { encodePolyline, mockActivities, mockStreams } from '../dev/mockActivities';
import { decodePolyline } from '../lib/polyline';
import { isoRoutes } from '../lib/isoRoute';
import { fitRoutes, overlayRoutes } from '../lib/routePath';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { TOGETHER_BOX, TogetherCard, nearRuns, runProgress, togetherFit } from './TogetherCard';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const runs = mockActivities().slice(7, 12);

const check = (svg: string) => {
  expect(svg).not.toContain('NaN');
  for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
  expect(new Set(ids).size).toBe(ids.length);
};
const dots = (svg: string) => (svg.match(/<circle/g) ?? []).length;

describe('TogetherCard', () => {
  it('płasko: jedna trasa na bieg, różne kolory, podpis mapy przy tle map', () => {
    const svg = renderToStaticMarkup(<TogetherCard runs={runs} layout="geo" background="map" map={LAYERS} theme="neon" />);
    check(svg);
    expect(svg).toContain(MAP_ATTRIBUTION);
    const colors = new Set([...svg.matchAll(/stroke="(hsl\([^"]+\))"/g)].map(([, c]) => c));
    expect(colors.size).toBe(runs.length);
    expect(svg).toContain('>5<'); // liczba biegów w nagłówku
  });

  it('Heat: jeden kolor, półprzezroczyste trasy; gradient bez podpisu mapy', () => {
    const svg = renderToStaticMarkup(<TogetherCard runs={runs} colors="heat" />);
    check(svg);
    expect(svg).not.toContain('hsl(');
    expect((svg.match(/opacity="0.35"/g) ?? []).length).toBe(runs.length);
    expect(svg).not.toContain(MAP_ATTRIBUTION);
  });

  it('postęp: „real time” kończy krótsze wcześniej, „together” wszystkie naraz', () => {
    expect(runProgress(0.5, 100, 200, 'real')).toBe(1);
    expect(runProgress(0.5, 200, 200, 'real')).toBe(0.5);
    expect(runProgress(0.5, 100, 200, 'together')).toBe(0.5);
    const times = runs.map((r) => r.moving_time);
    const shortest = Math.min(...times) / Math.max(...times);
    const P = (shortest + 1) / 2; // najkrótszy już na mecie, najdłuższy jeszcze nie
    const real = renderToStaticMarkup(<TogetherCard runs={runs} progress={P} sync="real" />);
    const together = renderToStaticMarkup(<TogetherCard runs={runs} progress={P} sync="together" />);
    check(real);
    expect(dots(together)).toBe(runs.length);
    expect(dots(real)).toBeLessThan(runs.length);
    expect(dots(real)).toBeGreaterThan(0);
  });

  it('3D: trasy w jednej scenie, osobne gradienty kurtyn', () => {
    const fit = fitRoutes(runs.map((r) => r.map.summary_polyline), TOGETHER_BOX)!;
    const isos = isoRoutes(runs.map(mockStreams), TOGETHER_BOX, fit.projection);
    expect(new Set(isos.map((i) => i!.matrix.join())).size).toBe(1);
    const svg = renderToStaticMarkup(<TogetherCard runs={runs} layout="geo" background="map" map={LAYERS} isos={isos} progress={0.5} />);
    check(svg);
    expect(svg).toContain('transform="matrix(');
    expect((svg.match(/<linearGradient id="iso-curtain-/g) ?? []).length).toBe(runs.length);
  });
});

describe('układ Overlay', () => {
  const all = mockActivities();
  const far = [all[0], all[5], all[10]]; // Kraków i Tatry

  it('starty w jednym punkcie, wszystko w polu, bez NaN; w overlay mapy nie ma', () => {
    const fit = overlayRoutes(far.map((r) => r.map.summary_polyline), TOGETHER_BOX)!;
    const starts = fit.routes.map((r) => r!.points[0]);
    for (const [x, y] of starts) {
      expect(x).toBeCloseTo(starts[0][0], 6);
      expect(y).toBeCloseTo(starts[0][1], 6);
    }
    const [[bx0, by0], [bx1, by1]] = TOGETHER_BOX;
    for (const r of fit.routes) for (const [x, y] of r!.points) expect(x >= bx0 - 1e-6 && x <= bx1 + 1e-6 && y >= by0 - 1e-6 && y <= by1 + 1e-6).toBe(true);
    const svg = renderToStaticMarkup(<TogetherCard runs={far} layout="overlay" background="map" map={LAYERS} />);
    check(svg);
    expect(svg).not.toContain(MAP_ATTRIBUTION);
  });

  it('wspólna skala w metrach: ta sama trasa w innym miejscu ma ten sam rozmiar', () => {
    const shifted = { ...all[10], id: 1, map: { summary_polyline: all[0].map.summary_polyline } };
    const fit = overlayRoutes([all[0], shifted].map((r) => r.map.summary_polyline), TOGETHER_BOX)!;
    expect(fit.routes[1]!.d).toBe(fit.routes[0]!.d);
  });

  it('3D: starty razem, wspólna podstawa wysokości, bez NaN', () => {
    const fit = togetherFit(far, 'overlay')!;
    // Zagęszczone punkty jak w prawdziwym strumieniu (co ~1 s): wygładzanie 7 próbek przesuwa start tylko o kilka m.
    const dense = (r: (typeof far)[number]) => {
      const pts = decodePolyline(r.map.summary_polyline);
      const out = pts.slice(1).flatMap((b, i) => Array.from({ length: 20 }, (_, k) => [pts[i][0] + ((b[0] - pts[i][0]) * k) / 20, pts[i][1] + ((b[1] - pts[i][1]) * k) / 20] as [number, number]));
      return mockStreams({ ...r, map: { summary_polyline: encodePolyline(out) } });
    };
    const isos = isoRoutes(far.map(dense), TOGETHER_BOX, fit.projections);
    const starts = isos.map((i) => i!.ground[0]);
    for (const [x, y] of starts) expect(Math.hypot(x - starts[0][0], y - starts[0][1])).toBeLessThan(5);
    expect(new Set(isos.map((i) => `${i!.matrix.join()}|${i!.baseM}`)).size).toBe(1);
    check(renderToStaticMarkup(<TogetherCard runs={far} layout="overlay" isos={isos} progress={0.4} />));
  });
});

describe('nearRuns', () => {
  const all = mockActivities();
  it('bieg w Tatrach daleko od reszty jest ukryty; blisko siebie nic', () => {
    const mountain = all.find((r) => r.name === 'Mountain loop')!;
    const city = all.slice(7, 12);
    expect(nearRuns([...city, mountain])).toEqual({ kept: city, hidden: 1 });
    expect(nearRuns(city)).toEqual({ kept: city, hidden: 0 });
  });
});
