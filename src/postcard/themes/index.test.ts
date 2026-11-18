import { describe, expect, it } from 'vitest';
import { PIXEL, POSTCARD } from '../../lib/vectorMap';
import { shownTheme } from './index';

describe('shownTheme', () => {
  it('rysuje wybrany motyw, gdy dane pasują do jego profilu', () => {
    expect(shownTheme('fantasy', 'minimal', POSTCARD)).toBe('fantasy');
    expect(shownTheme('pixel', 'minimal', PIXEL)).toBe('pixel');
  });

  it('zostaje przy poprzednim motywie, dopóki nie przyjdą dane nowego profilu', () => {
    expect(shownTheme('pixel', 'minimal', POSTCARD)).toBe('minimal');
    expect(shownTheme('minimal', 'pixel', PIXEL)).toBe('pixel');
    expect(shownTheme('minimal', 'minimal', undefined)).toBe('minimal');
  });
});
