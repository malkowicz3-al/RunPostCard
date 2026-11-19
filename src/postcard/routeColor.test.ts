import { describe, expect, it } from 'vitest';
import type { RunStreams } from '../strava/api';
import { zoneOf } from '../lib/chartData';
import { ZONE_COLORS } from './SlotChart';
import { PACE_RAMP, ELEVATION_RAMP, available, colorScale, ramp, segments, trimAt, type RouteColor } from './routeColor';

const colorAt = (mode: RouteColor, t: number, s?: RunStreams | null, fallback = '#ffffff') => colorScale(mode, s)?.(t) ?? fallback;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const n = 101;
const distance = Array.from({ length: n }, (_, i) => i * 50); // 5 km
const latlng = distance.map(() => [0, 0] as [number, number]);
// Pierwsza połowa szybko, druga wolno; wysokość rośnie; tętno od 100 do 190.
const streams: RunStreams = {
  latlng,
  distance,
  velocity: distance.map((_, i) => (i < 50 ? 4 : 2.5)),
  altitude: distance.map((_, i) => 100 + i),
  heartrate: distance.map((_, i) => 100 + 0.9 * i),
};
const HEX = /^#[0-9a-f]{6}$/;

describe('routeColor', () => {
  it('theme i brak danych: kolor zapasowy; dostępność wg strumieni', () => {
    expect(colorScale('theme', streams)).toBeNull();
    expect(colorAt('theme', 0.5, streams, '#123456')).toBe('#123456');
    for (const mode of ['pace', 'heartrate', 'elevation'] as const) {
      expect(colorAt(mode, 0.5, null, '#123456')).toBe('#123456');
      expect(available(mode, null)).toBe(false);
      expect(available(mode, streams)).toBe(true);
      expect(available(mode, { latlng, distance })).toBe(false);
    }
    expect(available('rainbow', null)).toBe(true);
  });

  it('rainbow: hue t*300, t poza zakresem przycięte', () => {
    expect(colorAt('rainbow', 0)).toBe(colorAt('rainbow', -3));
    expect(colorAt('rainbow', 1)).toBe(colorAt('rainbow', 7));
    expect(colorAt('rainbow', 0)).toMatch(/^#f/); // czerwony
    expect(colorAt('rainbow', NaN)).toMatch(HEX);
  });

  it('pace: szybko niebiesko, wolno ciepło; stałe tempo jeden kolor', () => {
    expect(colorAt('pace', 0.1, streams)).toBe(PACE_RAMP[0]);
    expect(colorAt('pace', 0.9, streams)).toBe(PACE_RAMP[PACE_RAMP.length - 1]);
    const flat = { ...streams, velocity: distance.map(() => 3) };
    const colors = new Set([0, 0.3, 0.7, 1].map((t) => colorAt('pace', t, flat)));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toMatch(HEX);
  });

  it('pace na maratonie: pojedynczy skok prędkości nie daje odstającego koloru', () => {
    const d = Array.from({ length: 14001 }, (_, i) => i * 3); // 42 km, próbka co 3 m
    const velocity = d.map((x) => 2 + (2 * x) / 42000);
    const spike = d.findIndex((x) => x >= 21070); // trafia w próbkę koloru przy t = 0,5
    velocity[spike] = velocity[spike + 1] = 6;
    const scale = colorScale('pace', { latlng: d.map(() => [0, 0]), distance: d, velocity })!;
    const at = rgb(scale(0.5));
    const near = rgb(scale(0.5 - 1 / 299));
    expect(Math.max(...at.map((v, k) => Math.abs(v - near[k])))).toBeLessThan(128); // bez wygładzenia: najszybszy kolor, różnica ok. 200
    expect(scale(0.5)).not.toBe(PACE_RAMP[0]);
  });

  it('heartrate: kolory stref; elevation od zieleni do czerwieni', () => {
    expect(colorAt('heartrate', 0, streams)).toBe(ZONE_COLORS[zoneOf(100, 190)]);
    expect(colorAt('heartrate', 1, streams)).toBe(ZONE_COLORS[4]);
    expect(colorAt('elevation', -1, streams)).toBe(ELEVATION_RAMP[0]);
    expect(colorAt('elevation', 2, streams)).toBe(ELEVATION_RAMP[2]);
    expect(ramp(ELEVATION_RAMP, 0.5)).toBe(ELEVATION_RAMP[1]);
  });

  it('segments: n odcinków o równej długości, ciągłe, t rosnące', () => {
    const segs = segments(
      [
        [0, 0],
        [100, 0],
        [100, 50],
      ],
      6,
    );
    expect(segs).toHaveLength(6);
    expect(segs.map((s) => s.start)).toEqual([0, 25, 50, 75, 100, 125]);
    expect(segs[3].d).toBe('M75.0 0.0L100.0 0.0');
    expect(segs[4].d).toMatch(/^M100\.0 0\.0.*L100\.0 25\.0$/); // przez narożnik
    expect(segs[5].d).toBe('M100.0 25.0L100.0 50.0');
    expect(segments([[1, 1], [1, 1]])).toEqual([]);
    // along (dystans ze strumieni): t wg niego, nie wg długości na ekranie.
    const byDistance = segments([[0, 0], [100, 0], [100, 50]], 6, [0, 10, 110]);
    expect(byDistance[0].t).toBeCloseTo((12.5 / 100) * 10 / 110);
    expect(byDistance[5].t).toBeCloseTo((10 + (125 + 12.5 - 100) / 50 * 100) / 110);
  });
});

describe('trimAt', () => {
  const pts: [number, number][] = [[0, 0], [10, 0], [20, 0], [40, 0]];
  it('ułamek długości ekranu albo dystansu, z punktem cięcia na końcu', () => {
    expect(trimAt(pts, 0.5).pts(pts)).toEqual([[0, 0], [10, 0], [20, 0]]);
    expect(trimAt(pts, 0.25).pts(pts)).toEqual([[0, 0], [10, 0]]);
    expect(trimAt(pts, 0).pts(pts)).toEqual([[0, 0], [0, 0]]);
    const cut = trimAt(pts, 0.5, [0, 100, 200, 300]); // po dystansie: połowa w środku odcinka 1→2
    expect(cut.pts(pts)).toEqual([[0, 0], [10, 0], [15, 0]]);
    expect(cut.nums([0, 100, 200, 300])).toEqual([0, 100, 150]);
    expect(cut.each(['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c']);
    expect(trimAt([[1, 1]], 0.5).pts([[1, 1]])).toEqual([[1, 1]]);
  });
});
