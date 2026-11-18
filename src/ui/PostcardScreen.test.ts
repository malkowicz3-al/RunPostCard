import { describe, expect, it } from 'vitest';
import { clampCamera, shouldOpenSlot } from './PostcardScreen';

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

describe('clampCamera', () => {
  it('ogranicza zoom do 1–4', () => {
    expect(clampCamera({ zoom: 9, x: 0, y: 0 }).zoom).toBe(4);
    expect(clampCamera({ zoom: 0.2, x: 0, y: 0 }).zoom).toBe(1);
  });

  it('przy zoomie 4 brzeg pola trasy da się przesunąć na środek', () => {
    // Lewy brzeg ROUTE_BOX (x = 90) jest 450 od środka; przy zoomie 4 potrzeba przesunięcia 1800.
    expect(clampCamera({ zoom: 4, x: 1800, y: 0 }).x).toBe(1800);
    expect(clampCamera({ zoom: 4, x: 0, y: -1840 }).y).toBe(-1840);
  });

  it('przy zoomie 1 środek trasy zostaje na płótnie', () => {
    expect(clampCamera({ zoom: 1, x: 5000, y: -5000 })).toEqual({ zoom: 1, x: 540, y: -720 });
  });
});
