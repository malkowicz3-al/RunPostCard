import { describe, expect, it } from 'vitest';
import { routePath } from './routePath';

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
});
