import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay, Vignette } from './texture';

const STONE = '#2b2a28';

// Loch: szare płyty kamienia, ciemna woda, mech, pomarańczowa trasa jak pochodnia, ciemne brzegi.
const STYLE: MapStyle = {
  background: STONE,
  fill: 'url(#dungeon-flagstones)',
  colors: {
    field: '#2e2d2a',
    landuse: '#302f2c',
    industrial: '#363430',
    civic: '#33312e',
    water: '#18232b',
    waterway: '#2a4250',
    green: '#2c3227',
    sport: '#38362f',
    building: '#46433f',
    tunnel: '#3e3b37',
    rail: '#4a4640', // ciemny kamień: kontrast z pomarańczową trasą
    runway: '#3a3834',
    path: '#4e4a44',
    bridge: '#1c1b19',
    minor: '#57534c',
    mid: '#635e56',
    major: '#726c62',
  },
  widths: { waterway: 2.5, path: 1.2, minor: 3, mid: 4.5, major: 6, rail: 1.5, tunnel: 1.5, bridge: 9, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const dungeon: MapTheme = {
  label: 'Dungeon',
  font: 'anton',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          {/* Płyty 60x40, co drugi rząd przesunięty o pół płyty. */}
          <pattern id="dungeon-flagstones" patternUnits="userSpaceOnUse" width={60} height={80}>
            <rect width={60} height={80} fill={STONE} />
            <path d="M0 0.5H60M0 40.5H60M0.5 0V40M30.5 40V80" stroke="#1e1d1b" strokeWidth={1.5} />
          </pattern>
          <Vignette id="dungeon-dark" color="#000000" opacity={0.75} />
          <Glow id="dungeon-route" blur={10} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#dungeon-dark)" />,
    route: { stroke: '#ff8c1a', width: 12, filter: 'url(#dungeon-route)' },
    text: { color: '#ffd9a0' },
    mark: 'white',
  }),
};
