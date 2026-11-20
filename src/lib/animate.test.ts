import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAW_S, HOLD_S, easeInOutCubic, frameProgress, previewProgress, renderFrames } from './animate';

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

  describe('renderFrames', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('progresses zamiast frameProgress; ten sam postęp nie rysuje się drugi raz', async () => {
      vi.stubGlobal('Image', class { src = ''; decode = () => Promise.resolve(); });
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
      const ctx = { fillStyle: '', fillRect: () => {}, drawImage: () => {} };
      const canvas = { width: 10, height: 10, getContext: () => ctx } as unknown as HTMLCanvasElement;
      const drawn: number[] = [];
      const frames: number[] = [];
      await renderFrames(
        { frame: () => '<svg/>', canvas, under: (_, p) => drawn.push(p), fps: 30, seconds: 6, holdSeconds: 1, progresses: [0, 0.5, 1, 1] },
        (i) => void frames.push(i),
      );
      expect(drawn).toEqual([0, 0.5, 1]);
      expect(frames).toEqual([0, 1, 2, 3]);
    });
  });
});
