import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32 } from './rng';

describe('rng', () => {
  it('mulberry32: ten sam ciąg dla ziarna, wartości w [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });

  it('hashSeed stały i różny dla różnych części', () => {
    expect(hashSeed(1, 'scifi', 2, 3, 'b')).toBe(hashSeed(1, 'scifi', 2, 3, 'b'));
    expect(hashSeed(1, 'scifi', 2, 3, 'b')).not.toBe(hashSeed(1, 'scifi', 3, 2, 'b'));
    expect(hashSeed(12, 3)).not.toBe(hashSeed(1, 23));
    expect(Number.isInteger(hashSeed('x'))).toBe(true);
    expect(hashSeed('x')).toBeGreaterThanOrEqual(0);
  });
});
