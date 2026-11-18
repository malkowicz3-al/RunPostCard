import { describe, expect, it } from 'vitest';
import { GRID, PIXEL_SIZE, SPRITES, spriteRects, spriteSize } from './pixel';

describe('sprite’y 8-bit', () => {
  it('prostokątne, jeden piksel 12 dla wszystkich, wymiary w wielokrotnościach siatki 24', () => {
    expect(GRID).toBe(24);
    expect(Object.keys(SPRITES)).not.toContain('dragon');
    for (const [name, rows] of Object.entries(SPRITES)) {
      for (const row of rows) expect(row.length, name).toBe(rows[0].length);
      expect(PIXEL_SIZE[name], name).toBe(12);
      const [w, h] = spriteSize(name);
      expect([w % GRID, h % GRID], name).toEqual([0, 0]);
    }
  });
});

describe('spriteRects', () => {
  it('scala poziome serie jednego koloru i pomija przezroczyste', () => {
    expect(spriteRects(['.kkg', 'gg..'])).toEqual([
      [1, 0, 2, 'k'],
      [3, 0, 1, 'g'],
      [0, 1, 2, 'g'],
    ]);
  });
});
