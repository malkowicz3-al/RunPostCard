import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay } from './texture';

const SAND = '#d9a066';

// Pustynia: piasek w ochrze i rdzy z falami wydm, ciemnobrązowe ulice, głęboko niebieska trasa.
const STYLE: MapStyle = {
  background: SAND,
  fill: 'url(#dune-waves)',
  colors: {
    field: '#d49a5e',
    landuse: '#d09558',
    industrial: '#c88a4c',
    civic: '#cd9254',
    water: '#b07a4a',
    waterway: '#7a4a24',
    green: '#c99a5a',
    sport: '#c4924e',
    building: '#b8763e',
    tunnel: '#a87040',
    rail: '#9a6236', // jasna rdza: kontrast z niebieską trasą
    runway: '#c08a52',
    path: '#8a5a30',
    bridge: '#b07a48',
    minor: '#6a3e1c',
    mid: '#55301a',
    major: '#3e2210',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 4, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const dune: MapTheme = {
  label: 'Desert',
  font: 'teko',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          {/* Fale wydm: jasna grań i cień tuż pod nią. */}
          <pattern id="dune-waves" patternUnits="userSpaceOnUse" width={240} height={60}>
            <rect width={240} height={60} fill={SAND} />
            <path d="M0 30Q60 8 120 30T240 30" fill="none" stroke="#f0c48a" strokeWidth={3} opacity={0.5} />
            <path d="M0 36Q60 14 120 36T240 36" fill="none" stroke="#a8663a" strokeWidth={2} opacity={0.3} />
          </pattern>
          <Grain id="dune-grain" color="#7a4a24" frequency={0.9} slope={0.3} offset={-0.06} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#dune-grain)" />,
    route: { stroke: '#163a8c', width: 11 },
    text: { color: '#2e1a0c' },
    mark: 'black',
  }),
};
