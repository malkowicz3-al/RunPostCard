import { describe, expect, it } from 'vitest';
import { MAX_TOGETHER, bibStyle, canAnimateTogether, mergePage, summarize, toggleId } from './ActivityList';
import { mockActivities } from '../dev/mockActivities';

describe('summarize', () => {
  it('sumuje dystans, czas i przewyższenie oraz wskazuje najdłuższy bieg', () => {
    const runs = mockActivities().slice(0, 7);
    const s = summarize(runs);
    expect(s.count).toBe(7);
    expect(s.distance).toBeCloseTo(73300);
    expect(s.time).toBe(434 * 60);
    expect(s.elevation).toBe(1222);
    expect(s.longestId).toBe(runs[6].id);
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

describe('bibStyle', () => {
  const run = (workout_type: number | null | undefined, distance = 8000, sport_type = 'Run') => bibStyle({ workout_type, distance, sport_type });

  it('typ biegu z workout_type; brak i 0 to zwykły trening', () => {
    expect([null, undefined, 0, 2, 3, 7].map((t) => run(t).kind)).toEqual(['training', 'training', 'training', 'long', 'workout', 'training']);
    expect([0, 2, 3].map((t) => run(t).tag)).toEqual(['TRAINING', 'LONG RUN', 'WORKOUT']);
    expect(run(2).tier).toBeUndefined();
  });

  it('zawody: dystans z tolerancją na granicach przedziałów', () => {
    const tier = (km: number) => run(1, km * 1000).tier;
    expect([40.5, 42.2, 43.5, 40.4, 50].map(tier)).toEqual(['marathon', 'marathon', 'marathon', 'race', 'race']);
    expect(run(1, 50000).tag).toBe('RACE · ULTRA');
    expect([20.5, 22, 22.01, 20.49].map(tier)).toEqual(['half', 'half', 'race', 'race']);
    expect([9.5, 10.6, 9.49, 10.61].map(tier)).toEqual(['10k', '10k', 'race', 'race']);
    expect([4.8, 5.3, 4.79, 5.31].map(tier)).toEqual(['5k', '5k', 'race', 'race']);
    expect(run(1, 21100).tag).toBe('RACE · HALF');
    expect(run(1, 15000).tag).toBe('RACE');
  });

  it('TrailRun dokłada wariant szlaku', () => {
    expect(run(0, 8000, 'TrailRun')).toMatchObject({ kind: 'training', trail: true, tag: 'TRAIL' });
    expect(run(2, 8000, 'TrailRun').tag).toBe('LONG RUN');
    expect(run(1, 10000, 'TrailRun')).toMatchObject({ kind: 'race', tier: '10k', trail: true });
    expect(run(0).trail).toBe(false);
  });
});
