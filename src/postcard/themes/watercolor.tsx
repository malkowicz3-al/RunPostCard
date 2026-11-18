import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay, Wobble } from './texture';

const BLOT = 'url(#watercolor-blot)';

// Akwarela: plamy wody, zieleni i terenów z miękkimi brzegami, ulice cienkim tuszem bez filtra.
const STYLE: MapStyle = {
  background: '#faf6ee',
  colors: {
    field: '#f3efdc',
    landuse: '#f1ebe4',
    industrial: '#ebe3ea',
    civic: '#f3e6d8',
    water: '#8fb8d8',
    waterway: '#7aa9cf',
    green: '#a9c99a',
    sport: '#c4dcae',
    building: '#ece6dc',
    tunnel: '#c4c0b8',
    rail: '#b8b4ac', // jasny tusz: kontrast z trasą
    runway: '#e0dbd0',
    path: '#9a968e',
    bridge: '#c8c3b8',
    minor: '#7a7a7a',
    mid: '#5a5a5a',
    major: '#4a4a4a',
  },
  widths: { waterway: 3, path: 1, minor: 1.2, mid: 2, major: 3, rail: 1.2, tunnel: 1.2, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { field: BLOT, landuse: BLOT, industrial: BLOT, civic: BLOT, water: BLOT, green: BLOT, sport: BLOT },
};

export const watercolor: MapTheme = {
  label: 'Watercolor',
  font: 'pacifico',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Wobble id="watercolor-blot" scale={10} frequency={0.02} seed={2} blur={1.5} opacity={0.6} />
          <Grain id="watercolor-grain" color="#6b5e48" frequency={0.6} slope={0.3} offset={-0.06} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#watercolor-grain)" />,
    route: { stroke: '#d1495b', width: 11 },
    text: { color: '#2e2e2e' },
    mark: 'black',
  }),
};
