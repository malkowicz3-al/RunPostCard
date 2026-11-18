import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';

// Poświata: rozmyta kopia pod oryginałem. Obszar filtra = całe płótno, żeby blask nie był ucinany na bbox warstwy.
function Glow({ id, blur, strong = true }: { id: string; blur: number; strong?: boolean }) {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
      <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        {strong && <feMergeNode in="glow" />}
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

const STREETS = 'url(#neon-streets)';

const STYLE: MapStyle = {
  background: '#06061a',
  colors: {
    water: '#0b1a4a',
    waterway: '#1d4fa8',
    green: '#0a0d22',
    building: '#0f0f2a',
    path: '#5a2db8',
    minor: '#8a4dff',
    mid: '#2fa8ff',
    major: '#00f0ff',
  },
  widths: { waterway: 2, path: 0.8, minor: 1.2, mid: 2, major: 3 },
  filters: {
    water: 'url(#neon-water)',
    waterway: STREETS,
    path: STREETS,
    minor: STREETS,
    mid: STREETS,
    major: STREETS,
  },
};

export const neon: MapTheme = {
  label: 'Neon',
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Glow id="neon-streets" blur={3} />
          <Glow id="neon-water" blur={8} />
          <Glow id="neon-route" blur={10} />
          {/* Słabsza poświata: mocna rozmywała małe etykiety (TIME, PACE, data). */}
          <Glow id="neon-text" blur={3} strong={false} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ff2bd6', width: 12, filter: 'url(#neon-route)' },
    text: { color: '#ffffff', filter: 'url(#neon-text)' },
    mark: 'white',
  }),
};
