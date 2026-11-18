import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities } from '../../dev/mockActivities';
import { Postcard } from '../Postcard';
import { THEMES, type ThemeId } from './index';

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
});
