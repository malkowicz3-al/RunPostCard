import { describe, expect, it } from 'vitest';
import { cameraTransform, clampCamera } from './camera';

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

describe('cameraTransform', () => {
  it('skala wokół środka pola trasy (540, 720) + przesunięcie', () => {
    expect(cameraTransform({ zoom: 2, x: 10, y: -20 })).toBe('translate(-530 -740) scale(2)');
  });
});
