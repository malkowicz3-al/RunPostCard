import { describe, expect, it } from 'vitest';
import { moveIndex } from './FontPicker';

describe('moveIndex', () => {
  it('strzałki przesuwają bez zawijania, Home/End skaczą na brzegi', () => {
    expect(moveIndex('ArrowDown', 3, 20)).toBe(4);
    expect(moveIndex('ArrowDown', 19, 20)).toBe(19);
    expect(moveIndex('ArrowUp', 0, 20)).toBe(0);
    expect(moveIndex('Home', 7, 20)).toBe(0);
    expect(moveIndex('End', 7, 20)).toBe(19);
    expect(moveIndex('a', 7, 20)).toBeNull();
  });
});
