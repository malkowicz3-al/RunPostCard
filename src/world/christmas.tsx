import type { MapStyle } from '../postcard/mapStyle';
import { Overlay } from '../postcard/themes/texture';
import { box, poly } from './geom';
import type { Pt } from './grid';
import { DASHES, WIDTHS, dot, holidayTheme, paint, r1, rays } from './holiday';

const INK = '#22303a';
const PINE = '#1f6b3a';
const GOLD = '#ffc531';
const ICE = '#5b9bc4';
const LIGHTS = ['#e8202a', GOLD, '#2fa84f', '#2f7fe0'];

// Zimowe miasto: śnieżna ziemia, ciemna turkusowa woda z lodowym brzegiem, parki ze świerkami, ośnieżone dachy
// z ceglanym obrysem; girlandy lampek na domkach, choinki na co piątym, choinka z prezentem na punktach
// orientacyjnych, płatki śniegu w rogach, padający śnieg.
const STYLE: MapStyle = {
  background: '#f4f8fc',
  colors: {
    field: '#eef3f6',
    landuse: '#e9eef3',
    industrial: '#e4e6ee',
    civic: '#f3e9e4',
    water: '#1f5f6b',
    waterway: '#1f5f6b',
    green: '#dfeee6',
    sport: '#e8f2ee',
    building: '#c9794a', // ściany w 3D; płasko śnieg z fills
    tunnel: '#1f2a33',
    rail: '#22303a',
    runway: '#ffffff',
    path: '#b9c6d2',
    bridge: '#ffffff',
    minor: '#ffffff',
    mid: '#ffffff',
    major: '#ffffff', // ulica trasy rysowana osobno
  },
  widths: { ...WIDTHS, building: 2 },
  dashes: DASHES,
  fills: { green: 'url(#world-christmas-pines)', building: '#fdfdfd' },
  outlines: { water: '#cfe8ef', building: '#a8553a' },
  buildings3d: 'gabled',
};

// Girlanda nad środkiem domku: drut i 4 lampki.
const BULBS: Pt[] = [[-12, -4], [-4, -1.5], [4, -1.5], [12, -4]];
// Choinka ok. 44×52 i prezent ok. 40×36 (przy skali 1).
const TIERS: Pt[][] = [
  [[-14, -12], [0, -30], [14, -12]],
  [[-18, 0], [0, -20], [18, 0]],
  [[-22, 12], [0, -8], [22, 12]],
];
const star = (x: number, y: number, r: number) =>
  poly(Array.from({ length: 10 }, (_, k): Pt => {
    const a = ((k * 36 - 90) * Math.PI) / 180;
    const q = k % 2 ? r * 0.45 : r;
    return [q * Math.cos(a), q * Math.sin(a)];
  }), x, y);
const scale = (pts: Pt[], k: number) => pts.map(([px, py]): Pt => [px * k, py * k]);
// Choinka w skali k: pień, trzy piętra, bombki w kolorach lampek, gwiazda; części [kolor, d] do paint.
function tree(x: number, y: number, k: number): { trunk: string; pine: string; star: string; balls: [string, string][] } {
  const balls: Pt[] = [[-8, 6], [7, -4], [-4, -14], [10, 9], [0, 2]];
  return {
    trunk: poly(scale(box(-4, 12, 4, 20), k), x, y),
    pine: TIERS.map((t) => poly(scale(t, k), x, y)).join(''),
    star: star(x, y - 32 * k, 7 * k),
    balls: balls.map(([bx, by], i): [string, string] => [LIGHTS[i % 4], dot(x + bx * k, y + by * k, 2.6 * k)]),
  };
}

// Płatek: 6 ramion z dwiema gałązkami.
function flake([cx, cy]: Pt, r: number) {
  let d = rays(cx, cy, 0, r, 6, -90);
  for (let k = 0; k < 6; k++) {
    const a = ((k * 60 - 90) * Math.PI) / 180;
    const [bx, by] = [cx + 0.55 * r * Math.cos(a), cy + 0.55 * r * Math.sin(a)];
    for (const s of [-1, 1]) {
      const b = a + s * (Math.PI / 4);
      d += `M${r1(bx)} ${r1(by)}l${r1(0.3 * r * Math.cos(b))} ${r1(0.3 * r * Math.sin(b))}`;
    }
  }
  return d;
}

export const christmas = holidayTheme({
  id: 'christmas',
  label: 'Christmas',
  font: 'mountains',
  style: STYLE,
  casing: '#b8c4d0',
  route: { stroke: '#c8102e', outline: '#0f3d2a' },
  text: '#0f3d2a',
  halo: '#f4f8fc',
  mark: 'black',
  defs: (
    <>
      <pattern id="world-christmas-pines" patternUnits="userSpaceOnUse" width={64} height={64}>
        <rect width={64} height={64} fill={STYLE.colors.green} />
        <path d="M14 8L22 26H6ZM44 30L52 48H36ZM18 42L24 56H12Z" fill={PINE} />
        <path d="M14 8L17 15H11ZM44 30L47 37H41ZM18 42L20 47H16Z" fill="#ffffff" />
      </pattern>
      <pattern id="world-christmas-snow" patternUnits="userSpaceOnUse" width={140} height={140}>
        <path d={dot(20, 30, 2.5) + dot(90, 12, 1.8) + dot(60, 80, 3) + dot(120, 100, 2) + dot(30, 120, 1.6) + dot(100, 60, 1.4)} fill="#ffffff" opacity={0.85} />
      </pattern>
    </>
  ),
  decor: ({ houses, marks }) => {
    const ink = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const };
    const bulbs = houses.flatMap((h, i) => BULBS.map(([dx, dy], k): [string, string] => [LIGHTS[(i + k) % 4], dot(h.x + dx, h.y + dy, 4.2)]));
    // Duża choinka (skala 1.4) z prezentem obok na punktach orientacyjnych, mała na co piątym domku.
    const trees = [
      ...marks.map(([x, y]) => tree(x - 16, y, 1.4)),
      ...houses.filter((_, i) => i % 5 === 2).map((h) => tree(h.x, h.y + 16, 0.6)),
    ];
    const gifts = marks.map(([x, y]): Pt => [x + 34, y + 12]);
    const gift = scale([...box(-18, -6, 18, 18), ...box(-20, -13, 20, -6)], 0.9);
    return (
      <>
        <path d={houses.map((h) => `M${h.x - 17} ${h.y - 7}Q${h.x} ${h.y + 3} ${h.x + 17} ${h.y - 7}`).join('')} fill="none" stroke={INK} strokeWidth={1.5} />
        {paint(bulbs, { stroke: INK, strokeWidth: 0.8 })}
        {trees.length > 0 && (
          <>
            <path d={trees.map((t) => t.trunk).join('')} fill="#6b3e1f" {...ink} />
            <path d={trees.map((t) => t.pine).join('')} fill={PINE} {...ink} />
            {paint(trees.flatMap((t) => t.balls))}
            <path d={trees.map((t) => t.star).join('')} fill={GOLD} {...ink} strokeWidth={1} />
          </>
        )}
        {gifts.length > 0 && (
          <>
            <path d={gifts.map(([x, y]) => poly(gift.slice(0, 4), x, y) + poly(gift.slice(4), x, y)).join('')} fill="#2a8a4a" {...ink} />
            <path
              d={gifts
                .map(([x, y]) => poly(scale(box(-3, -13, 3, 18), 0.9), x, y) + poly(scale([[0, -13], [-12, -22], [-10, -13]], 0.9), x, y) + poly(scale([[0, -13], [12, -22], [10, -13]], 0.9), x, y))
                .join('')}
              fill={GOLD}
              {...ink}
              strokeWidth={1}
            />
          </>
        )}
      </>
    );
  },
  overlay: ([ax, ay], [bx, by]) => (
    <>
      <Overlay fill="url(#world-christmas-snow)" />
      <path
        d={flake([ax, ay - 8], 52) + flake([bx - 60, by], 30) + flake([bx + 14, by], 32) + flake([bx + 54, by + 22], 12)}
        fill="none"
        stroke={ICE}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),
});
