import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

// Pyłki w kafelku 320x320: [x, y, promień, krycie].
const SPECKS: [number, number, number, number][] = [
  [20, 44, 1.6, 0.5],
  [96, 180, 1, 0.35],
  [150, 30, 2.2, 0.3],
  [230, 250, 1.3, 0.45],
  [290, 110, 1.8, 0.4],
  [60, 290, 1.1, 0.3],
  [190, 140, 0.9, 0.5],
];

// Mroczny motyw: zgaszony granat, czerwona mgła, unoszące się pyłki, matowe morskie ulice, krwista trasa.
const STYLE: MapStyle = {
  background: '#070a10',
  colors: {
    field: '#090c13',
    landuse: '#0a0d14',
    industrial: '#0c1017',
    civic: '#0b0f16',
    water: '#0a141c',
    waterway: '#24474c',
    green: '#0b1216',
    sport: '#0e151a',
    building: '#10161d',
    tunnel: '#16262b',
    rail: '#1c3034', // ciemny morski: kontrast z czerwoną trasą
    runway: '#141c22',
    path: '#24474c',
    bridge: '#070a10',
    minor: '#2f5a5e',
    mid: '#3a6b6e',
    major: '#4b8084',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const redfog: MapTheme = {
  label: 'Red Fog',
  // Righteous czytelniejszy od Bungee w małych etykietach.
  font: 'righteous',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <radialGradient id="redfog-fog" gradientUnits="userSpaceOnUse" cx={540} cy={1500} r={1300}>
            <stop offset="0" stopColor="#ff1a1a" stopOpacity={0.28} />
            <stop offset="0.6" stopColor="#8a0a14" stopOpacity={0.12} />
            <stop offset="1" stopColor="#8a0a14" stopOpacity={0} />
          </radialGradient>
          <pattern id="redfog-specks" patternUnits="userSpaceOnUse" width={320} height={320}>
            {SPECKS.map(([x, y, r, o]) => (
              <circle key={x} cx={x} cy={y} r={r} fill="#c8c0b8" opacity={o} />
            ))}
          </pattern>
          <Glow id="redfog-route" blur={9} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: (
      <>
        <Overlay fill="url(#redfog-fog)" />
        <Overlay fill="url(#redfog-specks)" />
      </>
    ),
    route: { stroke: '#e0101e', width: 11, filter: 'url(#redfog-route)' },
    text: { color: '#f2e6e6' },
    mark: 'white',
  }),
};
