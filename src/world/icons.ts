import type { Building } from '../lib/vectorMap';
import { parseLines, routeIndex } from './geom';
import type { Pt } from './grid';
import { hashSeed } from './rng';

// Rozmieszczenie ikon ilustrowanych map Fantasy i Post-apo (px płótna). Czyste funkcje: ten sam wynik w bazie i refined.
export type House = { x: number; y: number; roof: string };
export type Ship = { x: number; y: number; angle: number };

// Wybór niezależny od zestawu brył (baza, refined po zoomie, tło): komórka siatki dostaje ikonę, gdy jej skrót
// przechodzi próg; w komórce wygrywa bryła ze skrótem z grubej siatki 16 px (wierzchołki z różnych kafelków różnią się).
const CELL = 40;
const HOUSE_P = 0.18; // ok. 230 domków na płótnie w gęstym mieście (strojone na oko)
const MAX_HOUSES = 400; // tylko bezpiecznik
const LANDMARK_CELL = 400;
const LANDMARK_P = 0.25; // ok. 3 na płótno: więcej psuło klimat wioski
const LANDMARK_AREA = 1000; // px² prostokąta otaczającego
const BIG_WATER = 25000; // px²
const SHIP_GRID = 40;
const SHIP_MARGIN = 90;
const SHIP_PROBE = 45; // statek tylko na otwartej wodzie: 4 punkty dookoła też w wodzie
const SHIP_ROUTE = 60;
const SHIP_GAP = 250;
const MAX_SHIPS = 3;
const U32 = 2 ** 32;

export const center = ({ ring }: Building): Pt => [
  ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ring.reduce((s, p) => s + p[1], 0) / ring.length,
];
const bboxArea = ({ ring }: Building) => {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

// Punkty orientacyjne (zamek w Fantasy, grzyb atomowy w Post-apo): największa bryła (od 1000 px²) w komórce 400 px,
// której skrót przechodzi próg; najwyżej jeden na komórkę.
export function landmarks(buildings: Building[] = []): Building[] {
  const cells = new Map<string, { area: number; b: Building }>();
  for (const b of buildings) {
    const area = bboxArea(b);
    if (area < LANDMARK_AREA) continue;
    const [cx, cy] = center(b);
    const [i, j] = [Math.floor(cx / LANDMARK_CELL), Math.floor(cy / LANDMARK_CELL)];
    if (hashSeed('fc', i, j) / U32 >= LANDMARK_P) continue;
    const old = cells.get(`${i}:${j}`);
    if (!old || area > old.area) cells.set(`${i}:${j}`, { area, b });
  }
  return [...cells.values()].map((c) => c.b);
}

// Domki (albo ruiny): komórka 40 px przechodząca próg, w niej bryła z najmniejszym skrótem grubej siatki; bez punktów
// orientacyjnych (skip).
export function houseIcons(buildings: Building[] = [], skip: Building[] = [], roof = '#b5442f'): House[] {
  const skipSet = new Set(skip);
  const cells = new Map<string, { key: number; cell: number; house: House }>();
  for (const b of buildings) {
    if (skipSet.has(b)) continue;
    const [cx, cy] = center(b);
    const [i, j] = [Math.floor(cx / CELL), Math.floor(cy / CELL)];
    const cell = hashSeed('fh', i, j);
    if (cell / U32 >= HOUSE_P) continue;
    const key = hashSeed('fhb', Math.round(cx / 16), Math.round(cy / 16));
    const old = cells.get(`${i}:${j}`);
    if (!old || key < old.key) cells.set(`${i}:${j}`, { key, cell, house: { x: Math.round(cx), y: Math.round(cy), roof: b.accent ?? roof } });
  }
  return [...cells.values()]
    .sort((a, b) => a.cell - b.cell)
    .slice(0, MAX_HOUSES)
    .map((c) => c.house);
}

const ringArea = (r: Pt[]) => Math.abs(r.reduce((s, [x, y], i) => s + x * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * y, 0)) / 2;

// Parzysto-nieparzyście po wszystkich pierścieniach (dziury jezior wychodzą same).
function inside(rings: { r: Pt[]; box: number[] }[], x: number, y: number): boolean {
  let odd = false;
  for (const { r, box } of rings) {
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) odd = !odd;
  }
  return odd;
}

// Do 3 statków na dużej wodzie (od 25 000 px²), z dala od brzegu i trasy, co najmniej 250 px od siebie.
export function shipIcons(water: string | undefined, route: Pt[]): Ship[] {
  const all = parseLines(water).filter((r) => r.length > 2);
  if (!all.some((r) => ringArea(r) >= BIG_WATER)) return [];
  const rings = all.map((r) => {
    const xs = r.map((p) => p[0]);
    const ys = r.map((p) => p[1]);
    return { r, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
  const nearRoute = routeIndex(route, SHIP_ROUTE);
  const found: { key: number; ship: Ship }[] = [];
  for (let x = SHIP_MARGIN; x <= 1080 - SHIP_MARGIN; x += SHIP_GRID)
    for (let y = SHIP_MARGIN; y <= 1920 - SHIP_MARGIN; y += SHIP_GRID) {
      if (nearRoute(x, y) || !inside(rings, x, y)) continue;
      const probes: Pt[] = [[x - SHIP_PROBE, y], [x + SHIP_PROBE, y], [x, y - SHIP_PROBE], [x, y + SHIP_PROBE]];
      if (!probes.every(([px, py]) => inside(rings, px, py))) continue;
      const key = hashSeed('fs', x, y);
      found.push({ key, ship: { x, y, angle: (key % 21) - 10 } });
    }
  const ships: Ship[] = [];
  for (const { ship } of found.sort((a, b) => a.key - b.key)) {
    if (ships.length >= MAX_SHIPS) break;
    if (ships.every((s) => Math.hypot(s.x - ship.x, s.y - ship.y) >= SHIP_GAP)) ships.push(ship);
  }
  return ships;
}

// Górne rogi na dwa rysunki (Fantasy: róża wiatrów i wąż; Post-apo: znak promieniowania i tablica z czaszką): pod statystykami z górnych układów (kończą się ok. y 235), w polu trasy.
// Pierwszy (róża, znak) ten z mniejszą liczbą punktów trasy (remis: lewy).
export const CORNERS: [Pt, Pt] = [[160, 350], [920, 350]];
// Zasięg rysunków względem środka rogu (x0, y0, x1, y1) dla testu kolizji ze statystykami; Post-apo mieści się w nich.
export const COMPASS_BOX = [-58, -76, 58, 58];
export const SERPENT_BOX = [-96, -36, 66, 38];

// Pola bez ozdób: znak Stravy (lewy dół) i pionowy podpis OSM przy prawej krawędzi (x0, y0, x1, y1).
export const KEEP_OUT = [[40, 1790, 460, 1866], [1038, 1380, 1058, 1892]];
// Odległość punktu od najbliższego pola KEEP_OUT (0 wewnątrz).
export const keepOutDist = (x: number, y: number) =>
  Math.min(...KEEP_OUT.map(([x0, y0, x1, y1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))));

export function corners(route: Pt[]): [Pt, Pt] {
  const [tl, tr] = CORNERS;
  const count = ([cx, cy]: Pt) => route.filter(([x, y]) => Math.abs(x - cx) <= 120 && Math.abs(y - cy) <= 120).length;
  return count(tr) < count(tl) ? [tr, tl] : [tl, tr];
}
