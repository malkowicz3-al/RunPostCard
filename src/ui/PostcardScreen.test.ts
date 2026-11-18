import { describe, expect, it } from 'vitest';
import { shouldOpenSlot } from './PostcardScreen';

describe('shouldOpenSlot', () => {
  const down = { x: 100, y: 100 };
  const base = { down, multiTouch: false, keyboard: false };
  it('dotknięcie otwiera, przeciągnięcie > 6 px nie', () => {
    expect(shouldOpenSlot({ ...base, up: { x: 104, y: 103 } })).toBe(true);
    expect(shouldOpenSlot({ ...base, up: { x: 110, y: 100 } })).toBe(false);
  });
  it('szczypanie albo brak wciśnięcia nie otwiera', () => {
    expect(shouldOpenSlot({ ...base, up: down, multiTouch: true })).toBe(false);
    expect(shouldOpenSlot({ ...base, down: null, up: down })).toBe(false);
  });
  it('klawiatura zawsze otwiera', () => {
    expect(shouldOpenSlot({ down: null, up: { x: 0, y: 0 }, multiTouch: false, keyboard: true })).toBe(true);
  });
});

