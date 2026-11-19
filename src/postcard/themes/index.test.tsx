import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hexToRgb, mix } from '../../lib/color';
import { BASE_KEYS, LINE_KEYS, MAP_KEYS } from '../../lib/vectorMap';
import { mockActivities, mockStreams } from '../../dev/mockActivities';
import { FONTS } from '../../lib/fonts';
import { Postcard } from '../Postcard';
import { THEMES, type ThemeId } from './index';
import { DEFAULT_ACCENT, NEON_ACCENTS, neonStyle, visibleAccent } from './neon';

const LAYERS = {
  water: 'M0 0L50 0L50 50Z',
  major: 'M0 100L500 100',
  building: 'M10 10L20 10L20 20Z',
  rail: 'M0 200L500 200',
  landuse: 'M0 0L90 0L90 90Z',
  // Bryły 3D (w widoku płaskim pomijane); druga w ostrzejszym fragmencie testu refined.
  buildings: [
    { ring: [[10, 10], [20, 10], [20, 20]] as [number, number][], h: 30, min: 0 },
    { ring: [[300, 400], [340, 400], [340, 450], [300, 450]] as [number, number][], h: 10, min: 2 },
    // Duża i wysoka: detale wariantów brył (okna, blanki, anteny, kondygnacje).
    { ring: [[500, 700], [800, 700], [800, 820], [500, 820]] as [number, number][], h: 60, min: 0 },
  ],
};

const DETAIL_KEYS = MAP_KEYS.filter((k) => !BASE_KEYS.includes(k));

// Kontrast WCAG 2.x (1..21).
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

describe('THEMES', () => {
  it('motywy w kolejności Dark, Light, Neon, Ocean, Forest, Sunset, Mint, Mono, Blueprint, Pencil, Watercolor, Vintage, Riso, Chalk, Halftone, Synthwave, Terminal, Ink i motywy popkultury oraz gier', () => {
    expect(Object.values(THEMES).map((t) => t.label)).toEqual([
      'Dark',
      'Light',
      'Neon',
      'Ocean',
      'Forest',
      'Sunset',
      'Mint',
      'Mono',
      'Blueprint',
      'Pencil',
      'Watercolor',
      'Vintage',
      'Riso',
      'Chalk',
      'Halftone',
      'Synthwave',
      'Terminal',
      'Ink',
      'Digital Rain',
      'Light Grid',
      'Galaxy',
      'Desert',
      'Red Fog',
      'Spellbook',
      'Pop Comic',
      'Bricks',
      'Arcade Maze',
      'Dollhouse',
      'Handheld',
      'Vector Arcade',
      'Dungeon',
      'Space Shooter',
      'Voxel',
      'Night Vision',
      'Kart Race',
      'Cyber HUD',
      'Overworld',
      'Pinball',
    ]);
  });

  it('font każdego motywu jest na liście fontów', () => {
    for (const theme of Object.values(THEMES)) expect(FONTS[theme.font], theme.label).toBeDefined();
    expect(THEMES.pencil.font).toBe('marker');
  });

  it('każdy motyw ma kolor dla każdego klucza i grubość dla każdej linii', () => {
    for (const theme of Object.values(THEMES)) {
      const style = theme.style();
      for (const key of MAP_KEYS) expect(style.colors[key], `${theme.label}: ${key}`).toMatch(/^#[0-9a-f]{6}$/);
      for (const key of LINE_KEYS) expect(style.widths[key], `${theme.label}: ${key}`).toBeGreaterThan(0);
    }
  });

  it('szczegóły mapy odcinają się od trasy (kontrast >= 2)', () => {
    const cases = Object.values(THEMES).flatMap((theme) =>
      (theme === THEMES.neon ? NEON_ACCENTS.map(([c]) => c) : [undefined]).map((accent) => ({
        name: `${theme.label} ${accent ?? ''}`,
        style: theme.style({ accent }),
        route: theme.render({}, { accent }).route.stroke!,
      })),
    );
    for (const { name, style, route } of cases)
      for (const key of DETAIL_KEYS)
        expect(contrast(style.colors[key], route), `${name}: ${key}`).toBeGreaterThanOrEqual(2);
  });

  it('kolej rysowana przerywaną linią', () => {
    const svg = renderToStaticMarkup(<svg>{THEMES.dark.render(LAYERS).scene}</svg>);
    expect(svg).toMatch(/d="M0 200L500 200"[^>]*stroke-dasharray="10 6"/);
  });

  it('każde url(#id) w pocztówce (płaskiej, 3D i obu z ostrzejszą mapą) wskazuje element z tego SVG, id unikalne', () => {
    const hills = mockActivities().find((r) => r.name === 'Hill repeats')!;
    const streams = mockStreams(hills);
    const refined = { rect: [100, 200, 600, 900] as [number, number, number, number], layers: LAYERS };
    for (const id of Object.keys(THEMES) as ThemeId[]) {
      const variants = {
        flat: <Postcard activity={hills} background="map" map={LAYERS} theme={id} />,
        'flat-refined': <Postcard activity={hills} background="map" map={LAYERS} theme={id} refined={refined} />,
        '3d': <Postcard activity={hills} background="map" map={LAYERS} theme={id} streams={streams} view="3d" />,
        refined: (
          <Postcard activity={hills} background="map" map={LAYERS} theme={id} streams={streams} view="3d" refined={refined} />
        ),
      };
      for (const [name, el] of Object.entries(variants)) {
        const svg = renderToStaticMarkup(el);
        const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
        for (const ref of refs) expect(svg, `${id} ${name}: #${ref}`).toContain(`id="${ref}"`);
        const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
        expect(new Set(ids).size, `${id} ${name}: id unikalne`).toBe(ids.length);
        expect(svg, `${id} ${name}: NaN`).not.toContain('NaN');
        // Ściany brył w obu odcieniach (kwadrat w izometrii pokazuje lewą i prawą ścianę).
        if (name === '3d' || name === 'refined')
          for (const t of [0.45, 0.25])
            expect(svg, `${id} ${name}: ściany`).toContain(`fill="${mix(THEMES[id].style().colors.building, '#000000', t)}"`);
        if (THEMES[id].style().buildings3d === 'tower' && name !== 'flat' && name !== 'flat-refined')
          expect(svg, `${id} ${name}: neon brył`).toContain(`stroke="${THEMES[id].style().colors.mid}"`);
        if (id === 'neon') expect(refs.length).toBeGreaterThan(0);
        if (id === 'blueprint') expect(svg).toContain('id="blueprint-grid"');
        // fills: kreskowanie wskazuje wzór z tej samej pocztówki.
        if (id === 'pencil') expect(refs).toContain('pencil-hatch-building');
        if (id === 'vintage') expect(refs).toContain('vintage-water');
        if (id === 'riso') expect(refs).toContain('riso-route');
        // Nakładka papieru (overlay) jest też w 3D i nad ostrzejszym fragmentem.
        if (['pencil', 'watercolor', 'vintage', 'riso', 'chalk', 'halftone', 'ink'].includes(id))
          expect(refs, `${id} ${name}`).toContain(`${id}-grain`);
        if (id === 'terminal') expect(refs, `${id} ${name}`).toContain('terminal-scanlines');
        if (id === 'halftone') expect(refs).toContain('halftone-building');
        if (id === 'synthwave') expect(refs).toContain('synthwave-sky');
        const overlays: Partial<Record<ThemeId, string>> = {
          digitalrain: 'digitalrain-rain',
          galaxy: 'galaxy-stars',
          dune: 'dune-grain',
          redfog: 'redfog-fog',
          spellbook: 'spellbook-grain',
          dollhouse: 'dollhouse-gloss',
          handheld: 'handheld-pixels',
          dungeon: 'dungeon-dark',
          spaceshooter: 'spaceshooter-stars',
          nightvision: 'nightvision-noise',
          cyberhud: 'cyberhud-grid',
        };
        if (overlays[id]) expect(refs, `${id} ${name}`).toContain(overlays[id]);
        if (id === 'arcademaze') expect(refs).toContain('arcademaze-walls');
        if (id === 'bricks') expect(refs).toContain('bricks-route');
        if (id === 'voxel') expect(refs).toContain('voxel-planks');
        if (id === 'overworld') expect(refs).toContain('overworld-water');
        if (id === 'kartrace' && name === 'flat') expect(svg).toContain('stroke-dasharray="16 8"');
        if (id === 'arcademaze' && name === 'flat') expect(svg).toContain('stroke-dasharray="0 22"');
      }
    }
  });

  it('neon z innym kolorem: trasa i ulice w tym kolorze, tylko lokalne url(#…)', () => {
    const svg = renderToStaticMarkup(
      <Postcard activity={mockActivities()[0]} background="map" map={LAYERS} theme="neon" accent="#39ff6a" />,
    );
    expect(svg).toContain('stroke="#39ff6a"');
    expect(svg).not.toContain(DEFAULT_ACCENT);
    const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(svg).toContain(`id="${ref}"`);
  });
});

describe('neonStyle', () => {
  it('paleta z jednego koloru, woda stała', () => {
    const red = neonStyle('#ff0000');
    expect(red.colors.mid).toBe('#ff0000');
    expect(red.colors.major).toBe('#ff5959');
    expect(red.colors.minor).toBe(mix('#ff0000', red.background, 0.35));
    expect(red.background).toBe('#0f0000');
    const green = neonStyle('#00ff00');
    expect(green.colors.major).not.toBe(red.colors.major);
    expect(green.background).not.toBe(red.background);
    expect(green.colors.water).toBe(red.colors.water);
  });

  it('bardzo ciemny własny kolor jest rozjaśniany (trasa widoczna)', () => {
    expect(visibleAccent('#000000')).toBe('#808080');
    expect(visibleAccent('#ff2a3d')).toBe('#ff2a3d');
    expect(neonStyle('#000000').colors.mid).toBe('#808080');
    const svg = renderToStaticMarkup(
      <Postcard activity={mockActivities()[0]} background="map" map={LAYERS} theme="neon" accent="#000000" />,
    );
    expect(svg).toContain('stroke="#808080"');
  });
});
