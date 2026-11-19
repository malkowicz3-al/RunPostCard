import { describe, expect, it } from 'vitest';
import { NO_EDIT, coverRect, editRect, panEdit, zoomEdit } from './photo';

describe('coverRect', () => {
  it('poziome zdjęcie wypełnia wysokość, boki ucięte', () => {
    expect(coverRect(4000, 3000)).toEqual({ dx: -740, dy: 0, dw: 2560, dh: 1920 });
  });

  it('zdjęcie 9:16 bez zmian', () => {
    expect(coverRect(1080, 1920)).toEqual({ dx: 0, dy: 0, dw: 1080, dh: 1920 });
  });

  it('wąskie zdjęcie wypełnia szerokość, góra i dół ucięte', () => {
    expect(coverRect(500, 1000)).toMatchObject({ dw: 1080, dh: 2160, dy: -120 });
  });

  it('kwadrat', () => {
    expect(coverRect(1000, 1000)).toMatchObject({ dw: 1920, dh: 1920, dx: -420 });
  });

  it('zerowy wymiar to błąd', () => {
    expect(() => coverRect(0, 100)).toThrow();
  });
});

describe('editRect', () => {
  it('zoom 1 bez przesunięcia równe coverRect', () => {
    expect(editRect(4000, 3000, NO_EDIT)).toEqual(coverRect(4000, 3000));
    expect(editRect(500, 1000, NO_EDIT, 108, 192)).toEqual(coverRect(500, 1000, 108, 192));
  });

  it('zoom zmienia skalę, środek zostaje', () => {
    expect(editRect(1080, 1920, { ...NO_EDIT, zoom: 2 })).toEqual({ dx: -540, dy: -960, dw: 2160, dh: 3840 });
  });

  it('przesunięcie przycięte do krawędzi, zdjęcie zawsze wypełnia kadr', () => {
    const r = editRect(4000, 3000, { ...NO_EDIT, x: 5, y: -5 });
    expect([r.dx, r.dw, r.dh]).toEqual([0, 2560, 1920]);
    expect(r.dy).toBeCloseTo(0);
    const l = editRect(4000, 3000, { ...NO_EDIT, x: -1 });
    expect(l.dx + l.dw).toBe(1080);
  });

  it('panEdit: zdjęcie przesuwa się o tyle pikseli co palec, w granicach', () => {
    const moved = panEdit(NO_EDIT, 100, 50, 4000, 3000, 1080, 1920);
    expect(editRect(4000, 3000, moved).dx - coverRect(4000, 3000).dx).toBeCloseTo(100);
    expect(moved.y).toBe(0); // brak zapasu w pionie
    expect(panEdit(NO_EDIT, 5000, 0, 4000, 3000, 1080, 1920).x).toBe(1);
  });

  it('zoomEdit trzyma zakres 1..4', () => {
    expect(zoomEdit(NO_EDIT, 0.5).zoom).toBe(1);
    expect(zoomEdit({ ...NO_EDIT, zoom: 3 }, 2).zoom).toBe(4);
  });
});
