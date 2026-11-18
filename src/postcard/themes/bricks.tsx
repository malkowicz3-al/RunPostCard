import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Outline } from './texture';

const PLATE = '#3a9a3a';
const BLOCK = 40; // bok klocka we wzorze budynków
// Kwadrat łaciński 3x3: każdy budynek wycina inną mozaikę czerwonych, żółtych i niebieskich klocków.
const BLOCKS = ['#d01012', '#f5c400', '#0057a8', '#f5c400', '#0057a8', '#d01012', '#0057a8', '#d01012', '#f5c400'];

// Klocki: zielona płytka z wypustkami, płaskie bloki w barwach podstawowych, biała trasa z ciemnym konturem.
const STYLE: MapStyle = {
  background: PLATE,
  fill: 'url(#bricks-studs)',
  colors: {
    field: '#4aa83e',
    landuse: '#43a03c',
    industrial: '#8a8f94',
    civic: '#a0a5aa',
    water: '#1e88e5',
    waterway: '#1565c0',
    green: '#2e8a2e',
    sport: '#5ab84a',
    building: '#d01012',
    tunnel: '#5a5e63',
    rail: '#2a2c30', // ciemne szyny: kontrast z białą trasą
    runway: '#6a6e73',
    path: '#c8b48a',
    bridge: '#6a6e73',
    minor: '#5a5e63',
    mid: '#45484d',
    major: '#33363a',
  },
  widths: { waterway: 3, path: 1.5, minor: 3, mid: 4.5, major: 6, rail: 2, tunnel: 2, bridge: 9, runway: 9 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  fills: { building: 'url(#bricks-blocks)' },
};

export const bricks: MapTheme = {
  label: 'Bricks',
  font: 'russo',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="bricks-studs" patternUnits="userSpaceOnUse" width={24} height={24}>
            <rect width={24} height={24} fill={PLATE} />
            <circle cx={12} cy={12} r={7} fill="#45a845" stroke="#2e7a2e" strokeWidth={1} />
          </pattern>
          <pattern id="bricks-blocks" patternUnits="userSpaceOnUse" width={BLOCK * 3} height={BLOCK * 3}>
            {BLOCKS.map((c, i) => (
              <rect key={i} x={(i % 3) * BLOCK} y={Math.floor(i / 3) * BLOCK} width={BLOCK} height={BLOCK} fill={c} />
            ))}
          </pattern>
          <Outline id="bricks-route" color="#1a1a1a" radius={3} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffffff', width: 12, filter: 'url(#bricks-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
