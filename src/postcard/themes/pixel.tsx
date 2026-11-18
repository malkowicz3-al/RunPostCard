import { PIXEL } from '../../lib/vectorMap';
import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import { placeIcons, staircase, type Icon } from './geometry';
import type { MapTheme } from './index';

// Motyw 8-bit: miasto ze starej gry, mapa i ikony na siatce 24, paleta 8 kolorów, schodkowa trasa (ADR 0005).
export const GRID = 24;
const PALETTE: Record<string, string> = {
  g: '#3e8948', // trawa
  d: '#265c42', // las
  b: '#2b4fb0', // woda, okna
  t: '#8b5a3c', // budynki, pnie, drzwi
  y: '#e8c170', // drogi, kamienice
  w: '#f4f4f4',
  r: '#ff004d',
  k: '#1d1d1d',
};

const STYLE: MapStyle = {
  background: PALETTE.g,
  colors: {
    water: PALETTE.b,
    waterway: PALETTE.b,
    green: PALETTE.d,
    building: PALETTE.t,
    path: PALETTE.y,
    minor: PALETTE.y,
    mid: PALETTE.y,
    major: PALETTE.w,
  },
  widths: { waterway: 24, path: 8, minor: 16, mid: 24, major: 32 },
  linecap: 'square',
};

// Sprite: wiersz = string, znak = kolor z PALETTE, '.' = przezroczysty.
export const SPRITES: Record<string, string[]> = {
  tree: ['..kkkk..', '.kggggk.', 'kggggggk', 'kggggggk', '.kggggk.', '..kttk..', '...tt...', '..kttk..'],
  pine: ['...kk...', '..kggk..', '..kggk..', '.kggggk.', '.kggggk.', 'kggggggk', 'kkkttkkk', '...tt...'],
  house: ['...kk...', '..krrk..', '.krrrrk.', 'krrrrrrk', '.kwwwwk.', '.kwbwtk.', '.kwwwtk.', '.kkkkkk.'],
  block: ['kkkkkkkk', 'kyyyyyyk', 'kybyybyk', 'kyyyyyyk', 'kybyybyk', 'kyyyyyyk', 'kyyttyyk', 'kkkkkkkk'],
  tower: [
    '...rr...',
    '...kk...',
    'kkkkkkkk',
    'kwwwwwwk',
    'kwbwwbwk',
    'kwwwwwwk',
    'kwbwwbwk',
    'kwwwwwwk',
    'kwbwwbwk',
    'kwwwwwwk',
    'kwbwwbwk',
    'kwwwwwwk',
    'kwbwwbwk',
    'kwwwwwwk',
    'kwwkkwwk',
    'kkkkkkkk',
  ],
};

// Rozmiar „piksela” sprite'a, wspólny dla wszystkich (spójna grafika); wymiar ikony = kolumny/wiersze × piksel.
export const PIXEL_SIZE: Record<string, number> = { tree: 12, pine: 12, house: 12, block: 12, tower: 12 };
export const spriteSize = (name: string): [number, number] => [
  SPRITES[name][0].length * PIXEL_SIZE[name],
  SPRITES[name].length * PIXEL_SIZE[name],
];

// Poziome serie jednego znaku -> [x, y, szerokość, znak].
export function spriteRects(rows: string[]): [number, number, number, string][] {
  const out: [number, number, number, string][] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      let end = x + 1;
      while (row[end] === row[x]) end++;
      if (row[x] !== '.') out.push([x, y, end - x, row[x]]);
      x = end;
    }
  });
  return out;
}

const symbol = (name: string) => {
  const rows = SPRITES[name];
  return (
    <symbol key={name} id={`pixel-${name}`} viewBox={`0 0 ${rows[0].length} ${rows.length}`}>
      {spriteRects(rows).map(([x, y, w, ch]) => (
        <rect key={`${x} ${y}`} x={x} y={y} width={w} height={1} fill={PALETTE[ch]} />
      ))}
    </symbol>
  );
};

const use = (name: string, { x, y, w, h, flip }: Omit<Icon, 'flip'> & { flip?: boolean }, key: string) => (
  <use
    key={key}
    href={`#pixel-${name}`}
    x={x}
    y={y}
    width={w}
    height={h}
    transform={flip ? `translate(${2 * x + w} 0) scale(-1 1)` : undefined}
  />
);

const [TREE] = spriteSize('tree');
const [HOUSE] = spriteSize('house');
const [TOWER_W, TOWER_H] = spriteSize('tower');
const fixed = (w: number) => ({ k: 1, min: w, max: w });

export const pixel: MapTheme = {
  label: '8-bit',
  profile: PIXEL,
  render: (input) => {
    const icons = placeIcons(input, {
      routeWidth: 36, // trasa 24 + obwódka 2 × 6
      grid: GRID,
      castles: { count: 3, spacing: 300, ...fixed(TOWER_W), aspect: TOWER_H / TOWER_W },
      houses: { count: 16, spacing: 144, ...fixed(HOUSE) },
      trees: { spacing: 120, size: TREE, max: 80 },
    });
    return {
      scene: (
        <g shapeRendering="crispEdges">
          <defs>{Object.keys(SPRITES).map(symbol)}</defs>
          <MapBackground layers={input.map.layers} style={STYLE} />
          {icons.trees.map((t, i) => use(i % 3 ? 'tree' : 'pine', t, `t${i}`))}
          {/* Domy idą malejąco po polu budynku: większa trzecia część to kamienice. */}
          {icons.houses.map((h, i) => use(i < icons.houses.length / 3 ? 'block' : 'house', h, `h${i}`))}
          {icons.castles.map((c, i) => use('tower', c, `c${i}`))}
        </g>
      ),
      route: {
        stroke: PALETTE.r,
        width: 24,
        outline: PALETTE.k,
        outlineWidth: 6,
        crisp: true,
        d: staircase(input.route, GRID),
      },
      text: { color: '#ffffff', outline: PALETTE.k, outlineWidth: 8 },
      mark: 'white',
    };
  },
};
