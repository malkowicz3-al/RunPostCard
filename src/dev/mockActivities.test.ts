import { describe, expect, it } from 'vitest';
import { decodePolyline } from '../lib/polyline';
import { encodePolyline, mockActivities } from './mockActivities';

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
