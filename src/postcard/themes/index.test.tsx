import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mix } from '../../lib/color';
import { mockActivities } from '../../dev/mockActivities';
import { Postcard } from '../Postcard';
import { THEMES, type ThemeId } from './index';
import { DEFAULT_ACCENT, neonStyle, visibleAccent } from './neon';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100', building: 'M10 10L20 10L20 20Z' };

describe('THEMES', () => {
  it('Dark, Light, Neon w tej kolejności', () => {
    expect(Object.values(THEMES).map((t) => t.label)).toEqual(['Dark', 'Light', 'Neon']);
  });

  it('każde url(#id) w pocztówce wskazuje element z tego samego SVG (eksport PNG bez zewnętrznych zasobów)', () => {
    for (const id of Object.keys(THEMES) as ThemeId[]) {
      const svg = renderToStaticMarkup(
        <Postcard activity={mockActivities()[0]} background="map" map={LAYERS} theme={id} />,
      );
      const refs = [...svg.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]);
      for (const ref of refs) expect(svg, `${id}: #${ref}`).toContain(`id="${ref}"`);
      if (id === 'neon') expect(refs.length).toBeGreaterThan(0);
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
