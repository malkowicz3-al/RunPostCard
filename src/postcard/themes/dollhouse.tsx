import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

// Domek dla lalek: jaskrawy i pastelowy róż, białe ulice, połysk u góry, głęboka magenta z różową poświatą.
const STYLE: MapStyle = {
  background: '#f9a8cc',
  colors: {
    field: '#fab4d4',
    landuse: '#f9b0d0',
    industrial: '#f7c2da',
    civic: '#fbbcd8',
    water: '#b8dcff',
    waterway: '#7ab8f0',
    green: '#f7c6e0',
    sport: '#fcd0e4',
    building: '#ff5fa8',
    tunnel: '#fde0ee',
    rail: '#fde0ee', // jasny róż: kontrast z ciemną magentą
    runway: '#fcd0e4',
    path: '#ffe6f2',
    bridge: '#ffffff',
    minor: '#fff0f7',
    mid: '#ffffff',
    major: '#ffffff',
  },
  widths: { waterway: 2.5, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const dollhouse: MapTheme = {
  label: 'Dollhouse',
  font: 'pacifico',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <linearGradient id="dollhouse-gloss" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={1920}>
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
            <stop offset="0.4" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="1" stopColor="#c2006a" stopOpacity={0.15} />
          </linearGradient>
          <Glow id="dollhouse-route" blur={8} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#dollhouse-gloss)" />,
    route: { stroke: '#a3005c', width: 12, filter: 'url(#dollhouse-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
