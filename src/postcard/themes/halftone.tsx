import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Dots, Grain, Overlay } from './texture';

const PAPER = '#f4f1ea';
const INK = '#111111';

// Gazeta: czarny tusz na papierze, poligony rastrem kropek różnej wielkości, gruba czerwona trasa.
const STYLE: MapStyle = {
  background: PAPER,
  colors: {
    // Szczegóły jasne albo prawie czarne: średnie szarości nie odcinają się od czerwieni (kontrast < 2).
    field: '#ebe8e1',
    landuse: '#e6e3dc',
    industrial: '#dcd9d2',
    civic: '#e2dfd8',
    water: '#c4c2bc', // kolory jak średnia rastra (miniatury)
    waterway: '#333333',
    green: '#d8d6d0',
    sport: '#d4d2cc',
    building: '#b8b6b0',
    tunnel: '#c8c6c0',
    rail: INK,
    runway: '#d8d6d0',
    path: '#555555',
    bridge: PAPER,
    minor: '#333333',
    mid: '#1a1a1a',
    major: '#000000',
  },
  widths: { waterway: 2.5, path: 1.2, minor: 2, mid: 3, major: 4.5, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  fills: { water: 'url(#halftone-water)', green: 'url(#halftone-green)', building: 'url(#halftone-building)' },
};

export const halftone: MapTheme = {
  label: 'Halftone',
  font: 'anton',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Dots id="halftone-water" background={PAPER} color={INK} r={2.2} />
          <Dots id="halftone-green" background={PAPER} color={INK} r={1.4} />
          <Dots id="halftone-building" background={PAPER} color={INK} r={2.6} />
          <Grain id="halftone-grain" color="#3a3a3a" frequency={0.9} slope={0.2} offset={-0.04} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#halftone-grain)" />,
    route: { stroke: '#e10600', width: 16 },
    text: { color: INK },
    mark: 'black',
  }),
};
