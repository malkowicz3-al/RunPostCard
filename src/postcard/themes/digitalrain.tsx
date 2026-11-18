import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

// Smugi w kafelku wzoru: [x, y, długość]; różne długości i przesunięcia, żeby kolumny nie szły równo.
const STREAKS: [number, number, number][] = [
  [6, 20, 180],
  [24, 230, 150],
  [42, 90, 240],
  [60, 300, 110],
  [78, 0, 130],
];

// Deszcz kodu: czerń, mapa w przygaszonych zieleniach, pionowe smugi, jasna biało-zielona trasa.
const STYLE: MapStyle = {
  background: '#020602',
  colors: {
    field: '#030a04',
    landuse: '#040c05',
    industrial: '#061208',
    civic: '#050f06',
    water: '#04140a',
    waterway: '#0f5a26',
    green: '#051308',
    sport: '#07180a',
    building: '#081a0c',
    tunnel: '#0c3a18',
    rail: '#0f4a1e', // ciemna zieleń: kontrast z jasną trasą
    runway: '#0a2a12',
    path: '#0f4a1e',
    bridge: '#020602',
    minor: '#127a30',
    mid: '#17a03e',
    major: '#1fc24c',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const digitalrain: MapTheme = {
  label: 'Digital Rain',
  font: 'audiowide',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <linearGradient id="digitalrain-streak" x1={0} y1={0} x2={0} y2={1}>
            <stop offset="0" stopColor="#00ff41" stopOpacity={0} />
            <stop offset="0.85" stopColor="#00ff41" stopOpacity={0.35} />
            <stop offset="1" stopColor="#c8ffd4" stopOpacity={0.6} />
          </linearGradient>
          <pattern id="digitalrain-rain" patternUnits="userSpaceOnUse" width={90} height={420}>
            {STREAKS.map(([x, y, h]) => (
              <rect key={x} x={x} y={y} width={2} height={h} fill="url(#digitalrain-streak)" />
            ))}
          </pattern>
          <Glow id="digitalrain-route" blur={6} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#digitalrain-rain)" />,
    route: { stroke: '#d8ffe0', width: 11, filter: 'url(#digitalrain-route)' },
    text: { color: '#b8ffc8' },
    mark: 'white',
  }),
};
