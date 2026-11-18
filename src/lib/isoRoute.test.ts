import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { ROUTE_BOX } from '../postcard/Route';
import { isoRoute } from './isoRoute';

// Pętla ~5 km w Krakowie, wysokość z funkcji dystansu.
function loop(alt: (t: number) => number, n = 100): RunStreams {
  const t = Array.from({ length: n }, (_, i) => i / (n - 1));
  return {
    latlng: t.map((v) => [50.06 + 0.007 * Math.sin(2 * Math.PI * v), 19.94 + 0.011 * Math.cos(2 * Math.PI * v)]),
    distance: t.map((v) => v * 5000),
    altitude: t.map(alt),
  };
}
const [[x0, y0], [x1, y1]] = ROUTE_BOX;
const curtain = (iso: NonNullable<ReturnType<typeof isoRoute>>) =>
  Math.max(...iso.points.map(([, y], i) => iso.ground[i][1] - y));

describe('isoRoute', () => {
  it('bez wysokości -> null', () => {
    const { altitude: _, ...s } = loop(() => 0);
    expect(isoRoute(s, ROUTE_BOX)).toBeNull();
  });

  it('punkty i podłoże w polu, długości się zgadzają', () => {
    const iso = isoRoute(loop((t) => 200 + 40 * Math.sin(Math.PI * t)), ROUTE_BOX)!;
    expect(iso.points).toHaveLength(100);
    expect(iso.ground).toHaveLength(100);
    expect(iso.grade).toHaveLength(99);
    for (const [x, y] of [...iso.points, ...iso.ground]) {
      expect(x).toBeGreaterThanOrEqual(x0 - 1e-6);
      expect(x).toBeLessThanOrEqual(x1 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(y0 - 1e-6);
      expect(y).toBeLessThanOrEqual(y1 + 1e-6);
    }
  });

  it('wyższy punkt leży wyżej na ekranie niż jego podłoże', () => {
    const iso = isoRoute(loop((t) => 200 + 40 * Math.sin(Math.PI * t)), ROUTE_BOX)!;
    expect(iso.points[50][1]).toBeLessThan(iso.ground[50][1]);
    expect(iso.points[0][1]).toBeCloseTo(iso.ground[0][1], 6);
  });

  it('płaski bieg: przewyższenie wzmocnione, kurtyna >= ~15% pola', () => {
    const iso = isoRoute(loop((t) => 200 + 3 * Math.sin(Math.PI * t)), ROUTE_BOX)!;
    expect(iso.exaggeration).toBeGreaterThan(1);
    expect(curtain(iso)).toBeGreaterThanOrEqual(0.149 * (y1 - y0));
  });

  it('wielka góra: bez wzmocnienia', () => {
    const iso = isoRoute(loop((t) => 500 + 3000 * Math.sin(Math.PI * t)), ROUTE_BOX)!;
    expect(iso.exaggeration).toBeCloseTo(1, 6);
  });

  it('znak nachylenia: pod górę dodatni, z góry ujemny', () => {
    const iso = isoRoute(loop((t) => 200 + 40 * Math.sin(Math.PI * t)), ROUTE_BOX)!;
    expect(iso.grade[20]).toBeGreaterThan(0);
    expect(iso.grade[80]).toBeLessThan(0);
  });
});
