import { describe, expect, it } from 'vitest';
import { decodePolyline } from '../lib/polyline';
import { encodePolyline, mockActivities, mockStreams } from './mockActivities';

describe('encodePolyline', () => {
  it('koduje przykład z dokumentacji Google', () => {
    const points: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });

  it('dekodowanie odwraca kodowanie', () => {
    const points: [number, number][] = [
      [50.0647, 19.945],
      [50.07, 19.9],
      [50.05, 19.99],
    ];
    const decoded = decodePolyline(encodePolyline(points));
    expect(decoded).toHaveLength(3);
    decoded.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(points[i][0], 5);
      expect(lng).toBeCloseTo(points[i][1], 5);
    });
  });

  it('mock daje biegi z trasą, którą da się zdekodować', () => {
    const runs = mockActivities();
    expect(runs).toHaveLength(6);
    for (const run of runs) {
      expect(decodePolyline(run.map.summary_polyline).length).toBeGreaterThan(10);
    }
  });
});

describe('mockStreams', () => {
  const runs = mockActivities();

  it('deterministyczne, równe długości, dystans rosnący do activity.distance', () => {
    for (const run of runs) {
      const s = mockStreams(run);
      expect(mockStreams(run)).toEqual(s);
      const n = s.latlng.length;
      for (const key of ['distance', 'time', 'altitude', 'velocity'] as const) expect(s[key]).toHaveLength(n);
      for (let i = 1; i < n; i++) expect(s.distance[i]).toBeGreaterThan(s.distance[i - 1]);
      expect(s.distance[n - 1]).toBeCloseTo(run.distance, 6);
    }
  });

  it('bieg bez tętna nie ma strumienia tętna', () => {
    const noHr = runs.find((r) => !r.average_heartrate)!;
    expect(mockStreams(noHr).heartrate).toBeUndefined();
    expect(mockStreams(runs[0]).heartrate).toHaveLength(mockStreams(runs[0]).latlng.length);
  });

  it('nowe pola są w mocku; bieg bez tętna nie ma też max tętna ani kadencji', () => {
    for (const run of runs) {
      expect(run.elapsed_time).toBeGreaterThan(run.moving_time);
      expect(run.total_elevation_gain).toBeGreaterThan(0);
      expect(run.max_speed!).toBeGreaterThan(run.average_speed!);
    }
    const noHr = runs.find((r) => !r.average_heartrate)!;
    expect(noHr.max_heartrate).toBeUndefined();
    expect(noHr.average_cadence).toBeUndefined();
    expect(runs[0].max_heartrate).toBe(172);
  });

  it('Hill repeats ma kilka wzgórz', () => {
    const alt = mockStreams(runs.find((r) => r.name === 'Hill repeats')!).altitude!;
    const peaks = alt.filter((a, i) => i > 0 && i < alt.length - 1 && a > alt[i - 1] && a > alt[i + 1]);
    expect(peaks.length).toBeGreaterThan(1);
  });
});
