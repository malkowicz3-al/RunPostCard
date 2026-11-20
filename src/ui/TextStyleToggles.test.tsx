import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextStyleToggles } from './TextStyleToggles';

describe('TextStyleToggles', () => {
  it('cztery ikony z etykietami, stan w aria-pressed, bez <text>', () => {
    const html = renderToStaticMarkup(<TextStyleToggles value={{ italic: true }} onChange={() => {}} />);
    expect(html).toContain('role="group" aria-label="Text style"');
    expect(html).toContain('>Text<');
    for (const label of ['Bold', 'Italic', 'Outline', 'Shadow']) expect(html).toContain(`aria-label="${label}" title="${label}"`);
    expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(1);
    expect(html).toContain('aria-label="Italic" title="Italic" aria-pressed="true"');
    expect(html).not.toContain('<text');
  });
});
