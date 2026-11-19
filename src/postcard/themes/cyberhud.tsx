import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

const HUD = 'url(#cyberhud-lines)';

// Interfejs HUD: ciemny morski błękit, ulice cyjan i magenta z poświatą, siatka celownika, żółta trasa.
const STYLE: MapStyle = {
  background: '#021a1f',
  colors: {
    field: '#031d22',
    landuse: '#032026',
    industrial: '#05272e',
    civic: '#04242a',
    water: '#011016',
    waterway: '#0f6a7a',
    green: '#032a2a',
    sport: '#063036',
    building: '#07343c',
    tunnel: '#0e4a56',
    rail: '#11505c', // przygaszony morski: kontrast z żółtą trasą
    runway: '#0a3a44',
    path: '#13707e',
    bridge: '#021a1f',
    minor: '#1aa6b8',
    mid: '#3ff0ff',
    major: '#ff3fc8',
  },
  widths: { waterway: 1.5, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.2, tunnel: 1.2, bridge: 5, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { mid: HUD, major: HUD },
  buildings3d: 'tower',
};

export const cyberhud: MapTheme = {
  label: 'Cyber HUD',
  font: 'teko',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="cyberhud-grid" patternUnits="userSpaceOnUse" width={60} height={60}>
            <path d="M0 0.5H60M0.5 0V60" stroke="#3ff0ff" strokeWidth={1} opacity={0.08} />
          </pattern>
          <Glow id="cyberhud-lines" blur={2.5} strong={false} />
          <Glow id="cyberhud-route" blur={8} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#cyberhud-grid)" />,
    route: { stroke: '#ffe23f', width: 11, filter: 'url(#cyberhud-route)' },
    text: { color: '#c8fbff' },
    mark: 'white',
  }),
};
