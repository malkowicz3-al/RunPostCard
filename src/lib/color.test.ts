import { describe, expect, it } from 'vitest';
import { hexToRgb, mix, rgbToHex } from './color';

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
});
