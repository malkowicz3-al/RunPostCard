import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Glow } from './neon';
import { Grain, Overlay, Vignette } from './texture';

// Noktowizor: zielony luminofor, linie skanowania, szum obrazu, ciemne brzegi, biało-zielona trasa.
const STYLE: MapStyle = {
  background: '#021a06',
  colors: {
    field: '#031f08',
    landuse: '#04220a',
    industrial: '#06290d',
    civic: '#05250b',
    water: '#010e03',
    waterway: '#0c4a18',
    green: '#063010',
    sport: '#083614',
    building: '#0a3d16',
    tunnel: '#11602a',
    rail: '#147030', // ciemny luminofor: kontrast z jasną trasą
    runway: '#0c4a1c',
    path: '#178a38',
    bridge: '#021a06',
    minor: '#1fa046',
    mid: '#3cc860',
    major: '#6cf088',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
};

export const nightvision: MapTheme = {
  label: 'Night Vision',
  font: 'blackops',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <pattern id="nightvision-scanlines" patternUnits="userSpaceOnUse" width={1080} height={4}>
            <rect width={1080} height={1.5} fill="#000000" opacity={0.35} />
          </pattern>
          <Grain id="nightvision-noise" color="#b8ffc0" frequency={0.9} slope={0.35} offset={-0.12} />
          <Vignette id="nightvision-dark" color="#000000" opacity={0.85} />
          <Glow id="nightvision-route" blur={6} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    overlay: (
      <>
        <Overlay filter="url(#nightvision-noise)" />
        <Overlay fill="url(#nightvision-scanlines)" />
        <Overlay fill="url(#nightvision-dark)" />
      </>
    ),
    route: { stroke: '#eaffea', width: 11, filter: 'url(#nightvision-route)' },
    text: { color: '#b8ffc0' },
    mark: 'white',
  }),
};
