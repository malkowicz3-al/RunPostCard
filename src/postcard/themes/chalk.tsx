import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay, Wobble } from './texture';

const ROADS = 'url(#chalk-wobble)';

// Tablica: ciemna zieleń, ulice białą kredą z drżeniem, trasa żółtą kredą, smugi starej kredy.
const STYLE: MapStyle = {
  background: '#24382f',
  colors: {
    field: '#273c32',
    landuse: '#293e34',
    industrial: '#2c4137',
    civic: '#2a4035',
    water: '#304a44',
    waterway: '#8fa9a2',
    green: '#2b4434',
    sport: '#2e4838',
    building: '#2f453a',
    tunnel: '#4a6156',
    rail: '#6a8276', // przygaszona kreda: kontrast z żółtą trasą
    runway: '#3e554a',
    path: '#8a9c92',
    bridge: '#24382f',
    minor: '#b8c4bb',
    mid: '#d8ded6',
    major: '#eef0e8',
  },
  widths: { waterway: 2.5, path: 1.2, minor: 1.8, mid: 2.8, major: 4, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { path: ROADS, minor: ROADS, mid: ROADS, major: ROADS },
};

export const chalk: MapTheme = {
  label: 'Chalk',
  font: 'marker',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Wobble id="chalk-wobble" scale={2} seed={5} />
          <Wobble id="chalk-route" scale={1.5} seed={9} />
          {/* Rzadki, jasny szum: smugi niedokładnie startej kredy. */}
          <Grain id="chalk-grain" color="#e8efe9" frequency={0.5} slope={0.3} offset={-0.08} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#chalk-grain)" />,
    route: { stroke: '#ffe14d', width: 11, filter: 'url(#chalk-route)' },
    text: { color: '#f2f2ea' },
    mark: 'white',
  }),
};
