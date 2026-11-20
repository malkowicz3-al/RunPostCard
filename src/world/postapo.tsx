import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import { mix } from '../lib/color';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Grain, Outline, Overlay } from '../postcard/themes/texture';
import { outlines } from './outlines';

const DARK = '#14110e';

// Miasto po katastrofie: rdza, popiół i kurz, zrujnowane bryły w barwach gatunku, trasa po spękanym asfalcie;
// jaskrawa pomarańczowa trasa z czarnym konturem.
const STYLE: MapStyle = {
  background: '#3b3128',
  colors: {
    field: '#4a3f33',
    landuse: '#40372d',
    industrial: '#4e4136',
    civic: '#463b30',
    water: '#3d4a3a',
    waterway: '#3d4a3a',
    green: '#5e5a34',
    sport: '#524a34',
    building: '#5a4a3e',
    tunnel: '#4a4036',
    rail: '#2a241e',
    runway: '#4e443a',
    path: '#5a5046',
    bridge: '#2a241e',
    minor: '#6b5f52',
    mid: '#7a6a58',
    major: '#2a2622', // ulica trasy rysowana osobno
  },
  widths: { waterway: 2, path: 1, minor: 2, mid: 3, major: 4, rail: 1.5, tunnel: 1.5, bridge: 6, runway: 5 },
  dashes: { rail: '10 6', tunnel: '4 4', runway: '14 8' },
  buildings3d: 'voxel',
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
          <path d={layers.major} stroke={DARK} strokeWidth={34} />
          <path d={layers.major} stroke="#2a2622" strokeWidth={28} />
          <path d={layers.major} stroke="#6b625a" strokeWidth={1.5} strokeDasharray="10 14 3 20" />
        </g>
      )}
    </>
  );
}

export const postapo: MapTheme = {
  label: 'Post-apo',
  font: 'blackops',
  style: () => STYLE,
  floor,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Outline id="world-postapo-route" color="#000000" radius={2.5} />
          <Grain id="world-postapo-grain" color="#2a1e12" frequency={0.7} slope={0.4} offset={-0.08} />
        </defs>
        {floor(layers)}
      </>
    ),
    overlay: <Overlay filter="url(#world-postapo-grain)" />,
    route: { stroke: '#ff9a1f', width: 11, filter: 'url(#world-postapo-route)' },
    text: { color: '#e8dccb' },
    mark: 'white',
  }),
};
