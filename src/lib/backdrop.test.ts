import { describe, expect, it } from 'vitest';
import { backdropArea, backdropViewBox, nextBackdropArea } from './backdrop';
import { CAMERA_CENTER, DEFAULT_CAMERA } from './camera';

describe('backdropViewBox', () => {
  it('jednostka = 1080 / szerokość ramki, początek w rogu ramki', () => {
    // Ramka 540 px (2 jednostki na px) przesunięta o (100, 50) w kontenerze 1000x1200.
    const vb = backdropViewBox({ left: 0, top: 10, width: 1000, height: 1200 }, { left: 100, top: 60, width: 540, height: 960 });
    expect(vb).toEqual([-200, -100, 1800, 2300]);
  });
});

describe('backdropArea', () => {
  it('kamera stojąca: viewBox z marginesem', () => {
    expect(backdropArea([0, 0, 1000, 2000], DEFAULT_CAMERA, 0.1)).toEqual([-100, -200, 1100, 2200]);
  });

  it('zoom 2 wokół środka i przesunięcie: odwrotność transformacji kamery', () => {
    const [cx, cy] = CAMERA_CENTER;
    const area = backdropArea([cx - 100, cy - 100, cx + 100, cy + 100], { zoom: 2, x: 40, y: 0 }, 0);
    expect(area).toEqual([cx - 70, cy - 50, cx + 30, cy + 50]);
  });

  it('macierz skali y 0,5 podwaja zakres y', () => {
    const [cx, cy] = CAMERA_CENTER;
    const area = backdropArea([cx - 100, cy - 100, cx + 100, cy + 100], DEFAULT_CAMERA, 0, [1, 0, 0, 0.5, 0, 0]);
    expect(area).toEqual([cx - 100, 2 * (cy - 100), cx + 100, 2 * (cy + 100)]);
  });
});

describe('nextBackdropArea', () => {
  const vb: [number, number, number, number] = [0, 0, 1000, 2000];
  it('małe przesunięcie w marginesie zostawia obszar, wyjście poza niego albo inny zoom go zmienia', () => {
    const first = nextBackdropArea(null, vb, DEFAULT_CAMERA);
    expect(nextBackdropArea(first, vb, { zoom: 1, x: 50, y: 0 })).toBe(first);
    expect(nextBackdropArea(first, vb, { zoom: 1, x: 500, y: 0 })).not.toBe(first);
    expect(nextBackdropArea(first, vb, { zoom: 1.5, x: 0, y: 0 })).not.toBe(first);
  });

  it('inna macierz unieważnia obszar', () => {
    const first = nextBackdropArea(null, vb, DEFAULT_CAMERA, [1, 0, 0, 1, 0, 0]);
    expect(nextBackdropArea(first, vb, DEFAULT_CAMERA, [1, 0, 0, 1, 0, 0])).not.toBe(first);
    expect(nextBackdropArea(first, vb, DEFAULT_CAMERA, first.matrix)).toBe(first);
  });
});
