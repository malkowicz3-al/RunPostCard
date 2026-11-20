import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hexToRgb } from '../lib/color';
import { FONTS } from '../lib/fonts';
import { BASE_KEYS, LINE_KEYS, MAP_KEYS } from '../lib/vectorMap';
import { GENRES, GENRE_IDS } from './genres';

const DETAIL_KEYS = MAP_KEYS.filter((k) => !BASE_KEYS.includes(k));

// Kontrast WCAG 2.x (1..21), jak w themes/index.test.tsx.
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('GENRES', () => {
  it('pełna paleta, font z listy, bryły gatunku, kolory brył i gęstość', () => {
    const shapes = { scifi: 'tower', fantasy: 'castle', postapo: 'voxel' };
    for (const id of GENRE_IDS) {
      const { theme } = GENRES[id];
      const style = theme.style();
      for (const key of MAP_KEYS) expect(style.colors[key], `${id}: ${key}`).toMatch(/^#[0-9a-f]{6}$/);
      for (const key of LINE_KEYS) expect(style.widths[key], `${id}: ${key}`).toBeGreaterThan(0);
      expect(FONTS[theme.font]).toBeDefined();
      expect(style.buildings3d).toBe(shapes[id]);
      for (const c of GENRES[id].accents) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      expect(GENRES[id].keep).toBeGreaterThan(0);
      expect(GENRES[id].keep).toBeLessThanOrEqual(1);
    }
  });

  it('szczegóły mapy odcinają się od trasy (kontrast >= 2)', () => {
    for (const id of GENRE_IDS) {
      const { theme } = GENRES[id];
      const route = theme.render({}).route.stroke!;
      for (const key of DETAIL_KEYS) expect(contrast(theme.style().colors[key], route), `${id}: ${key}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('id w defs i url(#…) z prefiksem world-<gatunek>-', () => {
    for (const id of GENRE_IDS) {
      const out = GENRES[id].theme.render({ major: 'M0 0L10 10', mid: 'M0 5L10 5' });
      const svg = renderToStaticMarkup(
        <svg>
          {out.scene}
          {out.overlay}
        </svg>,
      );
      const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
      const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
      expect(ids.length).toBeGreaterThan(0);
      for (const ref of [...ids, ...refs, out.route.filter!.slice(5, -1)]) expect(ref).toMatch(new RegExp(`^world-${id}-`));
    }
  });
});
