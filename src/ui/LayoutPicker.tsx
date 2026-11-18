import type { Activity } from '../strava/api';
import { ROUTE_BOX } from '../postcard/Route';
import { DATA, LAYOUT_ORDER, LAYOUTS, fitted, slotBox, type LayoutId } from '../postcard/slots';
import { Select } from './Select';

// Przykładowy bieg tylko do miniatur: rozmiary prostokątów zależą od długości wartości.
const SAMPLE: Activity = {
  id: 0,
  name: 'Morning run',
  sport_type: 'Run',
  distance: 10420,
  moving_time: 3125,
  elapsed_time: 3300,
  total_elevation_gain: 84,
  average_heartrate: 152,
  max_heartrate: 174,
  average_speed: 3.33,
  max_speed: 4.4,
  average_cadence: 86,
  start_date_local: '2026-11-15T07:05:00Z',
  map: { summary_polyline: '' },
};

const [[rx0, ry0], [rx1, ry1]] = ROUTE_BOX;

function Mini({ id }: { id: LayoutId }) {
  return (
    <svg viewBox="0 0 108 192" aria-hidden="true">
      <rect
        x={rx0 / 10}
        y={ry0 / 10}
        width={(rx1 - rx0) / 10}
        height={(ry1 - ry0) / 10}
        rx={3}
        fill="none"
        stroke="currentColor"
        strokeDasharray="3 2"
        opacity={0.5}
      />
      {LAYOUTS[id].items.map((item) => {
        const value = DATA[item.slot.data].value(SAMPLE);
        const box = slotBox(item, value, 1);
        const top = item.y - 0.75 * fitted(item, value, 1).size;
        const pos = item.labelPos ?? 'below';
        // Slot z box (wykres albo liczba w nim; slotBox zwraca wtedy box): tylko ramka prostokąta.
        if (item.box) {
          return (
            <rect
              key={item.slot.id}
              x={box.x0 / 10}
              y={box.y0 / 10}
              width={(box.x1 - box.x0) / 10}
              height={(box.y1 - box.y0) / 10}
              rx={2}
              fill="none"
              stroke="currentColor"
              opacity={0.7}
            />
          );
        }
        return (
          <g key={item.slot.id} fill="currentColor">
            <rect
              x={box.x0 / 10}
              y={(pos === 'above' ? top : box.y0) / 10}
              width={(box.x1 - box.x0) / 10}
              height={(item.y - (pos === 'above' ? top : box.y0)) / 10}
              rx={1}
              opacity={0.5}
            />
            {pos !== 'none' && (
              <rect
                x={(box.x0 + 0.2 * (box.x1 - box.x0)) / 10}
                y={(pos === 'below' ? item.y + 40 : box.y0) / 10}
                width={(0.6 * (box.x1 - box.x0)) / 10}
                height={1.5}
                opacity={0.8}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

const OPTIONS = LAYOUT_ORDER.map((id) => ({ id, label: LAYOUTS[id].name }));

export function LayoutPicker({ layout, onLayout }: { layout: LayoutId; onLayout: (id: LayoutId) => void }) {
  return (
    <section className="panel-section">
      <h3 className="panel-heading">Layout</h3>
      <Select
        label="Layout"
        className="layout-select"
        value={layout}
        options={OPTIONS}
        onChange={onLayout}
        preview={(id) => <Mini id={id} />}
      />
    </section>
  );
}
