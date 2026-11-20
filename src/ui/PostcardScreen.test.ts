import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockActivities } from '../dev/mockActivities';
import { initialLook, shouldOpenSlot } from './PostcardScreen';

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


describe('initialLook', () => {
  const run = mockActivities()[0];
  afterEach(() => vi.unstubAllGlobals());
  it('bez trasy gradient, bo mapy nie ma z czego zrobić', () => {
    expect(initialLook({ ...run, map: { ...run.map, summary_polyline: '' } })).toBe('gradient');
  });
  it('mapa Light przy jasnym motywie systemu, inaczej Dark', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('light') }));
    expect(initialLook(run)).toBe('light');
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(initialLook(run)).toBe('dark');
    vi.stubGlobal('matchMedia', undefined);
    expect(initialLook(run)).toBe('dark');
  });
  it('nigdy World (świat tylko z wyboru)', () => {
    expect(initialLook(run)).not.toBe('world');
  });
});
