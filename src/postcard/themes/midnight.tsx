import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Granatowa noc, złote ulice jak latarnie, trasa biała.
const STYLE: MapStyle = {
  background: '#0a1026',
  colors: {
    water: '#0e1838',
    waterway: '#132046',
    green: '#0d1530',
    building: '#111a3a',
    path: '#3b3520',
    minor: '#6b5a26',
    mid: '#a8862e',
    major: '#e6b84a',
    field: '#0c132d',
    landuse: '#0d1430',
    industrial: '#0f1734',
    civic: '#0e1632',
    sport: '#0d1630',
    rail: '#c99a38',
    tunnel: '#17203f',
    bridge: '#05081a',
    runway: '#141c3b',
  },
  widths: { waterway: 3, path: 1.2, minor: 2, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 8, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const midnight: MapTheme = {
  label: 'Midnight',
  font: 'bebas',
  style: () => STYLE,
  render: (layers) => ({
    scene: <MapBackground layers={layers} style={STYLE} />,
    route: { stroke: '#ffffff', width: 14 },
    text: { color: '#f3e3b5' },
    mark: 'white',
  }),
};
