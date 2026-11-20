import { describe, expect, it } from 'vitest';
import type { Moment } from './moments';
import { FLY_S, HOLD_ZONE, TAIL_S, bannerAlpha, povFrameProgress } from './timeline';

const moments: Moment[] = [{ f: 0.5, kind: 'hr', label: 'MAX HR 180 bpm' }];

describe('povFrameProgress', () => {
  it('od 0 do 1, rosnąco, zwolnienie przy momencie, postój na końcu', () => {
    const plain = povFrameProgress([], 30);
    expect(plain.length).toBe(FLY_S * 30 + 1 + TAIL_S * 30);
    const ps = povFrameProgress(moments, 30);
    expect(ps[0]).toBe(0);
    expect(ps[ps.length - 1]).toBe(1);
    expect(ps.every((p, i) => i === 0 || p >= ps[i - 1])).toBe(true);
    expect(ps.length).toBeGreaterThan(plain.length);
    const step = (p: number) => {
      const i = ps.findIndex((x) => x >= p);
      return ps[i + 1] - ps[i];
    };
    expect(step(0.5)).toBeLessThan(step(0.2) / 4);
  });
});

describe('bannerAlpha', () => {
  it('poza strefą brak, w środku pełny, na brzegu prawie zero', () => {
    expect(bannerAlpha(0.3, moments)).toBeNull();
    expect(bannerAlpha(0.5 + HOLD_ZONE, moments)).toBeNull();
    expect(bannerAlpha(0.5, moments)).toEqual({ m: moments[0], alpha: 1 });
    expect(bannerAlpha(0.5 - HOLD_ZONE * 0.99, moments)!.alpha).toBeLessThan(0.01);
  });
});
