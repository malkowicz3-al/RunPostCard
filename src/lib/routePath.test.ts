import { describe, expect, it } from 'vitest';
import { fitRoute, fitRoutes, routePath, type Box } from './routePath';
import { encodePolyline } from '../dev/mockActivities';
import { ROUTE_BOX } from '../postcard/Route';

describe('routePath', () => {
  it('pod 2 punktów zwraca null', () => {
    expect(routePath('', [[0, 0], [100, 100]])).toBeNull();
    expect(routePath('_p~iF~ps|U', [[0, 0], [100, 100]])).toBeNull();
  });

  it('trasa mieści się w podanym obszarze', () => {
    const d = routePath('_p~iF~ps|U_ulLnnqC_mqNvxq`@', [[0, 0], [100, 100]]);
    expect(d).toMatch(/^M/);
    const nums = d!.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      expect(nums[i]).toBeGreaterThanOrEqual(-1e-6);
      expect(nums[i]).toBeLessThanOrEqual(100 + 1e-6);
      expect(nums[i + 1]).toBeGreaterThanOrEqual(-1e-6);
      expect(nums[i + 1]).toBeLessThanOrEqual(100 + 1e-6);
    }
  });

  it('bounds trasy w obszarze, y0 < y1', () => {
    const [[x0, y0], [x1, y1]] = fitRoute('_p~iF~ps|U_ulLnnqC_mqNvxq`@', ROUTE_BOX)!.bounds;
    const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
    expect(x0).toBeGreaterThanOrEqual(bx0 - 1e-6);
    expect(y0).toBeGreaterThanOrEqual(by0 - 1e-6);
    expect(x1).toBeLessThanOrEqual(bx1 + 1e-6);
    expect(y1).toBeLessThanOrEqual(by1 + 1e-6);
    expect(y0).toBeLessThan(y1);
  });

  it('points: rzutowany punkt na każdy punkt polilinii, w obszarze', () => {
    const { points } = fitRoute('_p~iF~ps|U_ulLnnqC_mqNvxq`@', ROUTE_BOX)!;
    expect(points).toHaveLength(3);
    const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
    for (const [x, y] of points) expect(x >= bx0 - 1e-6 && x <= bx1 + 1e-6 && y >= by0 - 1e-6 && y <= by1 + 1e-6).toBe(true);
  });
});

describe('fitRoutes', () => {
  const a = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const b = encodePolyline([[38.5, -118], [39, -117.5], [39.5, -117]]);

  it('jedna projekcja dla wszystkich tras: razem w obszarze, każda mniejsza niż sama', () => {
    const fit = fitRoutes([a, b, ''], ROUTE_BOX)!;
    expect(fit.routes[2]).toBeNull();
    const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
    for (const r of fit.routes.slice(0, 2)) {
      for (const [x, y] of r!.points) expect(x >= bx0 - 1e-6 && x <= bx1 + 1e-6 && y >= by0 - 1e-6 && y <= by1 + 1e-6).toBe(true);
    }
    // Ta sama projekcja: punkt A z obu wyników tam, gdzie projekcja wspólna go rzuca; samodzielnie A wypełnia box szerzej.
    expect(fit.routes[0]!.points[0]).toEqual(fit.projection([-120.2, 38.5]));
    const width = ([[x0], [x1]]: Box) => x1 - x0;
    expect(width(fit.routes[0]!.bounds)).toBeLessThan(width(fitRoute(a, ROUTE_BOX)!.bounds));
  });

  it('jedna trasa: wynik jak fitRoute; brak tras z 2 punktami -> null', () => {
    expect(fitRoutes([a], ROUTE_BOX)!.routes[0]!.d).toBe(fitRoute(a, ROUTE_BOX)!.d);
    expect(fitRoutes(['', '_p~iF~ps|U'], ROUTE_BOX)).toBeNull();
  });
});
