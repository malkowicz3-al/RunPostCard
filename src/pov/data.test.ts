import { describe, expect, it } from 'vitest';
import { geoMercator } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import { CLEAR_M, buildingsData, cameraAt, cameraPath, extrude, localFrame, ribbon, toLocal, track } from './data';

// Prosto na wschód ~3 km (Kraków), wysokość rośnie o 30 m.
const n = 200;
const east: RunStreams = {
  latlng: Array.from({ length: n }, (_, i) => [50.06, 19.9 + (0.042 * i) / (n - 1)]),
  distance: Array.from({ length: n }, (_, i) => (3000 * i) / (n - 1)),
  altitude: Array.from({ length: n }, (_, i) => 200 + (30 * i) / (n - 1)),
};
const proj = geoMercator().fitExtent(
  [
    [80, 300],
    [1000, 1500],
  ],
  { type: 'LineString', coordinates: east.latlng.map(([la, lo]) => [lo, la]) },
);

describe('pov data', () => {
  it('lokalny układ: metry od środka trasy, wschód = +x', () => {
    const pts = east.latlng.map(([la, lo]) => proj([lo, la]) as [number, number]);
    const f = localFrame(proj, pts);
    const [xa] = toLocal(f, pts[0]);
    const [xb] = toLocal(f, pts[n - 1]);
    expect(xb - xa).toBeGreaterThan(2900);
    expect(xb - xa).toBeLessThan(3100);
    expect(xa + xb).toBeCloseTo(0, 3);
  });

  it('kamera za biegaczem i nad nim, rośnie po dystansie, nigdy pod terenem', () => {
    const { track: t } = track(east, proj, null);
    const hill = (x: number) => 300 + Math.sin(x / 200) * 100; // teren wyżej niż trasa
    const path = cameraPath(t, hill);
    let prev = -Infinity;
    for (let k = 0; k <= 100; k++) {
      const { eye, look, runner } = cameraAt(path, k / 100);
      expect(eye[1]).toBeGreaterThanOrEqual(hill(eye[0]) + CLEAR_M - 1e-6);
      expect(look[0]).toBeGreaterThan(runner[0]);
      expect(runner[0]).toBeGreaterThanOrEqual(prev);
      prev = runner[0];
    }
    const flat = cameraPath(t, () => 0);
    const mid = cameraAt(flat, 0.5);
    expect(mid.runner[0] - mid.eye[0]).toBeCloseTo(150, 0);
    expect(mid.eye[1] - mid.runner[1]).toBeCloseTo(80, 0);
  });

  it('wstęga: 2 wierzchołki na próbkę, kolory bez NaN', () => {
    const { track: t } = track(east, proj, null);
    const m = ribbon(t, 5, (f) => (f < 0.5 ? '#ff0000' : '#0000ff'));
    expect(m.positions.length).toBe(t.pos.length * 6);
    expect(m.index.length).toBe((t.pos.length - 1) * 6);
    expect([...m.positions, ...m.colors].every(Number.isFinite)).toBe(true);
    expect([...m.colors.slice(0, 3)]).toEqual([1, 0, 0]);
    expect([...m.colors.slice(-3)]).toEqual([0, 0, 1]);
  });

  it('bryła z obrysu: ściany i dach na wysokości', () => {
    const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    const v = extrude(square, 2, 12);
    expect(v.length).toBe((4 * 2 + 2) * 9); // 4 ściany po 2 trójkąty + dach z 2 trójkątów
    const ys = v.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(12);
    const f = { cx: 0, cy: 0, m: 1 };
    expect(buildingsData([{ ring: square, h: 10, min: 0 }], f, () => 5).filter((_, i) => i % 3 === 1).every((y) => y >= 5)).toBe(true);
  });
  it('2 identyczne punkty: bez NaN w trasie, kamerze i wstędze', () => {
    const one: RunStreams = { latlng: [[50.06, 19.9], [50.06, 19.9]], distance: [0, 0], altitude: [200, 200] };
    const { track: t, ground } = track(one, proj, null);
    const path = cameraPath(t, ground);
    const m = ribbon(t, 5, () => '#ff0000');
    const nums = [...t.pos.flat(), ...path.eye.flat(), ...path.look.flat(), ...Object.values(cameraAt(path, 0.5)).flat(), ...m.positions, ...m.colors];
    expect(nums.every(Number.isFinite)).toBe(true);
  });
});
