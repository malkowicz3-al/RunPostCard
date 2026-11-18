import { POSTCARD, type Rect } from '../../lib/vectorMap';
import { MapBackground } from '../MapBackground';
import { MINIMAL, type MapStyle } from '../mapStyle';
import { placeIcons, type Icon } from './geometry';
import type { MapTheme } from './index';

// Motyw fantasy: pergamin, drżące linie atramentu, woda w falach, ikony rysowane kodem (ADR 0005).
const INK = '#4a3420';
const PAPER = '#f1e3c3';
const PAPER_EDGE = '#d8bf8f';
const FONT = "'Barlow Condensed', system-ui, sans-serif";

const STYLE: MapStyle = {
  background: 'url(#fantasy-parchment)',
  colors: {
    water: 'url(#fantasy-waves)',
    waterway: INK,
    green: '#cfd09a',
    building: '#e2c99a',
    path: INK,
    minor: INK,
    mid: INK,
    major: INK,
  },
  widths: MINIMAL.widths,
};

const ink = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

const SYMBOLS = (
  <>
    <symbol id="fantasy-tree" viewBox="0 0 20 24">
      <path d="M10 1L17 14H13L18 20H2L7 14H3Z" fill="#7d8a4a" {...ink} />
      <path d="M10 20V23" {...ink} strokeWidth={2} />
    </symbol>
    <symbol id="fantasy-house" viewBox="0 0 24 24">
      <path d="M5 11H19V22H5Z" fill="#ead7ad" {...ink} />
      <path d="M2 12L12 3L22 12Z" fill="#9a6b3f" {...ink} />
      <path d="M10 22V16H14V22" fill={INK} {...ink} />
    </symbol>
    <symbol id="fantasy-castle" viewBox="0 0 40 40">
      <path d="M14 38V20H16V17H19V20H21V17H24V20H26V38Z" fill="#ead7ad" {...ink} />
      <path d="M4 38V12H6V9H8V12H10V9H12V12H14V38Z" fill="#ead7ad" {...ink} />
      <path d="M26 38V12H28V9H30V12H32V9H34V12H36V38Z" fill="#ead7ad" {...ink} />
      <path d="M17 38V31A3 3 0 0 1 23 31V38Z" fill={INK} />
      <path d="M8 17V21M30 17V21" {...ink} strokeWidth={2} />
      <path d="M9 9V2L14 4L9 6" fill="#8b1e1e" {...ink} />
    </symbol>
    <symbol id="fantasy-dragon" viewBox="0 0 64 40">
      <path
        d="M30 26L27 5L35 13L40 3L44 15L51 10L45 24Z"
        fill="#9aa25a"
        {...ink}
      />
      <path
        d="M2 24Q10 34 20 28Q26 24 34 26L44 22Q50 16 56 16L62 18L57 22L50 24Q46 30 40 32L42 38H38L36 33L28 34L29 38H25L24 33Q12 37 2 24Z"
        fill="#6f7f3f"
        {...ink}
      />
      <circle cx={55} cy={18.5} r={1} fill={INK} />
    </symbol>
  </>
);

const uses = (name: string, icons: (Omit<Icon, 'flip'> & { flip?: boolean })[]) =>
  icons.map(({ x, y, w, h, flip }, i) => (
    <use
      key={`${name}${i}`}
      href={`#fantasy-${name}`}
      x={x}
      y={y}
      width={w}
      height={h}
      transform={flip ? `translate(${2 * x + w} 0) scale(-1 1)` : undefined}
    />
  ));

// Róża wiatrów: gwiazda o n ramionach, wierzchołki naprzemiennie na promieniu outer i inner.
const star = (cx: number, cy: number, n: number, outer: number, inner: number, rot = 0) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    return `${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`;
  }).join(' ');

const COMPASS = { cx: 965, cy: 135, r: 70 };
const COMPASS_RECT: Rect = [885, 20, 1045, 215];

function Compass() {
  const { cx, cy, r } = COMPASS;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 0.72} fill="none" {...ink} strokeWidth={2} />
      <polygon points={star(cx, cy, 4, r * 0.62, r * 0.14, Math.PI / 4)} fill={PAPER_EDGE} {...ink} />
      <polygon points={star(cx, cy, 4, r, r * 0.2)} fill={INK} {...ink} />
      <text x={cx} y={cy - r - 8} fontSize={34} fontWeight={700} fontFamily={FONT} textAnchor="middle" fill={INK}>
        N
      </text>
    </g>
  );
}

// Kartusz nad ROUTE_BOX (y < 260): wstęga z nazwą biegu, razem z końcówkami ≤ 680 szerokości.
const TAIL = 50;
const MAX_BODY = 680 - 2 * TAIL;
const FONT_SIZE = 40;
const SPACING = 4;

function cartouche(name: string) {
  const chars = [...name.toUpperCase()];
  const label = chars.length > 28 ? chars.slice(0, 27).join('') + '…' : chars.join('');
  // Szacunek szerokości Barlow Condensed Bold; textLength pilnuje, żeby długa nazwa się zmieściła.
  const estimate = [...label].length * (FONT_SIZE * 0.5 + SPACING);
  const body = Math.min(MAX_BODY, Math.max(320, estimate + 100));
  const x0 = 540 - body / 2;
  const x1 = 540 + body / 2;
  const tail = (x: number, dir: number) =>
    `M${x} 112H${x - dir * TAIL}L${x - dir * (TAIL - 20)} 142L${x - dir * TAIL} 172H${x}Z`;
  const node = (
    <g>
      <path d={tail(x0, 1) + tail(x1, -1)} fill={PAPER_EDGE} {...ink} strokeWidth={3} />
      <rect x={x0} y={92} width={body} height={100} fill={PAPER} {...ink} strokeWidth={3} />
      <rect x={x0 + 8} y={100} width={body - 16} height={84} fill="none" {...ink} />
      <text
        x={540}
        y={142 + FONT_SIZE * 0.35}
        fontSize={FONT_SIZE}
        fontWeight={700}
        fontFamily={FONT}
        letterSpacing={SPACING}
        textAnchor="middle"
        fill={INK}
        {...(estimate > body - 60 ? { textLength: body - 60, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {label}
      </text>
    </g>
  );
  return { node, rect: [x0 - TAIL, 82, x1 + TAIL, 202] as Rect };
}

export const fantasy: MapTheme = {
  label: 'Fantasy',
  profile: POSTCARD,
  render: (input) => {
    const title = cartouche(input.activity.name);
    const icons = placeIcons(
      { ...input, exclude: [...input.exclude, title.rect, COMPASS_RECT] },
      {
        routeWidth: 10,
        dragon: { min: 280, max: 500, minWater: 60000 },
        castles: { count: 3, spacing: 360, k: 5, min: 128, max: 220 },
        houses: { count: 20, spacing: 110, k: 3.5, min: 44, max: 64 },
        trees: { spacing: 64, size: 56, max: 200 },
      },
    );
    return {
      scene: (
        <>
          <defs>
            <radialGradient id="fantasy-parchment" cx="0.5" cy="0.5" r="0.75">
              <stop offset="0.45" stopColor={PAPER} />
              <stop offset="1" stopColor={PAPER_EDGE} />
            </radialGradient>
            <filter id="fantasy-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            {/* Region większy niż płótno, żeby przesunięte brzegi nie były puste. */}
            <filter id="fantasy-wobble" filterUnits="userSpaceOnUse" x={-20} y={-20} width={1120} height={1960}>
              <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <pattern id="fantasy-waves" patternUnits="userSpaceOnUse" width="28" height="14">
              <rect width="28" height="14" fill="#b9cfc4" />
              <path d="M3 9Q8 4 13 9T23 9" fill="none" {...ink} strokeWidth={1.2} opacity={0.7} />
            </pattern>
            {SYMBOLS}
          </defs>
          {/* Pergamin bez filtra: przesunięcie zostawiałoby przezroczysty brzeg na krawędziach. */}
          <rect width={1080} height={1920} fill={STYLE.background} />
          {/* Drżenie tylko na mapie i ikonach; trasa i tekst zostają dokładne. */}
          <g filter="url(#fantasy-wobble)">
            <MapBackground layers={input.map.layers} style={{ ...STYLE, background: 'none' }} />
            {uses('tree', icons.trees)}
            {uses('house', icons.houses)}
            {uses('castle', icons.castles)}
            {icons.dragon && uses('dragon', [icons.dragon])}
          </g>
          <rect width="1080" height="1920" filter="url(#fantasy-grain)" opacity="0.07" />
        </>
      ),
      overlay: (
        <>
          {title.node}
          <Compass />
        </>
      ),
      route: { stroke: '#8b1e1e', width: 10 },
      text: { color: '#3b2a1a', outline: PAPER, outlineWidth: 6 },
      mark: 'black',
    };
  },
};
