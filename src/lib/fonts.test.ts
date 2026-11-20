import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fetchDataUrl } from './dataUrl';
import { FONTS, loadFontCss, type FontId } from './fonts';

vi.mock('./dataUrl', () => ({ fetchDataUrl: vi.fn() }));
const fetchMock = vi.mocked(fetchDataUrl);

describe('fonty pocztówki', () => {
  it('loadFontCss buduje @font-face z data URL', async () => {
    fetchMock.mockResolvedValueOnce('data:font/ttf;base64,AAAA');
    const css = await loadFontCss('bebas');
    expect(fetchMock).toHaveBeenCalledWith('/fonts/BebasNeue-Regular.ttf');
    expect(css).toContain("'Bebas Neue'");
    expect(css).toContain('data:font/ttf;base64,AAAA');
    expect(css).toContain('font-weight:400');
  });

  it('font zmienny deklaruje zakres grubości', async () => {
    fetchMock.mockResolvedValueOnce('data:font/ttf;base64,AAAA');
    expect(await loadFontCss('grotesk')).toContain('font-weight:300 700');
  });

  it('błąd pobrania daje undefined (fallback system-ui)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('404'));
    expect(await loadFontCss('bungee')).toBeUndefined();
  });

  it('20 fontów; każdy ma plik, licencję, unikalną rodzinę i rozsądną skalę', () => {
    const ids = Object.keys(FONTS) as FontId[];
    expect(ids).toHaveLength(26);
    const licenses = readdirSync('public/fonts/licenses');
    for (const id of ids) {
      expect(existsSync(`public/fonts/${FONTS[id].file}`), id).toBe(true);
      // Rdzeń nazwy pliku do pierwszego „-”, np. Orbitron-Variable.ttf → Orbitron-OFL.txt.
      const stem = FONTS[id].file.split('-')[0];
      expect(licenses.some((name) => name.startsWith(stem + '-')), id).toBe(true);
      expect(FONTS[id].scale).toBeGreaterThan(0);
      expect(FONTS[id].scale).toBeLessThanOrEqual(1.5);
    }
    expect(new Set(ids.map((id) => FONTS[id].family)).size).toBe(ids.length);
  });
});
