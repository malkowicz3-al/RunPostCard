import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import { mix } from '../lib/color';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Outline, Overlay, Vignette } from '../postcard/themes/texture';
import { outlines } from './outlines';

const DARK = '#3a2a18';

// Wioska fantasy za dnia: łąki, pola i lasy, kamienne zamki i dachy w barwach gatunku, trasa jako ubita droga
// z brukowanym środkiem; kremowa trasa z ciemnym konturem.
const STYLE: MapStyle = {
  background: '#5a7a3a',
  colors: {
    field: '#8a9a4c',
    landuse: '#66843e',
    industrial: '#7a6a48',
    civic: '#8a7a50',
    water: '#3a76b8',
    waterway: '#3a76b8',
    green: '#2f5d2a',
    sport: '#6e9446',
    building: '#c9b48a',
    tunnel: '#6b5230',
    rail: '#4a3a2a',
    runway: '#8a7a50',
    path: '#b89a64',
    bridge: '#6b4a2a',
    minor: '#a8895a',
    mid: '#9a7c50',
    major: '#9a7a4a', // ulica trasy rysowana osobno
  },
  widths: { waterway: 3, path: 1.2, minor: 2.5, mid: 3.5, major: 5, rail: 1.5, tunnel: 1.5, bridge: 7, runway: 6 },
  dashes: { rail: '8 6', tunnel: '4 4' },
  buildings3d: 'castle',
};

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  return (
    <>
      <MapBackground layers={{ ...layers, building: layers.buildings ? undefined : layers.building, major: undefined }} style={STYLE} rect={rect} />
      {/* W 3D Postcard zdejmuje building z podłogi (bryły stoją same), więc i bez płaskich dachów. */}
      {[...outlines(layers.building ? layers.buildings : undefined, STYLE.colors.building)].map(([color, d]) => (
        <path key={color} d={d} stroke={DARK} strokeWidth={1.5} strokeLinejoin="round" fill={mix(color, DARK, 0.15)} />
      ))}
      {layers.major && (
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={layers.major} stroke="#5a4126" strokeWidth={34} />
          <path d={layers.major} stroke="#9a7a4a" strokeWidth={28} />
          <path d={layers.major} stroke="#6b5230" strokeWidth={3} strokeDasharray="3 7" />
        </g>
      )}
    </>
  );
}

export const fantasy: MapTheme = {
  label: 'Fantasy',
  font: 'alfa',
  style: () => STYLE,
  floor,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Outline id="world-fantasy-route" color={DARK} radius={2.5} />
          <Vignette id="world-fantasy-vignette" color="#1e2a10" opacity={0.45} />
        </defs>
        {floor(layers)}
      </>
    ),
    overlay: <Overlay fill="url(#world-fantasy-vignette)" />,
    route: { stroke: '#fff3c4', width: 11, filter: 'url(#world-fantasy-route)' },
    text: { color: '#fff6e0' },
    mark: 'white',
  }),
};
