import { describe, expect, it } from 'vitest';
import {
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
