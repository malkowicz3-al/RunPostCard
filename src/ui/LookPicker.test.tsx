import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities } from '../dev/mockActivities';
import type { GenreId } from '../world/genres';
import { LookPicker, type Look } from './LookPicker';

const noop = () => {};
const picker = (look: Look, genre: GenreId = 'scifi') =>
  renderToStaticMarkup(
    <LookPicker
      polyline={mockActivities()[0].map.summary_polyline}
      hasRoute
      look={look}
      onLook={noop}
      accent="#ff2bd6"
      onAccent={noop}
      onPhotoFile={noop}
      worldGenre={genre}
      onWorldGenre={noop}
      worldVariant="violet"
      onWorldVariant={noop}
      onNewWorld={noop}
    />,
  );

describe('LookPicker World', () => {
  it('sekcja World z wyborem stylu i przyciskiem New world tylko przy World', () => {
    const svg = picker('world');
    expect(svg).toContain('World style');
    expect(svg).toContain('New world');
    expect(svg).toContain('Sci-fi');
    expect(picker('world', 'fantasy')).toContain('Fantasy'); // zamknięta lista pokazuje tylko wybrany styl
    expect(picker('dark')).not.toContain('New world');
  });

  it('New world i kolory tylko w Sci-fi; bez sekcji Gradient i Scenery', () => {
    for (const genre of ['fantasy', 'postapo', 'bright', 'christmas', 'newyear', 'easter', 'valentine', 'medieval'] as GenreId[]) {
      expect(picker('world', genre)).not.toContain('New world');
      expect(picker('world', genre)).not.toContain('aria-label="Color: Violet"');
    }
    expect(picker('world')).toContain('aria-label="Color: Violet"');
    expect(picker('dark')).not.toContain('aria-label="Color: Violet"');
    for (const look of ['world', 'dark', 'gradient', 'transparent'] as Look[]) {
      expect(picker(look)).not.toContain('>Gradient<');
      expect(picker(look)).not.toContain('>Scenery<');
    }
  });
});
