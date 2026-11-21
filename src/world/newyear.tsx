import type { MapStyle } from '../postcard/mapStyle';
import { Overlay } from '../postcard/themes/texture';
import { poly } from './geom';
import type { Pt } from './grid';
import { DASHES, WIDTHS, dot, holidayTheme, paint, rays } from './holiday';

const CHAMPAGNE = '#fff1c4';
const FIRE = ['#ff4fa3', '#38d6ff', '#b37bff'];

// Sylwestrowa noc: granatowa ziemia, ciemniejsza woda, przygaszone brązowe bryły (złoty tekst i trasa na wierzchu), iskry nad domkami, fajerwerki na punktach
// orientacyjnych i w rogach, konfetti w nakładce; złota trasa z granatowym konturem.
const STYLE: MapStyle = {
  background: '#0b1230',
  colors: {
    field: '#121c40',
    landuse: '#0f1838',
    industrial: '#141a3a',
    civic: '#1a1a40',
    water: '#060a1c',
    waterway: '#060a1c',
    green: '#12224a',
    sport: '#16244e',
    building: '#8a6d2f',
    tunnel: '#2a3360',
    rail: '#8a7a4a',
    runway: '#2b3870',
    path: '#3a4680',
    bridge: '#4a5aa0',
    minor: '#2b3870',
    mid: '#3b4a8c',
    major: '#48589e', // ulica trasy rysowana osobno
  },
  widths: WIDTHS,
  dashes: DASHES,
  outlines: { water: '#2a3a6e', building: '#a8884a' },
  buildings3d: 'plain',
};

const SPARKLE: Pt[] = [[0, -6], [1.5, -1.5], [6, 0], [1.5, 1.5], [0, 6], [-1.5, 1.5], [-6, 0], [-1.5, -1.5]];
// Wybuch: 12 promieni z kropkami na końcach.
const burst = (x: number, y: number, r: number) => rays(x, y, r * 0.25, r * 0.85, 12);
const tips = (x: number, y: number, r: number) =>
  Array.from({ length: 12 }, (_, k) => dot(x + r * Math.cos((k * Math.PI) / 6), y + r * Math.sin((k * Math.PI) / 6), Math.max(2, r / 16))).join('');

export const newyear = holidayTheme({
  id: 'newyear',
  label: "New Year's Eve",
  font: 'monoton',
  style: STYLE,
  casing: '#070b22',
  route: { stroke: '#ffc93c', outline: '#050818' },
  text: CHAMPAGNE,
  halo: '#0b1230',
  mark: 'white',
  defs: (
    <pattern id="world-newyear-confetti" patternUnits="userSpaceOnUse" width={160} height={160}>
      <g opacity={0.85}>
        <path d={poly([[-3, -1.5], [3, -1.5], [3, 1.5], [-3, 1.5]], 24, 30, 30) + poly([[-3, -1.5], [3, -1.5], [3, 1.5], [-3, 1.5]], 120, 110, -40)} fill={FIRE[0]} />
        <path d={poly([[-3, -1.5], [3, -1.5], [3, 1.5], [-3, 1.5]], 80, 60, 70) + dot(140, 20, 2)} fill={FIRE[1]} />
        <path d={dot(40, 130, 2.2) + poly([[-3, -1.5], [3, -1.5], [3, 1.5], [-3, 1.5]], 100, 150, 15)} fill="#ffc93c" />
        <path d={dot(10, 90, 1.6) + dot(150, 70, 1.6)} fill={CHAMPAGNE} />
      </g>
    </pattern>
  ),
  decor: ({ houses, marks }) => {
    // Nad punktem orientacyjnym duży wybuch (ok. 120 px) i mniejszy obok w innym kolorze.
    const bursts = marks.flatMap(([x, y], i): [string, number, number, number][] => [
      [FIRE[i % 3], x, y - 10, 60],
      [FIRE[(i + 1) % 3], x + 52, y - 48, 32],
    ]);
    return (
      <>
        <path d={houses.filter((_, i) => i % 2 === 0).map((h) => poly(SPARKLE, h.x, h.y)).join('')} fill={CHAMPAGNE} />
        {paint(bursts.map(([c, x, y, r]): [string, string] => [c, burst(x, y, r)]), { strokeWidth: 3.5 }, true)}
        {paint(bursts.map(([c, x, y, r]): [string, string] => [c, tips(x, y, r) + dot(x, y, r / 9)]))}
      </>
    );
  },
  overlay: ([ax, ay], [bx, by]) => (
    <>
      <Overlay fill="url(#world-newyear-confetti)" />
      {paint(
        [
          [FIRE[0], burst(ax, ay - 12, 54)],
          ['#ffc93c', rays(ax, ay - 12, 6, 26, 8, 22.5)],
          [FIRE[1], burst(bx - 58, by, 33)],
          [FIRE[2], burst(bx + 30, by, 33)],
        ],
        { strokeWidth: 4 },
        true,
      )}
      {paint([[FIRE[0], tips(ax, ay - 12, 54)], [FIRE[1], tips(bx - 58, by, 33)], [FIRE[2], tips(bx + 30, by, 33)]])}
    </>
  ),
});
