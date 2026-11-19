import { describe, expect, it } from 'vitest';
import { fitRoute, routePath } from './routePath';
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
});
