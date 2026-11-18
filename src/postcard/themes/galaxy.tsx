import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Overlay } from './texture';

// Gwiazdy w kafelku 280x280: [x, y, promień, krycie]. Dwa kafelki różnej wielkości, żeby nie było widać powtórzeń.
const STARS: [number, number, number, number][] = [
  [12, 30, 1.2, 0.9],
  [58, 140, 0.7, 0.6],
  [101, 62, 1.8, 0.8],
  [143, 210, 0.9, 0.5],
  [187, 17, 0.6, 0.7],
  [212, 118, 1.3, 0.9],
  [251, 241, 0.8, 0.6],
  [33, 228, 1, 0.5],
  [166, 89, 0.5, 0.8],
  [79, 263, 1.5, 0.7],
];

// Kosmos: granatowa czerń z polem gwiazd, mapa blado niebiesko-biała, złota trasa.
const STYLE: MapStyle = {
  background: '#03040d',
  fill: 'url(#galaxy-space)',
  colors: {
    field: '#050716',
    landuse: '#06081a',
    industrial: '#080b20',
    civic: '#070a1d',
    water: '#0a1030',
    waterway: '#4a5f9a',
    green: '#060a1c',
    sport: '#0a0e26',
    building: '#0c1028',
    tunnel: '#2a3560',
    rail: '#33406e', // przygaszony błękit: kontrast ze złotą trasą
    runway: '#1a2248',
    path: '#4a5a8a',
    bridge: '#03040d',
    minor: '#6a7cb0',
    mid: '#9aaad6',
    major: '#d0daf5',
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1, mid: 1.6, major: 2.4, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

function Stars({ id, size }: { id: string; size: number }) {
  const k = size / 280;
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={size} height={size}>
      {STARS.map(([x, y, r, o]) => (
        <circle key={x} cx={x * k} cy={y * k} r={r} fill="#ffffff" opacity={o} />
      ))}
    </pattern>
  );
}

export const galaxy: MapTheme = {
  label: 'Galaxy',
  font: 'russo',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <radialGradient id="galaxy-space" gradientUnits="userSpaceOnUse" cx={540} cy={760} r={1300}>
            <stop offset="0" stopColor="#0b1030" />
            <stop offset="1" stopColor="#02030a" />
          </radialGradient>
          <Stars id="galaxy-stars" size={280} />
          <Stars id="galaxy-stars-2" size={430} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: (
      <>
        <Overlay fill="url(#galaxy-stars)" />
        <Overlay fill="url(#galaxy-stars-2)" />
      </>
    ),
    route: { stroke: '#ffd23f', width: 11 },
    text: { color: '#ffe27a' },
    mark: 'white',
  }),
};
