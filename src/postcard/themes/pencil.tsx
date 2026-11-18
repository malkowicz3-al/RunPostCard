import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Grain, Hatch, Overlay, Wobble } from './texture';

const ROADS = 'url(#pencil-wobble)';

// Szkic ołówkiem: kremowy papier, grafitowe drżące ulice, kreskowane budynki i woda, czerwona kredka.
const STYLE: MapStyle = {
  background: '#f4efe4',
  colors: {
    field: '#efe9dc',
    landuse: '#ece6d9',
    industrial: '#e6e0d3',
    civic: '#ebe5dc',
    water: '#e6e4de',
    waterway: '#8a8a8a',
    green: '#e6e8d8',
    sport: '#e0e4d0',
    building: '#e8e2d5',
    tunnel: '#b0aca4',
    rail: '#9a9a9a', // jasny grafit: kontrast z czerwoną trasą
    runway: '#d6d0c4',
    path: '#a09c94',
    bridge: '#a8a49c',
    minor: '#8a8a8a',
    mid: '#6b6b6b',
    major: '#3a3a3a',
  },
  widths: { waterway: 2, path: 1, minor: 1.5, mid: 2.5, major: 3.5, rail: 1.2, tunnel: 1.2, bridge: 6, runway: 6 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  filters: { path: ROADS, minor: ROADS, mid: ROADS, major: ROADS },
  fills: { building: 'url(#pencil-hatch-building)', water: 'url(#pencil-hatch-water)' },
};

export const pencil: MapTheme = {
  label: 'Pencil',
  font: 'marker',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Wobble id="pencil-wobble" scale={2.5} seed={1} />
          <Wobble id="pencil-wobble-2" scale={2.5} seed={7} />
          <Wobble id="pencil-route" scale={1.5} seed={4} />
          <Hatch id="pencil-hatch-building" background={STYLE.colors.building} color="#3a3a3a" angle={45} />
          <Hatch id="pencil-hatch-water" background={STYLE.colors.water} color="#3a3a3a" angle={0} gap={6} opacity={0.35} />
          <Grain id="pencil-grain" color="#5a5040" frequency={0.8} slope={0.35} offset={-0.05} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
        {/* Druga kreska głównych dróg z innym drganiem: szkic poprawiany ręką. */}
        {layers.major && (
          <path
            d={layers.major}
            fill="none"
            stroke={STYLE.colors.major}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.6}
            filter="url(#pencil-wobble-2)"
          />
        )}
      </>
    ),
    overlay: <Overlay filter="url(#pencil-grain)" />,
    route: { stroke: '#c8102e', width: 10, filter: 'url(#pencil-route)' },
    text: { color: '#2b2b2b' },
    mark: 'black',
  }),
};
