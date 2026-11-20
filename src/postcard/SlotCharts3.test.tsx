import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { CHARTS } from './slots';

const NEW = ['pacebins', 'hrdrift', 'splitdelta', 'pacestrip', 'pacing'] as const;
const box = { x0: 60, y0: 1200, x1: 1020, y1: 1500 };

describe('SlotCharts3', () => {
  it('nowe wykresy rysują się bez NaN na danych demo', () => {
    const run = mockActivities().find((r) => r.average_heartrate)!;
    const streams = mockStreams(run);
    for (const form of NEW) {
      const { Component, has, label } = CHARTS[form];
      expect(has(streams), form).toBe(true);
      const svg = renderToStaticMarkup(
        <svg>
          <Component box={box} streams={streams} activity={run} label={label} value="5:00" scale={1} />
        </svg>,
      );
      expect(svg, form).toMatch(/<(rect|path)/);
      expect(svg, form).not.toContain('NaN');
    }
  });

  it('bez strumieni has = false', () => {
    const empty = { latlng: [], distance: [0] };
    for (const form of NEW) expect(CHARTS[form].has(empty), form).toBe(false);
  });
});
