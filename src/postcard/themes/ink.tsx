import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay, Wobble } from './texture';

const WASH = 'url(#ink-wash)';

// Sumi-e: papier ryżowy, woda i zieleń jako rozmyte plamy szarego tuszu, cienkie ulice, trasa cynobrem jak tusz pieczęci.
const STYLE: MapStyle = {
  background: '#f2ead8',
  colors: {
    // Szczegóły jasne: ciemniejszy tusz nie odcina się od cynobru (kontrast < 2).
    field: '#ece4d2',
    landuse: '#e9e1cf',
    industrial: '#e2dac8',
    civic: '#e6decc',
    water: '#a9a69e',
    waterway: '#6e6b64',
    green: '#c2beb2',
    sport: '#d2cdbf',
    building: '#e0d8c6',
    tunnel: '#cdc6b5',
    rail: '#c2bcac',
    runway: '#ddd5c3',
    path: '#8e8a82',
    bridge: '#d6cfbe',
    minor: '#5e5b55',
    mid: '#3e3c38',
    major: '#22211f',
  },
  widths: { waterway: 2.5, path: 0.8, minor: 1, mid: 1.6, major: 2.4, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { water: WASH, green: WASH },
};

export const ink: MapTheme = {
  label: 'Ink',
  font: 'teko',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Wobble id="ink-wash" scale={12} frequency={0.015} seed={6} blur={4} opacity={0.75} />
          <Wobble id="ink-route" scale={2} seed={3} />
          <Grain id="ink-grain" color="#7a6a4a" frequency={0.7} slope={0.3} offset={-0.06} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#ink-grain)" />,
    route: { stroke: '#d23a1e', width: 11, filter: 'url(#ink-route)' },
    text: { color: '#1e1e1e' },
    mark: 'black',
  }),
};
