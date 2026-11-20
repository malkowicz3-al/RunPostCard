import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  formatCadence,
  formatElapsed,
  formatElevation,
  formatElevPerKm,
  formatRunType,
  formatSteps,
  formatStopped,
  formatWeekday,
  formatName,
  formatSpeedKmh,
  formatTime,
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatHeartRate,
  formatPace,
} from './format';

describe('formatDistanceKm', () => {
  it('zamienia metry na km z dwoma miejscami', () => {
    expect(formatDistanceKm(10420)).toBe('10.42');
  });
});

describe('formatDuration', () => {
  it('poniżej godziny m:ss', () => {
    expect(formatDuration(125)).toBe('2:05');
  });
  it('od godziny h:mm:ss', () => {
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('formatPace', () => {
  it('liczy tempo min/km', () => {
    // 10 km w 3000 s -> 300 s/km
    expect(formatPace(10000, 3000)).toBe('5:00');
  });
  it('nie zwraca 5:60', () => {
    // 1000 m w 359,6 s -> 359,6 s/km -> 6:00, nie 5:60
    expect(formatPace(1000, 359.6)).toBe('6:00');
  });
  it('dystans 0 daje myślnik', () => {
    expect(formatPace(0, 100)).toBe('–');
  });
});

describe('formatDate', () => {
  it('nie przelicza strefy czasowej', () => {
    expect(formatDate('2026-11-15T23:30:00Z')).toBe('15 Nov 2026');
  });
});

describe('formatHeartRate', () => {
  it('brak tętna daje myślnik', () => {
    expect(formatHeartRate(undefined)).toBe('–');
  });
  it('zaokrągla tętno', () => {
    expect(formatHeartRate(151.6)).toBe('152');
  });
});

describe('nowe dane slotów', () => {
  it('formatują wartości', () => {
    expect(formatElapsed(3725)).toBe('1:02:05');
    expect(formatElevation(123.6)).toBe('124');
    expect(formatElevation(0)).toBe('0');
    expect(formatSpeedKmh(3.05)).toBe('11.0');
    expect(formatCadence(86.4)).toBe('173');
    expect(formatTime('2026-11-15T07:05:00Z')).toBe('07:05');
  });
  it('brak, 0 albo NaN daje myślnik', () => {
    for (const v of [undefined, NaN, 0]) {
      expect(formatElapsed(v)).toBe(EMPTY);
      expect(formatSpeedKmh(v)).toBe(EMPTY);
      expect(formatCadence(v)).toBe(EMPTY);
    }
    expect(formatElevation(undefined)).toBe(EMPTY);
    expect(formatElevation(NaN)).toBe(EMPTY);
    expect(formatTime('nope')).toBe(EMPTY);
    expect(formatDate('')).toBe(EMPTY);
  });
  it('nazwa: przycięta do 28 znaków z wielokropkiem, pusta daje myślnik', () => {
    expect(formatName('  Morning loop ')).toBe('Morning loop');
    const long = formatName('A very long title to check how the tile wraps');
    expect(Array.from(long).length).toBeLessThanOrEqual(28);
    expect(long.endsWith('…')).toBe(true);
    expect(formatName('   ')).toBe(EMPTY);
  });
});

describe('dane z Activity bez strumieni', () => {
  it('postoje, przewyższenie na km, kroki, dzień tygodnia, typ biegu', () => {
    expect(formatStopped(1500, 1625)).toBe('2:05');
    expect(formatStopped(1500, 1400)).toBe('0:00');
    expect(formatStopped(1500, undefined)).toBe(EMPTY);
    expect(formatElevPerKm(123, 10000)).toBe('12.3');
    expect(formatElevPerKm(undefined, 10000)).toBe(EMPTY);
    expect(formatElevPerKm(50, 0)).toBe(EMPTY);
    // 85 kroków jednej nogi na minutę przez 20 min = 170 × 20 obu nóg.
    expect(formatSteps(85, 1200)).toBe('3,400');
    expect(formatSteps(undefined, 1200)).toBe(EMPTY);
    expect(formatWeekday('2026-11-15T23:30:00Z')).toBe('Sunday'); // bez przesunięcia na poniedziałek
    expect(formatWeekday('nope')).toBe(EMPTY);
    expect([0, null, undefined, 1, 2, 3, 9].map(formatRunType)).toEqual([
      'TRAINING', 'TRAINING', 'TRAINING', 'RACE', 'LONG RUN', 'WORKOUT', 'TRAINING',
    ]);
  });
});
