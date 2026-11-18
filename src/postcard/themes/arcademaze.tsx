import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Inline } from './texture';

const WALL = '#2a3cff';
const MAZE = 'url(#arcademaze-walls)';

// Labirynt automatu z lat 80.: czerń, ulice jako podwójne niebieskie ściany, trasa jako rząd żółtych kropek.
const STYLE: MapStyle = {
  background: '#000000',
  colors: {
    field: '#000000',
    landuse: '#02020a',
    industrial: '#04040e',
    civic: '#03030c',
    water: '#05082a',
    waterway: '#1a2499',
    green: '#020610',
    sport: '#060a1c',
    building: '#080c24',
    tunnel: '#141c66',
    rail: '#1a2499', // przygaszony błękit: kontrast z żółtymi kropkami
    runway: '#0c1240',
    path: '#1a2499',
    bridge: '#000000',
    minor: WALL,
    mid: WALL,
    major: WALL,
  },
  // Grube drogi: środek wycięty filtrem (radius 2.5) zostawia dwie ściany po ok. 2,5 px.
  widths: { waterway: 2, path: 1.5, minor: 9, mid: 11, major: 13, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { minor: MAZE, mid: MAZE, major: MAZE },
};

export const arcademaze: MapTheme = {
  label: 'Arcade Maze',
  font: 'pressstart',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Inline id="arcademaze-walls" color="#000000" radius={2.5} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    // Kreska zerowej długości z okrągłym końcem = kropka.
    route: { stroke: '#ffd800', width: 12, dash: '0 22' },
    text: { color: '#ffd800' },
    mark: 'white',
  }),
};
