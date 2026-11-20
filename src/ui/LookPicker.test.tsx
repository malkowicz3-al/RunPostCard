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
      gradient="dusk"
      onGradient={noop}
      onPhotoFile={noop}
      onScenery={noop}
      onOwnPhoto={noop}
      worldGenre={genre}
      onWorldGenre={noop}
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
    expect(picker('world', 'postapo')).toContain('Post-apo');
    expect(picker('dark')).not.toContain('New world');
  });
});
