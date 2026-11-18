import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

// Gwiazdy w kafelku 240x240: [x, y, promień, kolor]; kilka kolorowych.
const STARS: [number, number, number, string][] = [
  [14, 22, 1.4, '#ffffff'],
  [70, 150, 0.8, '#9fdcff'],
  [118, 48, 2, '#ffffff'],
  [160, 196, 1, '#ffb3f0'],
  [205, 92, 1.5, '#ffffff'],
  [40, 210, 1.1, '#fff3a0'],
  [184, 12, 0.7, '#ffffff'],
  [95, 110, 0.6, '#9fdcff'],
];

// Strzelanka kosmiczna: głęboki fiolet kosmosu, pole gwiazd, mapa w zimnych fioletach, magentowa trasa.
const STYLE: MapStyle = {
  background: '#05010f',
  colors: {
    field: '#07031a',
    landuse: '#08041d',
    industrial: '#0c0628',
    civic: '#0a0522',
    water: '#060c2e',
    waterway: '#2a3f9a',
    green: '#080520',
    sport: '#0e0830',
    building: '#120a36',
    tunnel: '#2a1f66',
    rail: '#2e2270', // przygaszony fiolet: kontrast z magentową trasą
    runway: '#1a1248',
    path: '#3a2c80',
    bridge: '#05010f',
    minor: '#4a3aa8',
    mid: '#6f5ad8',
    major: '#a99af5',
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1.2, mid: 1.8, major: 2.6, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const spaceshooter: MapTheme = {
  label: 'Space Shooter',
  font: 'audiowide',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="spaceshooter-stars" patternUnits="userSpaceOnUse" width={240} height={240}>
            {STARS.map(([x, y, r, c]) => (
              <circle key={x} cx={x} cy={y} r={r} fill={c} />
            ))}
          </pattern>
          <Glow id="spaceshooter-route" blur={9} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#spaceshooter-stars)" />,
    route: { stroke: '#ff2bd6', width: 11, filter: 'url(#spaceshooter-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
