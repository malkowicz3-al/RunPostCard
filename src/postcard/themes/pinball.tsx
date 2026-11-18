import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';

const BUMPER = 'url(#pinball-bumpers)';

// Stół do pinballa: ciemne pole gry, ulice w kolorach odbijaczy z poświatą, chromowana trasa.
const STYLE: MapStyle = {
  background: '#0a0820',
  fill: 'url(#pinball-playfield)',
  colors: {
    field: '#0c0a26',
    landuse: '#0e0b2a',
    industrial: '#130f34',
    civic: '#110d30',
    water: '#06123a',
    waterway: '#1f5fd8',
    green: '#0c1426',
    sport: '#16103a',
    building: '#1a1242',
    tunnel: '#2a2060',
    rail: '#2e2468', // ciemny fiolet: kontrast z chromowaną trasą
    runway: '#1e1850',
    path: '#3a2a80',
    bridge: '#0a0820',
    minor: '#2f7bff',
    mid: '#ff2fa0',
    major: '#ffd200',
  },
  widths: { waterway: 2, path: 1, minor: 1.8, mid: 2.8, major: 3.8, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { minor: BUMPER, mid: BUMPER, major: BUMPER },
};

export const pinball: MapTheme = {
  label: 'Pinball',
  font: 'racing',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <radialGradient id="pinball-playfield" gradientUnits="userSpaceOnUse" cx={540} cy={1100} r={1200}>
            <stop offset="0" stopColor="#1a1040" />
            <stop offset="1" stopColor="#05040f" />
          </radialGradient>
          <Glow id="pinball-bumpers" blur={3} />
          <Glow id="pinball-route" blur={5} strong={false} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#e6ecf5', width: 13, filter: 'url(#pinball-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
