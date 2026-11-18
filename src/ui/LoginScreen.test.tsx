import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEMO_MAP } from './demoMap';
import { LoginScreen } from './LoginScreen';

describe('DEMO_MAP', () => {
  it('ma warstwy miasta i poprawne ścieżki SVG', () => {
    for (const key of ['water', 'green', 'building', 'path', 'minor', 'mid', 'major'] as const) {
      const d = DEMO_MAP[key]!;
      expect(d, key).toMatch(/^M/);
      expect(d, key).toMatch(/^[MLHVQTZhvz\d\s.-]+$/);
      expect(d, key).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('LoginScreen', () => {
  it('przycisk Stravy nad kolażem; kolaż ukryty przed czytnikami, unikalne id, bez adresów zewnętrznych', () => {
    const html = renderToStaticMarkup(<LoginScreen />);
    expect(html).toContain('alt="Connect with Strava"');
    expect(html).toContain('class="login-collage" aria-hidden="true"');
    expect(html.match(/class="login-card"/g)).toHaveLength(9);
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [, ref] of html.matchAll(/url\(#([\w-]+)\)/g)) expect(html).toContain(`id="${ref}"`);
    expect(html.replaceAll('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
  });
});
