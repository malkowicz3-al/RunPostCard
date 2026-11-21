import { describe, expect, it } from 'vitest';
import { hexToRgb, mix, rgbToHex, shiftHue } from './color';

describe('color', () => {
  it('hex <-> rgb', () => {
    expect(hexToRgb('#ff2bd6')).toEqual([255, 43, 214]);
    expect(rgbToHex([255, 43, 214])).toBe('#ff2bd6');
    expect(rgbToHex([0, 5, 16])).toBe('#000510');
  });

  it('mix: końce i środek', () => {
    expect(mix('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mix('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('shiftHue: 0 i 360 bez zmian, obrót o 120 stopni, szary bez zmian', () => {
    for (const hex of ['#a45bff', '#120a2a', '#2ef2ff']) {
      expect(shiftHue(hex, 0)).toBe(hex);
      expect(shiftHue(hex, 360)).toBe(hex);
      expect(shiftHue(shiftHue(hex, 100), -100)).toBe(hex);
    }
    expect(shiftHue('#ff0000', 120)).toBe('#00ff00');
    expect(shiftHue('#ff0000', -120)).toBe('#0000ff');
    expect(shiftHue('#808080', 90)).toBe('#808080');
  });
});
