import { describe, expect, it } from 'vitest';
import { redactActivities } from './redact';

describe('redactActivities', () => {
  const raw = {
    id: 1,
    name: 'Morning loop',
    distance: 5000,
    start_latlng: [52.1, 21.0],
    end_latlng: [52.2, 21.1],
    map: { id: 'a1', summary_polyline: 'abcdef', polyline: 'abc' },
  };

  it('zamienia polyline na długość i usuwa start/koniec', () => {
    const [out] = redactActivities([raw]) as Record<string, any>[];
    expect(out.map.summary_polyline).toBe('[redacted, 6 chars]');
    expect(out.map.polyline).toBe('[redacted, 3 chars]');
    expect(out).not.toHaveProperty('start_latlng');
    expect(out).not.toHaveProperty('end_latlng');
  });

  it('zostawia pozostałe pola i nie zmienia wejścia', () => {
    const [out] = redactActivities([raw]) as Record<string, any>[];
    expect(out.name).toBe('Morning loop');
    expect(out.distance).toBe(5000);
    expect(out.map.id).toBe('a1');
    expect(raw.map.summary_polyline).toBe('abcdef');
    expect(raw.start_latlng).toEqual([52.1, 21.0]);
  });
});
