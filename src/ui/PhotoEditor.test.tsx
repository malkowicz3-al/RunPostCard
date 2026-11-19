import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FILTERS, NO_EDIT } from '../lib/photo';
import { PhotoEditor } from './PhotoEditor';

const noop = () => {};

// shortcut: render bez DOM (brak jsdom w projekcie), więc klików Apply/Cancel tu nie sprawdzamy; logika ruchu w photo.test.ts.
describe('PhotoEditor', () => {
  it('z plikiem: okno, zoom, 9 filtrów z bieżącym zaznaczonym, Reset/Cancel/Apply', () => {
    const html = renderToStaticMarkup(
      <PhotoEditor file={new Blob()} initial={{ ...NO_EDIT, zoom: 2, filter: 'noir' }} onApply={noop} onClose={noop} />,
    );
    expect(html).toContain('<dialog');
    expect(html).toContain('Edit photo');
    expect(html).toMatch(/type="range" min="1" max="4" step="0.05" value="2"/);
    expect(html.match(/class="photo-filter"/g)).toHaveLength(9);
    for (const f of Object.values(FILTERS)) expect(html).toContain(f.label.replace('&', '&amp;'));
    expect([...html.matchAll(/aria-pressed="true">.*?<\/span>([^<]+)</g)].map(([, l]) => l)).toEqual(['Noir']);
    for (const b of ['Reset', 'Cancel', 'Apply']) expect(html).toContain(`>${b}</button>`);
  });

  it('bez pliku nic nie renderuje', () => {
    expect(renderToStaticMarkup(<PhotoEditor file={null} initial={NO_EDIT} onApply={noop} onClose={noop} />)).toBe('');
  });
});
