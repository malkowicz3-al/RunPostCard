import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';

const VECTOR = 'url(#vectorarcade-lines)';

// Automat wektorowy: czerń, cienkie świecące linie w bieli i cyjanie, biała trasa.
const STYLE: MapStyle = {
  background: '#000000',
  colors: {
    field: '#000000',
    landuse: '#010304',
    industrial: '#020607',
    civic: '#020506',
    water: '#03141a',
    waterway: '#1f8aa0',
    green: '#010607',
    sport: '#03090b',
    building: '#040b0d',
    tunnel: '#155060',
    rail: '#1a5a66', // przygaszony cyjan: kontrast z białą trasą
    runway: '#0c2a32',
    path: '#16606e',
    bridge: '#000000',
    minor: '#1f8aa0',
    mid: '#3fd8f0',
    major: '#e8fdff',
  },
  widths: { waterway: 1.2, path: 0.7, minor: 1, mid: 1.4, major: 2, rail: 1, tunnel: 1, bridge: 4, runway: 4 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { minor: VECTOR, mid: VECTOR, major: VECTOR },
};

export const vectorarcade: MapTheme = {
  label: 'Vector Arcade',
  font: 'orbitron',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Glow id="vectorarcade-lines" blur={2} />
          <Glow id="vectorarcade-route" blur={6} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffffff', width: 7, filter: 'url(#vectorarcade-route)' },
    text: { color: '#e8fdff' },
    mark: 'white',
  }),
};
