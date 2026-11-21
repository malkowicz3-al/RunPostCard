import type { MapStyle } from '../postcard/mapStyle';
import { DASHES, WIDTHS, holidayTheme, paint, r1 } from './holiday';

const INK = '#7a0f2a';
const HEARTS = ['#e0245e', '#ff8fab'];

// Walentynki: różowa ziemia, różane bryły, serca w parkach, nad domkami, na punktach orientacyjnych (ze strzałą)
// i w rogach; czerwona trasa z białym konturem.
const STYLE: MapStyle = {
  background: '#fde4ec',
  colors: {
    field: '#fbd5df',
    landuse: '#fbdde6',
    industrial: '#f2d4e2',
    civic: '#fde9d9',
    water: '#e8b4c8',
    waterway: '#e8b4c8',
    green: '#f6c6d4',
    sport: '#f8cfdb',
    building: '#e57a95',
    tunnel: '#e2b7c3',
    rail: '#d9a3b3',
    runway: '#ffffff',
    path: '#fff4f7',
    bridge: '#ffffff',
    minor: '#ffffff',
    mid: '#fff4f7',
    major: '#f7b9cb', // ulica trasy rysowana osobno; różowa, żeby biały kontur trasy był widoczny
  },
  widths: WIDTHS,
  dashes: DASHES,
  fills: { green: 'url(#world-valentine-hearts)' },
  outlines: { water: '#c97a98', building: '#c2556f' },
  buildings3d: 'gabled',
};

// Serce szerokości s ze środkiem w (x, y) (wysokość ok. s).
export const heart = (x: number, y: number, s: number) => {
  const p = (u: number, v: number) => `${r1(x + u * s)} ${r1(y + v * s)}`;
  return `M${p(0, -0.3)}C${p(0, -0.6)} ${p(-0.5, -0.6)} ${p(-0.5, -0.25)}C${p(-0.5, 0.05)} ${p(-0.2, 0.25)} ${p(0, 0.5)}C${p(0.2, 0.25)} ${p(0.5, 0.05)} ${p(0.5, -0.25)}C${p(0.5, -0.6)} ${p(0, -0.6)} ${p(0, -0.3)}Z`;
};

export const valentine = holidayTheme({
  id: 'valentine',
  label: "Valentine's",
  font: 'lobster',
  style: STYLE,
  casing: '#e6a8b8',
  route: { stroke: '#b0122f', outline: '#ffffff' },
  text: INK,
  mark: 'black',
  defs: (
    <pattern id="world-valentine-hearts" patternUnits="userSpaceOnUse" width={64} height={64}>
      <rect width={64} height={64} fill={STYLE.colors.green} />
      <path d={heart(16, 18, 12) + heart(46, 46, 10)} fill="#e86a8a" />
    </pattern>
  ),
  decor: ({ houses, marks }) => (
    <>
      {paint(houses.map((h, i) => [HEARTS[i % 2], heart(h.x, h.y, 14)]))}
      {marks.length > 0 && (
        <>
          <path d={marks.map(([x, y]) => `M${x - 43} ${y + 20}L${x + 38} ${y - 18}`).join('')} fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <path d={marks.map(([x, y]) => heart(x, y, 56)).join('')} fill={HEARTS[0]} stroke="#ffffff" strokeWidth={3} />
          <path
            d={marks.map(([x, y]) => `M${x + 46} ${y - 22}L${x + 30} ${y - 23}L${x + 37} ${y - 10}ZM${x - 43} ${y + 20}l-10 -8l3 11ZM${x - 43} ${y + 20}l-4 11l11 -3Z`).join('')}
            fill={INK}
          />
        </>
      )}
    </>
  ),
  overlay: ([ax, ay], [bx, by]) => (
    <>
      <path d={heart(ax, ay - 6, 96)} fill={HEARTS[0]} stroke="#ffffff" strokeWidth={4} />
      <path d={heart(ax, ay - 2, 52)} fill={HEARTS[1]} />
      {paint([[HEARTS[0], heart(bx - 62, by - 2, 56)], [HEARTS[1], heart(bx - 4, by + 4, 46)], ['#c2185b', heart(bx + 44, by - 6, 34)]], { stroke: '#ffffff', strokeWidth: 3 })}
    </>
  ),
});
