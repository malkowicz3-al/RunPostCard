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

  it('obrót o 90°: prostokąt obejmuje obrócony widok (tu ten sam, bo kwadrat wokół środka) i widok bez obrotu', () => {
    const [cx, cy] = CAMERA_CENTER;
    const view: [number, number, number, number] = [cx - 100, cy - 50, cx + 100, cy + 50];
    const [x0, y0, x1, y1] = backdropArea(view, { zoom: 1, x: 0, y: 0, angle: 90 }, 0);
    expect(x0).toBeCloseTo(cx - 50, 9);
    expect(x1).toBeCloseTo(cx + 50, 9);
    expect(y0).toBeCloseTo(cy - 100, 9);
    expect(y1).toBeCloseTo(cy + 100, 9);
    // Pod kątem 45° obszar zawiera i widok bez obrotu.
    const [r0, s0, r1, s1] = backdropArea(view, { zoom: 1, x: 0, y: 0, angle: 45 }, 0);
    expect(r0 <= cx - 100 && s0 <= cy - 50 && r1 >= cx + 100 && s1 >= cy + 50).toBe(true);
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
