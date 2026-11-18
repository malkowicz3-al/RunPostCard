import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import { hexToRgb, mix } from '../../lib/color';
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

export const NEON_ACCENTS: [string, string][] = [
  ['#ff2bd6', 'Pink'],
  ['#ff2a3d', 'Red'],
  ['#ff8a1f', 'Orange'],
  ['#ffe62e', 'Yellow'],
  ['#39ff6a', 'Green'],
  ['#00f0ff', 'Cyan'],
  ['#9b5cff', 'Violet'],
];
export const DEFAULT_ACCENT = NEON_ACCENTS[0][0];

// Własny kolor może być prawie czarny: wtedy trasa i ulice znikłyby na ciemnym tle, więc go rozjaśniamy.
export function visibleAccent(accent: string): string {
  return Math.max(...hexToRgb(accent)) < 150 ? mix(accent, '#ffffff', 0.5) : accent;
}

// Cały neon z jednego koloru; woda stała (granat), żeby rzeka dalej była rzeką.
export function neonStyle(rawAccent: string): MapStyle {
  const accent = visibleAccent(rawAccent);
  const background = mix(accent, '#000000', 0.94);
  return {
    background,
    colors: {
      water: '#0b1a4a',
      waterway: '#1d4fa8',
      green: mix(accent, '#000000', 0.9),
      building: mix(accent, '#000000', 0.86),
      path: mix(accent, background, 0.6),
      minor: mix(accent, background, 0.35),
      mid: accent,
      major: mix(accent, '#ffffff', 0.35),
      // Szczegóły przygaszone (15–30% akcentu), żeby trasa w kolorze akcentu się od nich odcinała.
      field: mix(accent, '#000000', 0.93),
      landuse: mix(accent, '#000000', 0.92),
      industrial: mix(accent, '#000000', 0.88),
      civic: mix(accent, '#000000', 0.9),
      sport: mix(accent, '#000000', 0.84),
      rail: mix(accent, background, 0.7),
      tunnel: mix(accent, background, 0.85),
      bridge: background,
      runway: mix(accent, background, 0.8),
    },
    widths: { waterway: 2, path: 0.8, minor: 1.2, mid: 2, major: 3, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 6 },
    dashes: { rail: '10 6', tunnel: '4 4' },
    filters: {
      water: 'url(#neon-water)',
      waterway: STREETS,
      path: STREETS,
      minor: STREETS,
      mid: STREETS,
      major: STREETS,
    },
  };
}

export const neon: MapTheme = {
  label: 'Neon',
  font: 'audiowide',
  style: ({ accent = DEFAULT_ACCENT } = {}) => neonStyle(accent),
  render: (layers, { accent = DEFAULT_ACCENT } = {}) => ({
    scene: (
      <>
        <defs>
          <Glow id="neon-streets" blur={3} />
          <Glow id="neon-water" blur={8} />
          <Glow id="neon-route" blur={10} />
          {/* Słabsza poświata: mocna rozmywała małe etykiety (TIME, PACE, data). */}
          <Glow id="neon-text" blur={3} strong={false} />
        </defs>
        <MapBackground layers={layers} style={neonStyle(accent)} />
      </>
    ),
    route: { stroke: visibleAccent(accent), width: 12, filter: 'url(#neon-route)' },
    text: { color: '#ffffff', filter: 'url(#neon-text)' },
    mark: 'white',
  }),
};
