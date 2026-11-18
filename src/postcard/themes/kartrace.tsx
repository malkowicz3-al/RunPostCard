import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Outline } from './texture';

// Wyścig gokartów: cukierkowe kolory, asfaltowe drogi z białym brzegiem, trasa jak szachownica mety.
const STYLE: MapStyle = {
  background: '#3fbf5a',
  colors: {
    field: '#44c25e',
    landuse: '#3ab856',
    industrial: '#ff5f9e',
    civic: '#ff7a1f',
    water: '#2fb8ff',
    waterway: '#1e9ae8',
    green: '#2fa84a',
    sport: '#a35cff',
    building: '#ffcf2f',
    tunnel: '#6a6a7a',
    rail: '#2a2a3a', // ciemne szyny: kontrast z białą trasą
    runway: '#5a5a6a',
    path: '#f5e6c8',
    bridge: '#2a2a3a',
    minor: '#5a5a6a',
    mid: '#4a4a5a',
    major: '#3a3a4a',
  },
  widths: { waterway: 3, path: 1.5, minor: 4, mid: 6, major: 8, rail: 2, tunnel: 2, bridge: 11, runway: 10 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const kartrace: MapTheme = {
  label: 'Kart Race',
  font: 'bungee',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          {/* Czarny obrys (4 px) wypełnia przerwy (8 px) między białymi kreskami: pasek biało-czarny. */}
          <Outline id="kartrace-route" color="#111111" radius={4} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ffffff', width: 12, dash: '16 8', filter: 'url(#kartrace-route)' },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
