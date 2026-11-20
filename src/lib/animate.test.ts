import { describe, expect, it } from 'vitest';
import { DRAW_S, HOLD_S, easeInOutCubic, frameProgress, previewProgress } from './animate';

describe('animate', () => {
  it('easeInOutCubic: końce, środek, monotonicznie', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
  });

  it('frameProgress: 30 kl./s × 6 s rysowania + 1,5 s pauzy', () => {
    const ps = frameProgress(30, 6, 1.5);
    expect(ps).toHaveLength(225);
    expect(ps[0]).toBe(0);
    expect(ps[179]).toBe(1);
    expect(ps.slice(180).every((p) => p === 1)).toBe(true);
    expect(ps.every((p, i) => i === 0 || p >= ps[i - 1])).toBe(true);
    expect(frameProgress(15, 6, 0)).toHaveLength(90);
  });

  it('previewProgress: rysowanie, pauza na 1, potem od nowa', () => {
    expect(previewProgress(0)).toBe(0);
    expect(previewProgress((DRAW_S / 2) * 1000)).toBeCloseTo(0.5);
    expect(previewProgress((DRAW_S + HOLD_S / 2) * 1000)).toBe(1);
    expect(previewProgress((DRAW_S + HOLD_S) * 1000)).toBe(0);
  });
});
