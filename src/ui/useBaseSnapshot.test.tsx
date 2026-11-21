import { describe, expect, it } from 'vitest';
import { mockActivities } from '../dev/mockActivities';
import { sameBase } from './useBaseSnapshot';

const activity = mockActivities()[0];

describe('sameBase', () => {
  it('inna kamera: obraz mapy pasuje; inne tło, motyw lub mapa: nie', () => {
    const map = { major: 'M0 0L10 10' };
    const base = { activity, background: 'map' as const, map, theme: 'dark' as const, camera: { zoom: 1, x: 0, y: 0 } };
    expect(sameBase(base, { ...base, camera: { zoom: 2, x: 30, y: 5, angle: 40 } })).toBe(true);
    expect(sameBase(base, { ...base, theme: 'light' })).toBe(false);
    expect(sameBase(base, { ...base, map: { ...map } })).toBe(false);
    expect(sameBase(base, { ...base, refined: { rect: [0, 0, 1, 1], layers: map } })).toBe(false);
  });
});
