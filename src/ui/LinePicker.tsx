import type { RunStreams } from '../strava/api';
import { ZONE_COLORS } from '../postcard/SlotChart';
import {
  CADENCE_RAMP,
  EFFORT_RAMP,
  ELEVATION_RAMP,
  FIRE_RAMP,
  GRADE_RAMP,
  ICE_RAMP,
  PACE_RAMP,
  ROUTE_COLORS,
  available,
  colorScale,
  type RouteColor,
} from '../postcard/routeColor';
import { Select } from './Select';

// Podgląd: pasek z kolorów stylu (stały, niezależny od biegu); motyw w kolorze tekstu interfejsu.
const RAINBOW = Array.from({ length: 7 }, (_, i) => colorScale('rainbow')!(i / 6));
const STOPS: Record<RouteColor, string[]> = {
  theme: ['var(--text)', 'var(--text)'],
  rainbow: RAINBOW,
  pace: PACE_RAMP,
  heartrate: ZONE_COLORS,
  elevation: ELEVATION_RAMP,
  cadence: CADENCE_RAMP,
  grade: GRADE_RAMP,
  effort: EFFORT_RAMP,
  fire: FIRE_RAMP,
  ice: ICE_RAMP,
};

export function LinePicker({
  value,
  onChange,
  streams,
}: {
  value: RouteColor;
  onChange: (mode: RouteColor) => void;
  streams?: RunStreams | null;
}) {
  const options = ROUTE_COLORS.map(({ id, label }) =>
    available(id, streams) ? { id, label } : { id, label: `${label} (needs streams)`, disabled: true },
  );
  return (
    <Select
      label="Line"
      className="line-select"
      value={value}
      options={options}
      onChange={onChange}
      preview={(id) => <span className="line-swatch" style={{ background: `linear-gradient(90deg, ${STOPS[id].join(', ')})` }} />}
    />
  );
}
