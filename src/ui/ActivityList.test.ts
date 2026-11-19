import { describe, expect, it } from 'vitest';
import { summarize } from './ActivityList';
import { mockActivities } from '../dev/mockActivities';

describe('summarize', () => {
  it('sumuje dystans, czas i przewyższenie oraz wskazuje najdłuższy bieg', () => {
    const runs = mockActivities();
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
