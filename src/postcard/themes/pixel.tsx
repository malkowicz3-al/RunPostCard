import { PIXEL } from '../../lib/vectorMap';
import { MapBackground } from '../MapBackground';
import type { MapStyle } from '../mapStyle';
import { placeIcons, staircase, type Icon } from './geometry';
import type { MapTheme } from './index';

// Motyw 8-bit: mapa i ikony na siatce 12, paleta 8 kolorów, schodkowa trasa (ADR 0005).
const GRID = 12;
const PALETTE: Record<string, string> = {
  g: '#3e8948', // trawa
  d: '#265c42', // las
  b: '#2b4fb0', // woda
  t: '#8b5a3c', // budynki, pnie
  y: '#e8c170', // drogi
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
  widths: { waterway: 12, path: 4, minor: 8, mid: 12, major: 16 },
  linecap: 'square',
};

// Sprite: wiersz = string, znak = kolor z PALETTE, '.' = przezroczysty.
const SPRITES: Record<string, string[]> = {
  tree: ['..kkkk..', '.kggggk.', 'kggggggk', 'kggggggk', '.kggggk.', '..kttk..', '...tt...', '..kttk..'],
  house: ['...kk...', '..krrk..', '.krrrrk.', 'krrrrrrk', '.wwwwww.', '.wwkkww.', '.wwkkww.', '.kkkkkk.'],
  castle: [
    '.....k......',
    '.....krr....',
    'k.k..k...k.k',
    'kkk.kkkk.kkk',
    'kwk.kwwk.kwk',
    'kwkkkwwkkkwk',
    'kwwwwwwwwwwk',
    'kwkwwwwwwkwk',
    'kwwwwkkwwwwk',
    'kwwwkkkkwwwk',
    'kwwwkkkkwwwk',
    'kkkkkkkkkkkk',
  ],
  dragon: [
    '......kk........',
    '.....krrk.......',
    '....krrrrk...kk.',
    '...krrrrrk..krrk',
    '..krrrrrk..krwrk',
    'k..krrrrkkkrrrrk',
    'rk.krrrrrrrrrkk.',
    'krkrrrrrrrrrk...',
    '.krrryyyyyrrk...',
    '..kkryyyyyrk....',
    '....krk.krk.....',
    '....kk...kk.....',
  ],
};

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

const uses = (name: string, icons: (Omit<Icon, 'flip'> & { flip?: boolean })[]) =>
  icons.map(({ x, y, size, flip }, i) => (
    <use
      key={`${name}${i}`}
      href={`#pixel-${name}`}
      x={x}
      y={y}
      width={size}
      height={size}
      transform={flip ? `translate(${2 * x + size} 0) scale(-1 1)` : undefined}
    />
  ));

export const pixel: MapTheme = {
  label: '8-bit',
  profile: PIXEL,
  render: (input) => {
    const icons = placeIcons(input, {
      routeWidth: 24,
      grid: GRID,
      dragon: { min: 144, max: 240, minWater: 40000 },
      castles: { count: 4, spacing: 220, k: 2, min: 72, max: 120 },
      houses: { count: 30, spacing: 80, k: 2, min: 36, max: 48 },
      trees: { spacing: 36, size: 24, max: 400 },
    });
    return {
      scene: (
        <g shapeRendering="crispEdges">
          <defs>{Object.keys(SPRITES).map(symbol)}</defs>
          <MapBackground layers={input.map.layers} style={STYLE} />
          {uses('tree', icons.trees)}
          {uses('house', icons.houses)}
          {uses('castle', icons.castles)}
          {icons.dragon && uses('dragon', [icons.dragon])}
        </g>
      ),
      route: {
        stroke: PALETTE.r,
        width: 12,
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
