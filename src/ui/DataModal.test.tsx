import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities } from '../dev/mockActivities';
import { DATA, resolveLayout, type SlotData } from '../postcard/slots';
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

  it('bez slotu nic nie renderuje', () => {
    expect(
      renderToStaticMarkup(
        <DataModal slot={null} activity={run} font="barlow" scale={1} color="#fff" bg={{}} onPick={noop} onClose={noop} />,
      ),
    ).toBe('');
  });
});
