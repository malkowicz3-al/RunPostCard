import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Plan techniczny: granat z siatką, jasne linie, żółta trasa.
const STYLE: MapStyle = {
  background: '#0b2a5c',
  fill: 'url(#blueprint-grid)',
  colors: {
    field: '#0d2f66',
    landuse: '#0e3169',
    industrial: '#11376f',
    civic: '#103470',
    water: '#0f3a7d',
    green: '#0e3468',
    sport: '#133d7a',
    waterway: '#6fa8ff',
    building: '#12407f',
    tunnel: '#3d679f',
    rail: '#4b78b8', // ciemniej niż minor: kontrast z żółtą trasą
    runway: '#2b5694',
    path: '#4b78b8',
    bridge: '#0b2a5c',
    minor: '#7fa6d9',
    mid: '#a9c6ee',
    major: '#d8e8ff',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const blueprint: MapTheme = {
  label: 'Blueprint',
  font: 'orbitron',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="blueprint-grid" patternUnits="userSpaceOnUse" width={60} height={60}>
            <rect width={60} height={60} fill={STYLE.background} />
            <path d="M60 0H0V60" fill="none" stroke="#5f86c4" strokeWidth={1} opacity={0.25} />
          </pattern>
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffb703', width: 14 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
