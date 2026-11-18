import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import type { MapTheme } from './index';
import { Dots, Outline } from './texture';

const PAPER = '#ffe347';
const INK = '#000000';
const OUTLINED = 'url(#popcomic-outline)';

// Komiks pop-art: nasycone barwy podstawowe, kolorowe kropki rastra, grube czarne kontury głównych dróg.
const STYLE: MapStyle = {
  background: PAPER,
  colors: {
    // Szczegóły jasne albo czarne: średnie tony nie odcinają się od czerwieni (kontrast < 2).
    field: '#fff07a',
    landuse: '#ffec6a',
    industrial: '#fff3a0',
    civic: '#ffe98a',
    water: '#6ec6ff', // kolory jak średnia rastra (miniatury)
    waterway: '#0a5fd6',
    green: '#7ad65a',
    sport: '#b8f0a0',
    building: '#ff7aa8',
    tunnel: '#fff6c0',
    rail: INK,
    runway: '#fff3a0',
    path: '#333333',
    bridge: INK,
    minor: '#1a1a1a',
    mid: '#ffffff',
    major: '#ffffff',
  },
  widths: { waterway: 3, path: 1.5, minor: 2.5, mid: 5, major: 7, rail: 2, tunnel: 2, bridge: 9, runway: 8 },
  dashes: { rail: '10 6', tunnel: '4 4' },
  fills: { water: 'url(#popcomic-water)', green: 'url(#popcomic-green)', building: 'url(#popcomic-building)' },
  filters: { mid: OUTLINED, major: OUTLINED },
};

export const popcomic: MapTheme = {
  label: 'Pop Comic',
  font: 'bungee',
  style: () => STYLE,
  render: (layers) => ({
    scene: (
      <>
        <defs>
          <Dots id="popcomic-water" background="#a8dcff" color="#0a7ae0" r={2.4} gap={8} />
          <Dots id="popcomic-green" background="#a8ec8a" color="#1a9a2a" r={2.2} gap={8} />
          <Dots id="popcomic-building" background="#ffb0cc" color="#e0105a" r={2.6} gap={8} />
          <Outline id="popcomic-outline" color={INK} radius={2.5} />
          <Outline id="popcomic-route" color={INK} radius={4} />
        </defs>
        <MapBackground layers={layers} style={STYLE} />
      </>
    ),
    route: { stroke: '#ff1a1a', width: 14, filter: 'url(#popcomic-route)' },
    text: { color: INK },
    mark: 'black',
  }),
};
