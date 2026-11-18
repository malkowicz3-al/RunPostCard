import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Outline } from './texture';

const GRASS = '#4c9a3c';
const WATER = '#2f6fd0';

// Mapa świata z gry RPG: pikselowa trawa i fale, piaskowe drogi, czerwone dachy, kremowa trasa z konturem.
const STYLE: MapStyle = {
  background: GRASS,
  fill: 'url(#overworld-grass)',
  colors: {
    field: '#6aa64a',
    landuse: '#559e40',
    industrial: '#8a7f6a',
    civic: '#a8875a',
    water: WATER,
    waterway: WATER,
    green: '#2f7a30',
    sport: '#5fae48',
    building: '#c84a3a',
    tunnel: '#7a6a4a',
    rail: '#4a3a2a', // ciemne podkłady: kontrast z kremową trasą
    runway: '#8a7f6a',
    path: '#c8b080',
    bridge: '#7a5430',
    minor: '#d8c08a',
    mid: '#e0c890',
    major: '#e8d49c',
  },
  widths: { waterway: 4, path: 1.5, minor: 3, mid: 4.5, major: 6, rail: 2, tunnel: 2, bridge: 9, runway: 8 },
  dashes: { rail: '8 8', tunnel: '4 4' },
  fills: { water: 'url(#overworld-water)' },
};

export const overworld: MapTheme = {
  label: 'Overworld',
  font: 'righteous',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="overworld-grass" patternUnits="userSpaceOnUse" width={32} height={32}>
            <rect width={32} height={32} fill={GRASS} />
            <path d="M6 10h4v4h-4zM22 24h4v4h-4zM18 4h2v4h-2z" fill="#3e8432" />
          </pattern>
          <pattern id="overworld-water" patternUnits="userSpaceOnUse" width={32} height={24}>
            <rect width={32} height={24} fill={WATER} />
            <path d="M4 8h8v2h-8zM20 18h8v2h-8z" fill="#8fc0ff" />
          </pattern>
          <Outline id="overworld-route" color="#3a2410" radius={2.5} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#fff3c4', width: 11, dash: '20 10', filter: 'url(#overworld-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
