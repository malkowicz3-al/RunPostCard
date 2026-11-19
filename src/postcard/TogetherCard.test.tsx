import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities } from '../dev/mockActivities';
import { MAP_ATTRIBUTION } from '../lib/vectorMap';
import { TogetherCard, nearRuns, runProgress } from './TogetherCard';

const LAYERS = { water: 'M0 0L50 0L50 50Z', major: 'M0 100L500 100' };
const runs = mockActivities().slice(7, 12);

const check = (svg: string) => {
  expect(svg).not.toContain('NaN');
  for (const [, ref] of svg.matchAll(/url\(#([\w-]+)\)/g)) expect(svg).toContain(`id="${ref}"`);
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
  expect(new Set(ids).size).toBe(ids.length);
};
const dots = (svg: string) => (svg.match(/<circle/g) ?? []).length;

describe('TogetherCard', () => {
  it('płasko: jedna trasa na bieg, różne kolory, podpis mapy przy tle map', () => {
    const svg = renderToStaticMarkup(<TogetherCard runs={runs} map={LAYERS} theme="neon" />);
    check(svg);
    expect(svg).toContain(MAP_ATTRIBUTION);
    const colors = new Set([...svg.matchAll(/stroke="(hsl\([^"]+\))"/g)].map(([, c]) => c));
    expect(colors.size).toBe(runs.length);
    expect(svg).toContain('>5<'); // liczba biegów w nagłówku
  });

  it('Heat: jeden kolor, półprzezroczyste trasy; przed wczytaniem mapy gradient bez podpisu', () => {
    const svg = renderToStaticMarkup(<TogetherCard runs={runs} colors="heat" />);
    check(svg);
    expect(svg).not.toContain('hsl(');
    expect((svg.match(/opacity="0.35"/g) ?? []).length).toBe(runs.length);
    expect(svg).not.toContain(MAP_ATTRIBUTION);
  });

  it('postęp: „real time” kończy krótsze wcześniej, „together” wszystkie naraz', () => {
    expect(runProgress(0.5, 100, 200, 'real')).toBe(1);
    expect(runProgress(0.5, 200, 200, 'real')).toBe(0.5);
    expect(runProgress(0.5, 100, 200, 'together')).toBe(0.5);
    const times = runs.map((r) => r.moving_time);
    const shortest = Math.min(...times) / Math.max(...times);
    const P = (shortest + 1) / 2; // najkrótszy już na mecie, najdłuższy jeszcze nie
    const real = renderToStaticMarkup(<TogetherCard runs={runs} progress={P} sync="real" />);
    const together = renderToStaticMarkup(<TogetherCard runs={runs} progress={P} sync="together" />);
    check(real);
    expect(dots(together)).toBe(runs.length);
    expect(dots(real)).toBeLessThan(runs.length);
    expect(dots(real)).toBeGreaterThan(0);
  });
});

describe('nearRuns', () => {
  const all = mockActivities();
  it('bieg w Tatrach daleko od reszty jest ukryty; blisko siebie nic', () => {
    const mountain = all.find((r) => r.name === 'Mountain loop')!;
    const city = all.slice(7, 12);
    expect(nearRuns([...city, mountain])).toEqual({ kept: city, hidden: 1 });
    expect(nearRuns(city)).toEqual({ kept: city, hidden: 0 });
  });
});
