import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities } from '../dev/mockActivities';
import { LookPicker, type Look } from './LookPicker';

const noop = () => {};
const picker = (look: Look) =>
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
      worldGenre="scifi"
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
    expect(picker('dark')).not.toContain('New world');
  });
});
