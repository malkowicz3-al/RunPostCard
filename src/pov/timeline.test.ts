import { describe, expect, it } from 'vitest';
import type { Moment } from './moments';
import { KEY_HOLD_S, SPLIT_HOLD_S, TAIL_S, ZONE_M, bannerAlpha, flyS, povFrameProgress, zones } from './timeline';

const moments: Moment[] = [{ f: 0.5, kind: 'hr', label: 'MAX HR 180 bpm' }];
const KM10 = 10000;

describe('povFrameProgress', () => {
  it('od 0 do 1, rosnąco, postój przy momencie, postój na końcu', () => {
    const plain = povFrameProgress([], 30, KM10);
    expect(plain.length).toBe(flyS(KM10) * 30 + 1 + TAIL_S * 30);
    const ps = povFrameProgress(moments, 30, KM10);
    expect(ps[0]).toBe(0);
    expect(ps[ps.length - 1]).toBe(1);
    expect(ps.every((p, i) => i === 0 || p >= ps[i - 1])).toBe(true);
    expect((ps.length - plain.length) / 30).toBeCloseTo(KEY_HOLD_S, 1);
    const step = (p: number) => {
      const i = ps.findIndex((x) => x >= p);
      return ps[i + 1] - ps[i];
    };
    expect(step(0.5)).toBeLessThan(step(0.2) / 4);
  });

  it('czas lotu rośnie z dystansem w granicach 30–70 s', () => {
    expect(flyS(1000)).toBe(30);
    expect(flyS(10000)).toBe(50);
    expect(flyS(15000)).toBe(65);
    expect(flyS(42195)).toBe(70);
  });

  it('strefy w metrach, bez nachodzenia; każdy międzyczas dodaje ok. SPLIT_HOLD_S', () => {
    const splits: Moment[] = [0.1, 0.2, 0.205].map((f) => ({ f, kind: 'split', label: '' }));
    const zs = zones(splits, KM10);
    expect(zs[0]).toBeCloseTo(ZONE_M / KM10, 6);
    expect(zs[1]).toBeCloseTo(0.0025, 6);
    expect(zs[2]).toBeCloseTo(0.0025, 6);
    const extra = (povFrameProgress(splits, 30, KM10).length - povFrameProgress([], 30, KM10).length) / 30;
    expect(extra).toBeCloseTo(3 * SPLIT_HOLD_S, 0);
  });
});

describe('bannerAlpha', () => {
  it('poza strefą brak, w środku pełny, na brzegu prawie zero, na mecie brak', () => {
    const z = ZONE_M / KM10;
    expect(bannerAlpha(0.3, moments, KM10)).toBeNull();
    expect(bannerAlpha(0.5 + z, moments, KM10)).toBeNull();
    expect(bannerAlpha(0.5, moments, KM10)).toEqual({ m: moments[0], alpha: 1 });
    expect(bannerAlpha(0.5 - z * 0.99, moments, KM10)!.alpha).toBeLessThan(0.01);
    expect(bannerAlpha(1, [{ f: 0.999, kind: 'hr', label: '' }], KM10)).toBeNull();
  });
});
