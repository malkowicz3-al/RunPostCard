import { describe, expect, it } from 'vitest';
import { coverRect } from './photo';

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
