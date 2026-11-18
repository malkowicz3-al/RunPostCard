import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Overlay } from './texture';

// Cztery odcienie zieleni ekranu LCD, od najjaśniejszego.
const [LCD0, LCD1, LCD2, LCD3] = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];

// Konsola przenośna: jasny ekran LCD, mapa w czterech odcieniach, siatka pikseli, najciemniejsza trasa.
const STYLE: MapStyle = {
  background: LCD0,
  colors: {
    field: LCD0,
    landuse: LCD0,
    industrial: LCD1,
    civic: LCD1,
    water: LCD2,
    waterway: LCD2,
    green: LCD1,
    sport: LCD1,
    building: LCD1,
    tunnel: '#6e8f0c',
    rail: '#6e8f0c', // pośredni odcień: kontrast z najciemniejszą trasą
    runway: LCD1,
    path: LCD2,
    bridge: LCD0,
    minor: LCD2,
    mid: LCD2,
    major: LCD2,
  },
  widths: { waterway: 2, path: 1, minor: 2, mid: 3, major: 4.5, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const handheld: MapTheme = {
  label: 'Handheld',
  font: 'pressstart',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="handheld-pixels" patternUnits="userSpaceOnUse" width={6} height={6}>
            <path d="M0 0.5H6M0.5 0V6" stroke={LCD3} strokeWidth={1} opacity={0.1} />
          </pattern>
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#handheld-pixels)" />,
    route: { stroke: LCD3, width: 12 },
    text: { color: LCD3 },
    mark: 'black',
  }),
};
