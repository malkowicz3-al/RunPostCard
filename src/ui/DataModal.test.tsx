import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { CHARTS, DATA, resolveLayout, type SlotData } from '../postcard/slots';
import { DataModal } from './DataModal';

const run = mockActivities()[0];
const noop = () => {};

describe('DataModal', () => {
  it('pokazuje wszystkie dane z wartościami, bieżące zaznaczone', () => {
    const slot = resolveLayout('classic')[1]; // time
    const html = renderToStaticMarkup(
      <DataModal slot={slot} activity={run} font="barlow" scale={1} color="#fff" bg={{}} onPick={noop} onClose={noop} />,
    );
    expect(html).toContain('<dialog');
    expect(html).toContain('Change: Moving time');
    for (const d of Object.keys(DATA) as SlotData[]) expect(html).toContain(`aria-label="${DATA[d].menu}: ${DATA[d].value(run)}"`);
    const selected = [...html.matchAll(/aria-selected="true" aria-label="([^"]+)"/g)].map(([, l]) => l);
    expect(selected).toEqual([`Moving time: ${DATA.time.value(run)}`]);
  });

  it('grupa Charts tylko dla slotu z box i ze strumieniami; bieżący wykres zaznaczony', () => {
    const streams = mockStreams(run);
    const render = (slot = resolveLayout('poster')[1], s: typeof streams | null = streams) =>
      renderToStaticMarkup(
        <DataModal slot={slot} activity={run} font="barlow" scale={1} color="#fff" bg={{}} streams={s} onPick={noop} onClose={noop} />,
      );
    const html = render();
    expect(html).toContain('aria-label="Numbers"');
    expect(html).toContain('aria-label="Charts"');
    expect(html).toContain('Change: Elevation profile');
    for (const c of Object.values(CHARTS)) expect(html).toContain(`aria-label="${c.menu}"`);
    expect([...html.matchAll(/aria-selected="true" aria-label="([^"]+)"/g)].map(([, l]) => l)).toEqual(['Elevation profile']);
    expect(html).toContain('viewBox="60 1530 960 270"');
    expect(render(resolveLayout('poster')[1], null)).not.toContain('aria-label="Charts"');
    expect(render(resolveLayout('classic')[1])).not.toContain('aria-label="Charts"');
  });

  it('bez slotu nic nie renderuje', () => {
    expect(
      renderToStaticMarkup(
        <DataModal slot={null} activity={run} font="barlow" scale={1} color="#fff" bg={{}} onPick={noop} onClose={noop} />,
      ),
    ).toBe('');
  });
});
