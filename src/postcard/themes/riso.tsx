import { mix } from '../../lib/color';
import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay } from './texture';

const PAPER = '#f5f0e6';
const INK = '#0078bf';
// Odcień farby jak krycie na papierze (t = udział papieru); heksy, bo z palety korzystają miniatury i test kontrastu.
const tint = (t: number) => mix(INK, PAPER, t);

// Riso: mapa jedną niebieską farbą, różowa trasa z niebieską kopią przesuniętą jak przy złym spasowaniu.
const STYLE: MapStyle = {
  background: PAPER,
  colors: {
    field: tint(0.92),
    landuse: tint(0.9),
    industrial: tint(0.85),
    civic: tint(0.88),
    water: tint(0.6),
    waterway: tint(0.3),
    green: tint(0.8),
    sport: tint(0.8),
    building: tint(0.75),
    // Szczegóły co najwyżej 20% farby: ciemniejsze nie odcinają się od różowej trasy (kontrast < 2).
    tunnel: tint(0.8),
    rail: tint(0.8),
    runway: tint(0.8),
    path: tint(0.5),
    bridge: PAPER,
    minor: tint(0.35),
    mid: tint(0.15),
    major: INK,
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3, major: 4.5, rail: 2, tunnel: 2, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const riso: MapTheme = {
  label: 'Riso',
  font: 'bungee',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          {/* Niebieska kopia trasy przesunięta o 4 px pod różową (bez mix-blend-mode: niepewny przy SVG -> canvas). */}
          <filter id="riso-route" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x={0} y={0} width={1080} height={1920}>
            <feOffset in="SourceAlpha" dx={4} dy={4} result="shift" />
            <feFlood floodColor={INK} floodOpacity={0.85} />
            <feComposite in2="shift" operator="in" result="blue" />
            <feMerge>
              <feMergeNode in="blue" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Ziarno druku: progowany szum w kolorze papieru wybija kropki w farbie. */}
          <Grain id="riso-grain" color={PAPER} frequency={1.4} slope={6} offset={-3.6} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay filter="url(#riso-grain)" />,
    route: { stroke: '#ff48b0', width: 11, filter: 'url(#riso-route)' },
    text: { color: INK },
    mark: 'black',
  }),
};
