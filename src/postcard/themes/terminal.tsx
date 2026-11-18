import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Overlay } from './texture';

const PHOSPHOR = '#33ff66';

// Monitor CRT: zielony luminofor na czerni, linie skanowania, bursztynowa trasa.
const STYLE: MapStyle = {
  background: '#050a06',
  colors: {
    field: '#07120a',
    landuse: '#08140b',
    industrial: '#0a1a0e',
    civic: '#09170c',
    water: '#0a2a14',
    waterway: '#1f9a44',
    green: '#0a1f0f',
    sport: '#0d2614',
    building: '#0d2a15',
    tunnel: '#145c28',
    rail: '#1a6e30', // ciemny luminofor: kontrast z bursztynową trasą
    runway: '#0f3a1a',
    path: '#1a6e30',
    bridge: '#050a06',
    minor: '#22a046',
    mid: '#2bd456',
    major: PHOSPHOR,
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const terminal: MapTheme = {
  label: 'Terminal',
  font: 'pressstart',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="terminal-scanlines" patternUnits="userSpaceOnUse" width={1080} height={6}>
            <rect width={1080} height={2} fill="#000000" opacity={0.4} />
          </pattern>
          <Glow id="terminal-route" blur={5} strong={false} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: <Overlay fill="url(#terminal-scanlines)" />,
    route: { stroke: '#ffb000', width: 11, filter: 'url(#terminal-route)' },
    text: { color: PHOSPHOR },
    mark: 'white',
  }),
};
