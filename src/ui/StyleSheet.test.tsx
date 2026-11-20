import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StyleSheet, closesSheet } from './StyleSheet';

describe('StyleSheet', () => {
  it('Escape zamyka arkusz tylko bez otwartego okna i listy', () => {
    expect(closesSheet('Escape', false, false)).toBe(true);
    expect(closesSheet('Escape', true, false)).toBe(false);
    expect(closesSheet('Escape', false, true)).toBe(false);
    expect(closesSheet('Enter', false, false)).toBe(false);
  });

  it('region z nazwą z nagłówka, zamknięty na starcie, przycisk Style wskazuje panel', () => {
    const html = renderToStaticMarkup(<StyleSheet>treść</StyleSheet>);
    const id = html.match(/class="style-panel" id="([^"]+)"/)![1];
    expect(html).toContain('data-open="false"');
    expect(html).toContain(`role="region" aria-labelledby="${id}-title"`);
    expect(html).toContain(`id="${id}-title"`);
    expect(html).toContain(`aria-controls="${id}" aria-expanded="false"`);
    expect(html).toContain('>Done</button>');
    expect(html).toContain('treść');
  });
});
