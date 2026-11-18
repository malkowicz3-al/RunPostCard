import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';

const CYAN = '#3ff0ff';
const STREETS = 'url(#lightgrid-streets)';

// Świetlna siatka: czysta czerń, duże kwadraty w tle, cienkie świecące cyjanowe ulice, pomarańczowa trasa.
const STYLE: MapStyle = {
  background: '#000000',
  fill: 'url(#lightgrid-grid)',
  colors: {
    field: '#01080a',
    landuse: '#020a0c',
    industrial: '#030e11',
    civic: '#020c0e',
    water: '#031a22',
    waterway: '#1aa8c0',
    green: '#020d0f',
    sport: '#041316',
    building: '#04161a',
    tunnel: '#0c4650',
    rail: '#0f5560', // przygaszony cyjan: kontrast z pomarańczową trasą
    runway: '#08303a',
    path: '#17808f',
    bridge: '#000000',
    minor: '#22b8cc',
    mid: '#30d8ec',
    major: CYAN,
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1, mid: 1.6, major: 2.4, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { waterway: STREETS, minor: STREETS, mid: STREETS, major: STREETS },
};

export const lightgrid: MapTheme = {
  label: 'Light Grid',
  font: 'orbitron',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="lightgrid-grid" patternUnits="userSpaceOnUse" width={120} height={120}>
            <rect width={120} height={120} fill={STYLE.background} />
            <path d="M120 0H0V120" fill="none" stroke={CYAN} strokeWidth={1} opacity={0.12} />
          </pattern>
          <Glow id="lightgrid-streets" blur={2.5} />
          <Glow id="lightgrid-route" blur={9} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ff8a1a', width: 11, filter: 'url(#lightgrid-route)' },
    text: { color: '#e8fdff' },
    mark: 'white',
  }),
};
