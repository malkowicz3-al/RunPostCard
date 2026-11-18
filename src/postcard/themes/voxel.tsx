import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

const GRASS = '#5d9b3a';
const PX = 8; // bok piksela we wzorach
// Mozaika 4x4 pikseli trawy w trzech odcieniach.
const GRASS_PX = '0102120001020120'.split('').map((i) => [GRASS, '#548f34', '#67a842'][+i]);

// Świat z klocków: pikselowa trawa i deski, ziemne ścieżki, kamienne drogi, żółta trasa.
const STYLE: MapStyle = {
  background: GRASS,
  fill: 'url(#voxel-grass)',
  colors: {
    field: '#6aa040',
    landuse: '#5a9438',
    industrial: '#6e6e6e',
    civic: '#7a6e5a',
    water: '#3a5fd0',
    waterway: '#3a5fd0',
    green: '#3f7a2a',
    sport: '#4f8f32',
    building: '#9a7a4a',
    tunnel: '#5a5a5a',
    rail: '#4a3a2a', // ciemne podkłady: kontrast z żółtą trasą
    runway: '#6a6a6a',
    path: '#8a6a3e',
    bridge: '#6b4f2a',
    minor: '#8a8a8a',
    mid: '#7a7a7a',
    major: '#6a6a6a',
  },
  widths: { waterway: 4, path: 2, minor: 4, mid: 6, major: 8, rail: 2, tunnel: 2, bridge: 11, runway: 10 },
  dashes: { rail: '8 8', tunnel: '8 8' },
  fills: { building: 'url(#voxel-planks)' },
};

export const voxel: MapTheme = {
  label: 'Voxel',
  font: 'rubikmono',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="voxel-grass" patternUnits="userSpaceOnUse" width={PX * 4} height={PX * 4}>
            {GRASS_PX.map((c, i) => (
              <rect key={i} x={(i % 4) * PX} y={Math.floor(i / 4) * PX} width={PX} height={PX} fill={c} />
            ))}
          </pattern>
          <pattern id="voxel-planks" patternUnits="userSpaceOnUse" width={PX * 4} height={PX * 2}>
            <rect width={PX * 4} height={PX} fill="#9a7a4a" />
            <rect y={PX} width={PX * 4} height={PX} fill="#8a6a3e" />
            <path d={`M0 ${PX - 0.5}H${PX * 4}M${PX * 3} 0V${PX}M${PX} ${PX}V${PX * 2}`} stroke="#5e4526" strokeWidth={1} />
          </pattern>
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffe14d', width: 12 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
