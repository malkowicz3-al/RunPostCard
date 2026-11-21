import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { ReactNode } from 'react';
import type { Rect } from '../lib/mapTiles';
import type { Building, MapLayers, Street } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import { Hatch, Outline, Overlay, Vignette } from '../postcard/themes/texture';
import { center, corners, keepOutDist, landmarks } from './icons';
import { DEFAULT_FONT, FONTS, type FontId } from '../lib/fonts';
import { box, parseLines, poly, routeIndex } from './geom';
import type { Pt } from './grid';

const INK = '#3a2412';
const LAND = '#a9b58a';
const ROAD = '#e8dcb5';
const ROAD_EDGE = '#8f7f5a';
const WALL = '#efe3c2';
const STONE = '#c9c2ad';
const SLATE = '#4d5a63';
const ROOF = '#a5502f';
const FOG = '#211f23';
const GOLD = '#d9b45a';
const BLAZON = '#8a2d1f';

// Ręcznie rysowana mapa miasteczka i okolicy z późnego średniowiecza na prawdziwym szkielecie: szałwiowa ziemia
// z kreskowaniem, długie zagony pól, lasy z gęstych koron, łupkowe rzeki ze zmarszczkami, jasne polne drogi,
// prawdziwe obrysy brył jako dachy (kolory z decorateWorld) z kalenicą, kościoły z iglicami, ciemna ramka z kłębów
// mgły, tarcza herbowa i wstęga z nazwą ulicy trasy
// w górnych rogach. Tylko widok płaski (Genre.flat); ulice bez filtrów, bez ziarna (wydajność).
const STYLE: MapStyle = {
  background: LAND,
  fill: 'url(#world-medieval-land)',
  colors: {
    field: '#d9c27a',
    landuse: '#b9b58a',
    industrial: '#c2b48e',
    civic: '#cdb89a',
    water: '#6f8795',
    waterway: '#6f8795',
    green: '#7f9460',
    sport: '#c8b98f',
    building: '#b8a06a', // warstwa nierysowana: dachy z obrysów w floor
    tunnel: '#8a7f6a',
    rail: '#e6dfc8',
    runway: '#e6dfc8',
    path: '#efe6cc',
    bridge: '#d9c27a',
    minor: ROAD,
    mid: ROAD,
    major: ROAD, // polna droga pod trasą
  },
  widths: { water: 3, green: 2, waterway: 4, path: 1.2, minor: 3, mid: 5, major: 24, rail: 1.6, tunnel: 1.4, bridge: 5, runway: 5 },
  dashes: { path: '2 4', rail: '6 4', tunnel: '4 4' },
  fills: {
    water: 'url(#world-medieval-water)',
    green: 'url(#world-medieval-woods)',
    field: 'url(#world-medieval-field)',
    landuse: 'url(#world-medieval-meadow)',
    sport: 'url(#world-medieval-meadow)',
  },
  outlines: { water: '#44586a', green: '#3f4d2a' },
};

// Droga z ciemniejszym brzegiem: szersza kreska brzegu pod jezdnią, jedna ścieżka na warstwę.
function Road({ d, width, edge }: { d?: string; width: number; edge: number }) {
  if (!d) return null;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d={d} stroke={ROAD_EDGE} strokeWidth={edge} />
      <path d={d} stroke={ROAD} strokeWidth={width} />
    </g>
  );
}

// Kalenica wzdłuż dłuższego boku prostokąta otaczającego, wcięta o 35% krótszego boku (kwadrat: krótka kreska).
function ridge({ ring }: Building): string {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [w, h] = [x1 - x0, y1 - y0];
  if (Math.min(w, h) < 4) return '';
  const k = 0.35 * Math.min(w, h);
  const [cx, cy] = [Math.round((x0 + x1) * 5) / 10, Math.round((y0 + y1) * 5) / 10];
  return w >= h ? `M${Math.round((x0 + k) * 10) / 10} ${cy}H${Math.round((x1 - k) * 10) / 10}` : `M${cx} ${Math.round((y0 + k) * 10) / 10}V${Math.round((y1 - k) * 10) / 10}`;
}

// Kościół ok. 50×80: nawa z dachem, wieża z iglicą i krzyżem, drzwi i okno wieży.
const CHURCH_STONE: Pt[][] = [box(-20, -4, 14, 22), box(14, -20, 28, 22)];
const CHURCH_ROOFS: Pt[][] = [
  [[-22, -4], [-16, -14], [14, -14], [14, -4]],
  [[12, -20], [21, -48], [30, -20]],
];
const CHURCH_INK: Pt[][] = [box(-5, 12, 1, 22), box(19, -10, 23, -4), box(20.2, -57, 21.8, -47), box(17, -54, 25, -52.5)];

// Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
function floor(layers: MapLayers, rect?: Rect): ReactNode {
  const { widths } = STYLE;
  const shown = layers.building ? layers.buildings : undefined;
  const churchSet = landmarks(shown);
  const churches = churchSet.map((b) => center(b).map(Math.round) as Pt);
  // Dachy z prawdziwych obrysów, jedna ścieżka na kolor.
  const roofs = new Map<string, string>();
  for (const b of shown ?? []) roofs.set(b.accent ?? ROOF, (roofs.get(b.accent ?? ROOF) ?? '') + poly(b.ring, 0, 0));
  const all = (shapes: Pt[][], at: Pt[]) => at.map(([x, y]) => shapes.map((s) => poly(s, x, y)).join('')).join('');
  const ink = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: 'round' as const };
  return (
    <>
      <MapBackground
        layers={{ ...layers, building: undefined, minor: undefined, mid: undefined, major: undefined }}
        style={STYLE}
        rect={rect}
      />
      <Road d={layers.minor} width={widths.minor!} edge={5} />
      <Road d={layers.mid} width={widths.mid!} edge={8} />
      <Road d={layers.major} width={widths.major!} edge={30} />
      {roofs.size > 0 && (
        <>
          {[...roofs].map(([color, d]) => (
            <path key={color} d={d} fill={color} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          ))}
          <path d={shown!.map(ridge).join('')} fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
        </>
      )}
      {churches.length > 0 && (
        <>
          <path d={all(CHURCH_STONE, churches)} fill={STONE} {...ink} />
          <path d={all(CHURCH_ROOFS, churches)} fill={SLATE} {...ink} />
          <path d={all(CHURCH_INK, churches)} fill={INK} />
        </>
      )}
    </>
  );
}

// Ramka z kłębów mgły: koła na krawędziach (boki do 24 px, góra i dół do 58 px), w rogach koło 140 px o 40 px za
// płótnem i mniejsze obok na górnej i dolnej krawędzi. Każde koło z jasną obwódką (FOG_RIM) zmniejszone tak, żeby nie
// sięgało znaku Stravy, podpisu OSM (KEEP_OUT) ani statystyk górnych układów (TOP_STATS); co drugie z zawijasem.
// Stała, jedna ścieżka na kolor.
const FOG_STEP = 30;
const FOG_RIM = 6;
export const TOP_STATS = [60, 84, 1020, 300];
const topStatsDist = (x: number, y: number) =>
  Math.hypot(Math.max(TOP_STATS[0] - x, 0, x - TOP_STATS[2]), Math.max(TOP_STATS[1] - y, 0, y - TOP_STATS[3]));
function fogPaths(): [string, string, string] {
  const puffs: [number, number, number, number, number][] = []; // x, y, r, kierunek do środka płótna
  const edges: [Pt, Pt, Pt, number][] = [
    [[0, 0], [1080, 0], [0, 1], 58],
    [[0, 1920], [1080, 1920], [0, -1], 58],
    [[0, 0], [0, 1920], [1, 0], 24],
    [[1080, 0], [1080, 1920], [-1, 0], 24],
  ];
  let k = 0;
  for (const [[x0, y0], [x1, y1], [nx, ny], max] of edges) {
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / FOG_STEP);
    for (let i = 0; i <= n; i++, k++) puffs.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, max - ((k * 5) % 7) * (max / 24), nx, ny]);
  }
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [cx, cy] = [sx < 0 ? 0 : 1080, sy < 0 ? 0 : 1920];
    puffs.push([cx + sx * 40, cy + sy * 40, 140, -sx, -sy], [cx - sx * 110, cy + sy * 30, 80, 0, -sy]);
  }
  const [fog, rim, curls]: string[][] = [[], [], []];
  const circle = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  puffs.forEach(([x, y, r0, nx, ny], i) => {
    const r = Math.min(Math.round(r0), Math.floor(Math.min(keepOutDist(x, y), topStatsDist(x, y)) - FOG_RIM));
    if (r < 6) return;
    fog.push(circle(x, y, r));
    rim.push(circle(x, y, r + FOG_RIM));
    if (i % 2) return;
    const [cx, cy] = [Math.round(x + nx * r * 0.45), Math.round(y + ny * r * 0.45)];
    curls.push(`M${cx + 5} ${cy}a5 5 0 1 1 -5 -5a3 3 0 0 1 3 3`);
  });
  return [fog.join(''), rim.join(''), curls.join('')];
}
const [FOG_D, RIM_D, CURLS_D] = fogPaths();

// Tarcza herbowa: czerwone pole, złota krokiew i trzy bezanty (mieści się w COMPASS_BOX).
const SHIELD = 'M-40 -62H40V-14C40 22 18 42 0 54C-18 42 -40 22 -40 -14Z';
function Shield({ at: [cx, cy] }: { at: Pt }) {
  return (
    <g transform={`translate(${cx} ${cy})`} stroke={INK} strokeLinejoin="round">
      <path d={SHIELD} fill={BLAZON} stroke="none" />
      <path d="M-38 -2L0 -36L38 -2V14L0 -20L-38 14Z" fill={GOLD} strokeWidth={1.2} />
      <path d="M-26 -44a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM14 -44a6 6 0 1 0 12 0a6 6 0 1 0 -12 0ZM-7 22a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z" fill={GOLD} strokeWidth={1.2} />
      <path d={SHIELD} fill="none" strokeWidth={3} />
    </g>
  );
}

const STREET_CORRIDOR = 14; // ulica w tej odległości od trasy liczy się jako „po niej”
const STREET_STEP = 4; // próbkowanie odcinków ulic (px)
const MIN_ALONG = 60; // krótszy wspólny odcinek to zwykle tylko przecięcie

// Nazwa ulicy, wzdłuż której trasa biegnie najdłużej (suma długości ulicy w korytarzu trasy); undefined = brak.
export function routeStreet(streets: Street[] | undefined, route: Pt[]): string | undefined {
  if (!streets?.length || route.length < 2) return undefined;
  const near = routeIndex(route, STREET_CORRIDOR);
  const along = new Map<string, number>();
  for (const { name, line } of streets)
    for (let k = 1; k < line.length; k++) {
      const [[ax, ay], [bx, by]] = [line[k - 1], line[k]];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / STREET_STEP));
      const step = Math.hypot(bx - ax, by - ay) / n;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (near(ax + (bx - ax) * t, ay + (by - ay) * t)) along.set(name, (along.get(name) ?? 0) + step);
      }
    }
  let best: string | undefined;
  let max = MIN_ALONG;
  for (const [name, len] of along) if (len > max) [best, max] = [name, len];
  return best;
}

// Napis wzdłuż środkowej krzywej pasa (ok. 129 px); font dziedziczony z pocztówki, więc jest też w eksporcie PNG.
const RIBBON_MID = 'M-76 -2Q-15 -18 52 -2';
const RIBBON_TEXT = 116;
const MAX_NAME = 28;
const CHAR_EM = 0.5; // przybliżona szerokość znaku w em przy FONTS[].scale = 1 (szersze fonty mają mniejszą skalę)
const SAFE = 0.7; // od tej części pasa długość wymuszona textLength, więc błąd oszacowania nie ucina glifów

// Wstęga z nazwą ulicy: wygięty pas i dwa wcięte końce za nim (mieści się w SERPENT_BOX). Długa nazwa: mniejszy
// font (do 10 px), potem ściśnięta do szerokości pasa, powyżej MAX_NAME znaków ucięta wielokropkiem.
function Ribbon({ at: [cx, cy], name, font }: { at: Pt; name: string; font: FontId }) {
  const text = name.length > MAX_NAME ? name.slice(0, MAX_NAME - 1).trimEnd() + '…' : name;
  const em = text.length * (CHAR_EM / FONTS[font].scale);
  const size = Math.max(10, Math.min(16, Math.floor(RIBBON_TEXT / em)));
  const width = Math.round(Math.min(em * size, RIBBON_TEXT));
  const squeeze = em * size > SAFE * RIBBON_TEXT;
  return (
    <g transform={`translate(${cx} ${cy})`} stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
      <path d="M-70 -8L-94 -8L-84 6L-94 20L-70 20ZM46 -8L66 -8L56 6L66 20L46 20Z" fill="#cdbb8e" />
      <path d="M-76 -16Q-15 -32 52 -16V12Q-15 -4 -76 12Z" fill={WALL} />
      <path id="world-medieval-ribbon" d={RIBBON_MID} fill="none" stroke="none" />
      <text fill={INK} stroke="none" fontSize={size} textAnchor="middle" dy="0.35em">
        <textPath
          href="#world-medieval-ribbon"
          startOffset="50%"
          {...(squeeze && { textLength: width, lengthAdjust: 'spacingAndGlyphs' })}
        >
          {text}
        </textPath>
      </text>
    </g>
  );
}

// Zagony: trzy pasy (ochra, zieleń, jasna ochra) z bruzdami, pod skosem.
const FURROWS = Array.from({ length: 15 }, (_, i) => `M${i * 6 + 3} 0V90`).join('');
// Korony drzew wewnątrz kafelka (bez ucinania na szwach).
const CROWNS: [number, number, number][] = [[12, 12, 8], [36, 10, 8], [24, 29, 9], [9, 38, 7], [39, 36, 8]];

export const medieval: MapTheme = {
  label: 'Medieval',
  font: 'pirata',
  style: () => STYLE,
  floor,
  render: (layers, opts) => {
    const route = parseLines(layers.major)[0] ?? [];
    const [shield, ribbon] = corners(route);
    const street = routeStreet(layers.streets, route);
    return {
      scene: (
        <>
          <defs>
            <Hatch id="world-medieval-land" background={LAND} color="#6f7d52" angle={45} gap={10} opacity={0.35} />
            <Hatch id="world-medieval-meadow" background={STYLE.colors.sport} color="#8a8a52" angle={-30} gap={8} opacity={0.45} />
            <pattern id="world-medieval-field" patternUnits="userSpaceOnUse" width={90} height={90} patternTransform="rotate(25)">
              <rect width={30} height={90} fill={STYLE.colors.field} />
              <rect x={30} width={30} height={90} fill="#a7b36e" />
              <rect x={60} width={30} height={90} fill="#c9b56a" />
              <path d={FURROWS} stroke="#7d6a3a" strokeWidth={1} opacity={0.45} />
            </pattern>
            <pattern id="world-medieval-woods" patternUnits="userSpaceOnUse" width={48} height={48}>
              <rect width={48} height={48} fill={STYLE.colors.green} />
              <path
                d={CROWNS.map(([x, y, r]) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`).join('')}
                fill="#4f6136"
                stroke="#2f3a1e"
                strokeWidth={1}
              />
              <path d={CROWNS.map(([x, y]) => `M${x - 5} ${y - 2}a3 3 0 0 1 5 -3`).join('')} fill="none" stroke="#8aa064" strokeWidth={1.4} strokeLinecap="round" />
            </pattern>
            <pattern id="world-medieval-water" patternUnits="userSpaceOnUse" width={40} height={24}>
              <rect width={40} height={24} fill={STYLE.colors.water} />
              <path d="M4 8q4 -3 8 0t8 0M22 19q4 -3 8 0t8 0" fill="none" stroke="#4c6372" strokeWidth={1.2} strokeLinecap="round" />
            </pattern>
            <Outline id="world-medieval-route" color="#f3e6c4" radius={3.5} />
            <Vignette id="world-medieval-vignette" color={INK} opacity={0.35} />
          </defs>
          {floor(layers)}
        </>
      ),
      overlay: (
        <>
          <Overlay fill="url(#world-medieval-vignette)" />
          <path d={RIM_D} fill="#6a6670" />
          <path d={FOG_D} fill={FOG} />
          <path d={CURLS_D} fill="none" stroke="#8a8690" strokeWidth={2} strokeLinecap="round" />
          <Shield at={shield} />
          {street && <Ribbon at={ribbon} name={street} font={opts?.font ?? DEFAULT_FONT} />}
        </>
      ),
      route: { stroke: '#16286e', width: 16, filter: 'url(#world-medieval-route)' },
      text: { color: INK },
      mark: 'black',
    };
  },
};
