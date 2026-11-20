import { describe, expect, it } from 'vitest';
import { savesViaShare } from './ExportControls';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

describe('savesViaShare', () => {
  it('iPhone i iPad (iPadOS jak Mac z dotykiem): arkusz udostępniania', () => {
    expect(savesViaShare(IPHONE, 'iPhone', 5, true)).toBe(true);
    expect(savesViaShare(MAC, 'MacIntel', 5, true)).toBe(true);
  });

  it('Android, Mac bez dotyku i brak canShare: zwykłe pobranie', () => {
    expect(savesViaShare(ANDROID, 'Linux armv8l', 5, true)).toBe(false);
    expect(savesViaShare(MAC, 'MacIntel', 0, true)).toBe(false);
    expect(savesViaShare(IPHONE, 'iPhone', 5, false)).toBe(false);
  });
});
