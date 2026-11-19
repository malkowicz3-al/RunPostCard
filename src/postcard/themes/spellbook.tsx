import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Overlay, Vignette, Wobble } from './texture';

const INK = 'url(#spellbook-wobble)';

// Magiczna mapa: stary pergamin, brązowy atrament rysowany ręką, trasa jak ślady kroków w ciemnoczerwonym tuszu.
const STYLE: MapStyle = {
  background: '#ead8b0',
  colors: {
    field: '#e6d2a8',
    landuse: '#e3cfa4',
    industrial: '#dcc79c',
    civic: '#e0cba0',
    water: '#d2c8a6',
    waterway: '#7a5a34',
    green: '#d8cf9c',
    sport: '#d3c994',
    building: '#d9c296',
    tunnel: '#bca47c',
    rail: '#a88a60', // jasny atrament: kontrast z ciemnoczerwoną trasą
    runway: '#d0bc90',
    path: '#9a7a4e',
    bridge: '#b09670',
    minor: '#7a5a34',
    mid: '#64462a',
    major: '#4e341e',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 7 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { minor: INK, mid: INK, major: INK },
  buildings3d: 'castle',
};

export const spellbook: MapTheme = {
  label: 'Spellbook',
  font: 'lobster',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Wobble id="spellbook-wobble" scale={3} seed={8} />
          <Grain id="spellbook-grain" color="#5a3d1a" frequency={0.7} slope={0.4} offset={-0.08} />
          <Vignette id="spellbook-vignette" color="#4a2e12" opacity={0.5} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: (
      <>
        <Overlay filter="url(#spellbook-grain)" />
        <Overlay fill="url(#spellbook-vignette)" />
      </>
    ),
    route: { stroke: '#7a1020', width: 9, dash: '14 16' },
    text: { color: '#3a2412' },
    mark: 'black',
  }),
};
