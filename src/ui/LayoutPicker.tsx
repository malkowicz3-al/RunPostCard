import type { Activity } from '../strava/api';
import { ROUTE_BOX } from '../postcard/Route';
import { DATA, LAYOUT_ORDER, LAYOUTS, fitted, slotBox, type LayoutId } from '../postcard/slots';

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

export function LayoutPicker({ layout, onLayout }: { layout: LayoutId; onLayout: (id: LayoutId) => void }) {
  return (
    <div className="look-tiles" role="group" aria-label="Layout">
      {LAYOUT_ORDER.map((id) => (
        <button key={id} className="look-tile" aria-pressed={layout === id} onClick={() => onLayout(id)}>
          <span className="look-preview layout-mini">
            <Mini id={id} />
          </span>
          <span className="look-label">{LAYOUTS[id].name}</span>
        </button>
      ))}
    </div>
  );
}
