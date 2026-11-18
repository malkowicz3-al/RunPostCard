import { describe, expect, it } from 'vitest';
import { spriteRects } from './pixel';

describe('spriteRects', () => {
  it('scala poziome serie jednego koloru i pomija przezroczyste', () => {
    expect(spriteRects(['.kkg', 'gg..'])).toEqual([
      [1, 0, 2, 'k'],
      [3, 0, 1, 'g'],
      [0, 1, 2, 'g'],
    ]);
  });
});
