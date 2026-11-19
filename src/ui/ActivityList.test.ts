import { describe, expect, it } from 'vitest';
import { MAX_TOGETHER, canAnimateTogether, mergePage, summarize, toggleId } from './ActivityList';
import { mockActivities } from '../dev/mockActivities';

describe('summarize', () => {
  it('sumuje dystans, czas i przewyższenie oraz wskazuje najdłuższy bieg', () => {
    const runs = mockActivities().slice(0, 7);
    const s = summarize(runs);
    expect(s.count).toBe(7);
    expect(s.distance).toBeCloseTo(64200);
    expect(s.time).toBe(385 * 60);
    expect(s.elevation).toBe(1222);
    expect(s.longestId).toBe(runs[2].id);
  });

  it('pusta lista i jeden bieg: bez odznaki, brak przewyższenia liczy się jako 0', () => {
    expect(summarize([])).toMatchObject({ count: 0, distance: 0, longestId: undefined });
    const [one] = mockActivities();
    expect(summarize([{ ...one, total_elevation_gain: undefined }])).toMatchObject({ elevation: 0, longestId: undefined });
  });
});

describe('zaznaczanie', () => {
  it('toggleId dodaje i usuwa; Together od 2 do 50 biegów', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3]);
    expect([0, 1, 2, 50, 51].map(canAnimateTogether)).toEqual([false, false, true, true, false]);
    expect(MAX_TOGETHER).toBe(50);
  });
});

describe('mergePage', () => {
  const all = mockActivities();
  it('bez powtórek id, limit, hasMore tylko gdy strona pełna i pod limitem', () => {
    expect(mergePage(all.slice(0, 3), all.slice(2, 6), false, 200)).toEqual({ runs: all.slice(0, 6), hasMore: true });
    expect(mergePage(all.slice(0, 3), all.slice(3, 6), true, 200).hasMore).toBe(false);
    expect(mergePage(all.slice(0, 3), all.slice(3, 10), false, 5)).toEqual({ runs: all.slice(0, 5), hasMore: false });
  });
});
