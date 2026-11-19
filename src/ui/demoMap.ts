import type { MapLayers } from '../lib/vectorMap';

// Wymyślone miasto dla kolażu na ekranie logowania (bez sieci). Jednostka „świata” = 1 m, y rośnie na południe.
// Ulice to graf (skrzyżowania i odcinki), po którym chodzą trasy z demoRuns.ts; mapę rysujemy z tego samego grafu,
// więc trasa po rzutowaniu leży na narysowanych ulicach.
export type Pt = [number, number];

const BLOCK_X = 130;
const BLOCK_Y = 150;
export const NORTH_ROW = 4; // ostatni rząd ulic nad rzeką
export const SOUTH_ROW = 9; // pierwszy rząd ulic pod rzeką
export const FOREST_X = -1300; // na zachód las ze ścieżkami, bez ulic
export const K_MIN = Math.ceil(FOREST_X / BLOCK_X); // najbardziej zachodnia ulica
const RIVER_W = 150;
const BANK = 40; // bulwar wzdłuż rzeki

// Deterministyczny „szum” w (-1, 1).
const hash = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
// Meandry z dwóch fal o niewspółmiernych okresach, żeby nie powtarzały się co kilometr; pas 760–1040.
const riverY = (x: number) => 900 + 80 * Math.sin(x / 260) + 60 * Math.sin(x / 730 + 1);
const validRow = (j: number) => j <= NORTH_ROW || j >= SOUTH_ROW;

// Graf jest kratką, a miasto nie: gładkie wygięcie płaszczyzny (do ~240 m, nachylenie < 0,3, więc bez zawinięć).
// Długie fale obracają dzielnice o różne kąty (ulice prawie proste), krótka dodaje lekki łuk.
// Mapa i trasy przechodzą przez nie przy wyjściu.
export const warp = ([x, y]: Pt): Pt => [
  x + 180 * Math.sin(y / 1300 + 0.4) + 30 * Math.sin((x - y) / 480),
  y + 180 * Math.sin(x / 1100 + 1.3) + 30 * Math.sin((x + y) / 520),
];

// Odcinki dłuższe niż 40 m dzielimy, żeby po wygięciu były łukiem, a nie cięciwą.
export function densify(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40);
    for (let s = 1; s <= n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]);
  }
  return out;
}

export const gridAt = (k: number, j: number): Pt => [
  k * BLOCK_X + 10 * hash(k * 31 + j * 7),
  j * BLOCK_Y + 10 * hash(j * 17 - k * 3 + 100),
];

// Węzły: "g:k:j" skrzyżowanie, "n:k" / "s:k" koniec ulicy k na bulwarze nad / pod rzeką.
export function nodePos(id: string): Pt {
  const [t, k, j] = id.split(':');
  if (t === 'g') return gridAt(+k, +j);
  const x = gridAt(+k, t === 'n' ? NORTH_ROW : SOUTH_ROW)[0];
  return [x, t === 'n' ? riverY(x) - BANK : riverY(x) + RIVER_W + BANK];
}

type Kind = 'minor' | 'mid' | 'major';
export type Edge = { to: string; pts: Pt[]; kind: Kind };

const vKind = (k: number): Kind => (k % 6 === 0 ? 'major' : k % 3 === 0 ? 'mid' : 'minor');
const hKind = (j: number): Kind => (j % 4 === 0 ? 'mid' : 'minor');

// Bulwar między ulicami k i k+1 (lub k-1) idzie wzdłuż brzegu, nie na skróty.
function bank(side: 'n' | 's', from: number, to: number): Pt[] {
  const [x0] = nodePos(`${side}:${from}`);
  const [x1] = nodePos(`${side}:${to}`);
  return Array.from({ length: 7 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / 6;
    return [x, side === 'n' ? riverY(x) - BANK : riverY(x) + RIVER_W + BANK] as Pt;
  });
}

// Krawędzie z węzła; pts od węzła do sąsiada (oba końce włącznie).
export function edges(id: string): Edge[] {
  const [t, ks, js] = id.split(':');
  const k = +ks;
  const out: Edge[] = [];
  const line = (to: string, kind: Kind) => out.push({ to, pts: [nodePos(id), nodePos(to)], kind });
  if (t === 'g') {
    const j = +js;
    if (k > K_MIN) line(`g:${k - 1}:${j}`, hKind(j));
    line(`g:${k + 1}:${j}`, hKind(j));
    if (validRow(j - 1)) line(`g:${k}:${j - 1}`, vKind(k));
    if (validRow(j + 1)) line(`g:${k}:${j + 1}`, vKind(k));
    if (j === NORTH_ROW) line(`n:${k}`, vKind(k));
    if (j === SOUTH_ROW) line(`s:${k}`, vKind(k));
  } else {
    const side = t as 'n' | 's';
    const other = side === 'n' ? 's' : 'n';
    line(`g:${k}:${side === 'n' ? NORTH_ROW : SOUTH_ROW}`, vKind(k));
    for (const nk of [k - 1, k + 1]) {
      if (nk >= K_MIN) out.push({ to: `${side}:${nk}`, pts: bank(side, k, nk), kind: 'mid' });
    }
    if (k % 3 === 0) line(`${other}:${k}`, vKind(k)); // most
  }
  return out;
}

export const isPark = (k: number, j: number) =>
  k >= K_MIN && validRow(j) && validRow(j + 1) && hash(k * 53 + j * 97 + 7) > 0.75;

// Punkt w kwadracie komórki (u, v w [0, 1]) z interpolacji jej rogów: bloki idą za lekko krzywymi ulicami.
function inCell(k: number, j: number, u: number, v: number): Pt {
  const [a, b, c, d] = [gridAt(k, j), gridAt(k + 1, j), gridAt(k + 1, j + 1), gridAt(k, j + 1)];
  return [
    (1 - v) * ((1 - u) * a[0] + u * b[0]) + v * ((1 - u) * d[0] + u * c[0]),
    (1 - v) * ((1 - u) * a[1] + u * b[1]) + v * ((1 - u) * d[1] + u * c[1]),
  ];
}

// Mapa okna świata [x0, y0, x1, y1] w układzie płótna (toCanvas: świat -> px pocztówki).
// trails: ścieżki leśne (świat); pxPerM: skala, przy małej szczegóły znikają jak na prawdziwej mapie (i SVG jest lżejszy).
// ran: klucze krawędzi przebiegniętych przez trasę; małe uliczki z trasy rysujemy też przy małej skali.
export function demoMap(
  toCanvas: (p: Pt) => Pt,
  [x0, y0, x1, y1]: number[],
  trails: Pt[][],
  pxPerM: number,
  ran: Set<string> = new Set(),
): MapLayers {
  const buildings = pxPerM > 0.3;
  const fmt = (p: Pt) => toCanvas(warp(p)).map(Math.round).join(' ');
  const poly = (pts: Pt[]) => `M${densify(pts).map(fmt).join('L')}`;
  // Okno jest w świecie po wygięciu; zapas na przesunięcie (max ~210 m).
  [x0, y0, x1, y1] = [x0 - 250, y0 - 250, x1 + 250, y1 + 250];
  const quad = (k: number, j: number, u0: number, v0: number, u1: number, v1: number) =>
    poly([inCell(k, j, u0, v0), inCell(k, j, u1, v0), inCell(k, j, u1, v1), inCell(k, j, u0, v1)]) + 'Z';
  const roads: Record<Kind, string[]> = { minor: [], mid: [], major: [] };
  const water: string[] = [];
  const green: string[] = [];
  const building: string[] = [];
  // Szlaki są już gęste i wygięte (demoRuns), więc bez warp/densify.
  const path = trails.map((t) => `M${t.map((p) => toCanvas(p).map(Math.round).join(' ')).join('L')}`);
  const seen = new Set<string>();
  const k0 = Math.max(K_MIN, Math.floor(x0 / BLOCK_X) - 1);
  const k1 = Math.ceil(x1 / BLOCK_X) + 1;
  const j0 = Math.floor(y0 / BLOCK_Y) - 1;
  const j1 = Math.ceil(y1 / BLOCK_Y) + 1;
  for (let k = k0; k <= k1; k++) {
    for (let j = j0; j <= j1; j++) {
      const ids = validRow(j) ? [`g:${k}:${j}`] : [];
      if (j === NORTH_ROW + 1) ids.push(`n:${k}`, `s:${k}`);
      for (const id of ids) {
        for (const e of edges(id)) {
          const key = [id, e.to].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          if (e.kind !== 'minor' || pxPerM > 0.12 || ran.has(key)) roads[e.kind].push(poly(e.pts));
        }
      }
      if (!validRow(j) || !validRow(j + 1)) continue;
      if (isPark(k, j)) {
        green.push(quad(k, j, 0.08, 0.08, 0.92, 0.92));
        const loop = Array.from({ length: 13 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI;
          return inCell(k, j, 0.5 + 0.32 * Math.cos(a), 0.5 + 0.3 * Math.sin(a));
        });
        if (buildings) path.push(poly(loop));
      } else if (buildings) {
        const h = 0.4 + 0.15 * hash(k * 13 + j);
        building.push(quad(k, j, 0.12, 0.12, 0.47, h), quad(k, j, 0.56, 0.12, 0.88, 0.7));
        if (hash(k + j * 29) > -0.3) building.push(quad(k, j, 0.12, h + 0.1, 0.47, 0.88));
      }
    }
  }
  const xs = Array.from({ length: 60 }, (_, i) => x0 + ((x1 - x0) * i) / 59);
  water.push(poly([...xs.map((x): Pt => [x, riverY(x)]), ...xs.reverse().map((x): Pt => [x, riverY(x) + RIVER_W])]) + 'Z');
  if (x0 < FOREST_X) green.push(poly([[x0, y0], [FOREST_X - 40, y0], [FOREST_X - 40, y1], [x0, y1]]) + 'Z');
  const join = (a: string[]) => (a.length ? a.join('') : undefined);
  return {
    water: join(water),
    green: join(green),
    building: join(building),
    path: join(path),
    minor: join(roads.minor),
    mid: join(roads.mid),
    major: join(roads.major),
  };
}
