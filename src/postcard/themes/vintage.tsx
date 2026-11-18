import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Hatch, Overlay, Vignette } from './texture';

// Stara mapa: pergamin z winietą, linie sepią, kreskowana woda, czerwony atrament.
const STYLE: MapStyle = {
  background: '#e8d9b5',
  colors: {
    field: '#e3d2a8',
    landuse: '#e0cfa6',
    industrial: '#d9c7a0',
    civic: '#dccaa2',
    water: '#c9c3a4',
    waterway: '#9a8f6a',
    green: '#d4cf9e',
    sport: '#cfc893',
    building: '#d8c79e',
    tunnel: '#b8a682',
    rail: '#a08660', // jaśniejsza sepia: kontrast z ciemnoczerwoną trasą
    runway: '#cdbb92',
    path: '#a88e62',
    bridge: '#a88f66',
    minor: '#8a6a40',
    mid: '#7a5c34',
    major: '#6b4f2a',
  },
  widths: { waterway: 2.5, path: 1, minor: 1.5, mid: 2.5, major: 4, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  fills: { water: 'url(#vintage-water)' },
};

export const vintage: MapTheme = {
  label: 'Vintage',
  font: 'lobster',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Hatch id="vintage-water" background={STYLE.colors.water} color="#6b4f2a" angle={0} gap={7} width={1} opacity={0.3} />
          <Grain id="vintage-grain" color="#5a3d1a" frequency={0.7} slope={0.4} offset={-0.08} />
          <Vignette id="vintage-vignette" color="#5a3d1a" opacity={0.45} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: (
      <>
        <Overlay filter="url(#vintage-grain)" />
        <Overlay fill="url(#vintage-vignette)" />
      </>
    ),
    route: { stroke: '#8b1a1a', width: 10 },
    text: { color: '#3b2a1a' },
    mark: 'black',
  }),
};
