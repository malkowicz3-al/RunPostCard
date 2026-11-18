import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from './random';

const take = (rand: () => number, n: number) => Array.from({ length: n }, rand);

describe('random', () => {
  it('to samo ziarno daje tę samą sekwencję, inne ziarno inną', () => {
    expect(take(mulberry32(42), 20)).toEqual(take(mulberry32(42), 20));
    expect(take(mulberry32(42), 20)).not.toEqual(take(mulberry32(43), 20));
  });

  it('wartości w [0, 1)', () => {
    for (const v of take(mulberry32(hashSeed('x')), 10000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashSeed stabilny', () => {
    // Wzorcowa wartość FNV-1a 32-bit dla "a".
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed(12345678901, 'trees')).toBe(hashSeed('12345678901:trees'));
    expect(hashSeed(12345678901, 'trees')).not.toBe(hashSeed(12345678901, 'castles'));
  });
});
