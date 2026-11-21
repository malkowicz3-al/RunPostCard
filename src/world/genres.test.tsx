import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hexToRgb } from '../lib/color';
import { FONTS } from '../lib/fonts';
import { BASE_KEYS, LINE_KEYS, MAP_KEYS } from '../lib/vectorMap';
import { GENRES, GENRE_IDS, genreDef } from './genres';

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
  it('pełna paleta, font z listy, bryły gatunku i kolory brył', () => {
    const shapes = {
      scifi: 'tower',
      fantasy: undefined,
      postapo: undefined,
      bright: undefined,
      christmas: 'gabled',
      newyear: 'plain',
      easter: 'gabled',
      valentine: 'gabled',
      medieval: undefined,
    };
    for (const id of GENRE_IDS) {
      const { theme } = GENRES[id];
      const style = theme.style();
      for (const key of MAP_KEYS) expect(style.colors[key], `${id}: ${key}`).toMatch(/^#[0-9a-f]{6}$/);
      for (const key of LINE_KEYS) expect(style.widths[key], `${id}: ${key}`).toBeGreaterThan(0);
      expect(FONTS[theme.font]).toBeDefined();
      expect(style.buildings3d).toBe(shapes[id]);
      for (const c of GENRES[id].accents) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // Wszystkie gatunki i warianty koloru Sci-fi.
  const all = [
    ...GENRE_IDS.map((id) => ({ id, name: id, theme: GENRES[id].theme })),
    ...GENRES.scifi.variants!.map((v) => ({ id: 'scifi', name: `scifi ${v.id}`, theme: genreDef('scifi', v.id).theme })),
  ];

  it('szczegóły mapy odcinają się od trasy (kontrast >= 2)', () => {
    for (const { name: id, theme } of all) {
      const route = theme.render({}).route.stroke!;
      for (const key of DETAIL_KEYS) expect(contrast(theme.style().colors[key], route), `${id}: ${key}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('id w defs i url(#…) z prefiksem world-<gatunek>-', () => {
    for (const { id, theme } of all) {
      const out = theme.render({ major: 'M0 0L10 10', mid: 'M0 5L10 5' });
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

  it('warianty Sci-fi: unikalne id, Violet bez obrotu, ta sama tożsamość; New world tylko w Sci-fi; tylko płasko Fantasy, Post-apo i Medieval', () => {
    const variants = GENRES.scifi.variants!;
    expect(new Set(variants.map((v) => v.id)).size).toBe(variants.length);
    expect(variants[0]).toMatchObject({ id: 'violet', hue: 0 });
    expect(genreDef('scifi')).toBe(GENRES.scifi);
    expect(genreDef('scifi', 'violet')).toBe(GENRES.scifi);
    expect(genreDef('fantasy', 'crimson')).toBe(GENRES.fantasy);
    const crimson = genreDef('scifi', 'crimson');
    expect(genreDef('scifi', 'crimson')).toBe(crimson);
    expect(crimson.accents).not.toEqual(GENRES.scifi.accents);
    expect(crimson.theme.style().background).not.toBe(GENRES.scifi.theme.style().background);
    for (const v of variants) {
      for (const c of [v.swatch, v.route, ...genreDef('scifi', v.id).accents]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(GENRE_IDS).toEqual(['scifi', 'fantasy', 'postapo', 'bright', 'christmas', 'newyear', 'easter', 'valentine', 'medieval']);
    expect(GENRE_IDS.filter((id) => GENRES[id].reseed)).toEqual(['scifi']);
    expect(GENRE_IDS.filter((id) => GENRES[id].flat)).toEqual(['fantasy', 'postapo', 'medieval']);
  });
});
