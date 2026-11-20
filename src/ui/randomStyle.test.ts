import { describe, expect, it } from 'vitest';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { available } from '../postcard/routeColor';
import { randomStyle } from './randomStyle';

const streams = mockStreams(mockActivities()[0]);
// Deterministyczne „losowanie”: kolejne ułamki z całego zakresu, łącznie z brzegami.
const seq = (n: number) => {
  let i = 0;
  return () => ((i++ * 0.137 + n * 0.071) % 1);
};

describe('randomStyle', () => {
  it('bez trasy nie losuje mapy, a styl linii jest zawsze dostępny', () => {
    for (let n = 0; n < 200; n++) {
      const s = randomStyle({ hasRoute: false, streams: null, keepBackground: false }, seq(n));
      expect(s.background?.kind).not.toBe('map');
      expect(available(s.routeColor, null)).toBe(true);
      const t = randomStyle({ hasRoute: true, streams, keepBackground: false }, seq(n));
      expect(available(t.routeColor, streams)).toBe(true);
    }
  });

  it('własne zdjęcie zostaje', () => {
    expect(randomStyle({ hasRoute: true, streams, keepBackground: true }).background).toBeNull();
  });

  it('rnd tuż pod 1 nie wychodzi poza listy', () => {
    const s = randomStyle({ hasRoute: true, streams, keepBackground: false }, () => 0.999999);
    expect(s.font).toBeDefined();
    expect(s.layout).toBeDefined();
    expect(s.background).not.toBeNull();
  });
});
