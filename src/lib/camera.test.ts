import { describe, expect, it } from 'vitest';
import { applyCamera, cameraTransform, clampCamera, keepCamera, twistDegrees, unapplyCamera, wrapAngle } from './camera';

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

describe('applyCamera', () => {
  it('ten sam punkt co cameraTransform', () => {
    // translate(-530 -740) scale(2): (100, 50) -> (-330, -640)
    expect(applyCamera({ zoom: 2, x: 10, y: -20 }, [100, 50])).toEqual([-330, -640]);
  });
});

describe('obrót kamery', () => {
  const cam = { zoom: 2, x: 10, y: -20, angle: 30 };

  it('napis z rotate wokół środka; applyCamera liczy to samo', () => {
    expect(cameraTransform(cam)).toBe('translate(550 700) scale(2) rotate(30) translate(-540 -720)');
    // (640, 720): 100 w prawo od środka -> obrót o 30°, skala 2, przesunięcie.
    const [x, y] = applyCamera(cam, [640, 720]);
    expect(x).toBeCloseTo(550 + 200 * Math.cos(Math.PI / 6), 9);
    expect(y).toBeCloseTo(700 + 200 * Math.sin(Math.PI / 6), 9);
  });

  it('unapplyCamera odwraca applyCamera', () => {
    for (const c of [cam, { zoom: 3, x: -40, y: 5 }, { ...cam, angle: -135 }]) {
      const [x, y] = unapplyCamera(c, applyCamera(c, [123, 456]));
      expect(x).toBeCloseTo(123, 9);
      expect(y).toBeCloseTo(456, 9);
    }
  });

  it('wrapAngle: 190 -> -170, 180 zostaje', () => {
    expect(wrapAngle(190)).toBe(-170);
    expect(wrapAngle(180)).toBe(180);
    expect(wrapAngle(-180)).toBe(-180);
    expect(wrapAngle(-540)).toBe(-180);
    expect(wrapAngle(725)).toBe(5);
  });

  it('clampCamera: kąt zawinięty, przy 90° zakres przesunięcia z obróconego pola', () => {
    expect(clampCamera({ zoom: 1, x: 0, y: 0, angle: 190 }).angle).toBe(-170);
    expect(clampCamera({ zoom: 1, x: 0, y: 0, angle: 0 })).toEqual({ zoom: 1, x: 0, y: 0 });
    // Połówki pola trasy 450 × 460: przy 90° się zamieniają (x do 4·460, y do 4·450).
    const c = clampCamera({ zoom: 4, x: 5000, y: -5000, angle: 90 });
    expect(c.x).toBeCloseTo(1840, 6);
    expect(c.y).toBeCloseTo(-1800, 6);
  });

  it('clampCamera: płasko z obrotem oddalenie do zmieszczenia obróconego pola, w 3D bez obrotu pola', () => {
    // 45°: połówki 450 × 460 -> obrócone 450·cos + 460·sin; min zoom = 450 / (910·√½).
    const min45 = 450 / (910 * Math.SQRT1_2);
    expect(clampCamera({ zoom: 0.1, x: 0, y: 0, angle: 45 }).zoom).toBeCloseTo(min45, 9);
    expect(clampCamera({ zoom: 0.1, x: 0, y: 0, angle: 90 }).zoom).toBeCloseTo(450 / 460, 9);
    expect(clampCamera({ zoom: 0.1, x: 0, y: 0 }).zoom).toBe(1);
    const c3 = clampCamera({ zoom: 0.1, x: 5000, y: -5000, angle: 90 }, true);
    expect(c3).toEqual({ zoom: 1, x: 540, y: -720, angle: 90 });
  });

  it('keepCamera: inny kąt to nowy obiekt, brak kąta = 0', () => {
    const prev = { zoom: 1, x: 0, y: 0 };
    expect(keepCamera(prev, { ...prev, angle: 0 })).toBe(prev);
    expect(keepCamera(prev, { ...prev, angle: 5 })).not.toBe(prev);
  });

  it('twistDegrees: zmiana kierunku od drugiego palca, w (−180, 180]', () => {
    expect(twistDegrees([10, 0], [0, 10], [0, 0])).toBeCloseTo(90, 9);
    expect(twistDegrees([0, 10], [10, 0], [0, 0])).toBeCloseTo(-90, 9);
    // Przejście przez oś ujemną: 170° -> -170° to +20°, nie -340°.
    const at = (deg: number): [number, number] => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    expect(twistDegrees(at(170), at(-170), [0, 0])).toBeCloseTo(20, 9);
  });
});
