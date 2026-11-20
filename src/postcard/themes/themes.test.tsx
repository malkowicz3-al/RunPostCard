import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAP_KEYS } from '../../lib/vectorMap';
import { THEMES } from './index';

const NEW = ['slate', 'sand', 'plum', 'rose', 'coal', 'arctic', 'lava', 'olive', 'midnight', 'candy'] as const;

describe('motywy palet (Slate…Coal, Arctic…Candy)', () => {
  it('pełna paleta i scena z tłem oraz ulicami w kolorach motywu', () => {
    for (const id of NEW) {
      const theme = THEMES[id];
      const style = theme.style();
      for (const key of MAP_KEYS) expect(style.colors[key], `${id}: ${key}`).toMatch(/^#[0-9a-f]{6}$/);
      const out = theme.render({ major: 'M0 0L100 0' });
      const svg = renderToStaticMarkup(<svg>{out.scene}</svg>);
      expect(svg, id).toContain(style.background);
      expect(svg, id).toContain(`stroke="${style.colors.major}"`);
      expect(out.route.stroke, id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
