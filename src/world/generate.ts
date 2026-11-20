import type { Rect } from '../lib/mapTiles';
import type { Building, MapLayers } from '../lib/vectorMap';
import { GENRES, type GenreId } from './genres';
import { warp, type Pt } from './grid';
import { hashSeed, mulberry32 } from './rng';

// Pojazd w px płótna, kąt w stopniach.
export type Prop = { kind: 'car' | 'ship'; x: number; y: number; angle: number };
export type World = { layers: MapLayers; props: Prop[] };

// warp jest strojony w metrach (fale ~7–8 km); na płótnie zagęszczamy fale 3×, żeby wygięcie było widać w kadrze.
const WARP_SCALE = 3;
const warpPx = ([x, y]: Pt): Pt => {
  const [wx, wy] = warp([x * WARP_SCALE, y * WARP_SCALE]);
  return [wx / WARP_SCALE, wy / WARP_SCALE];
};
const BUCKET = 64;
const NOISE_CELLS = 5; // oczko siatki szumu (woda, parki) w kwartałach
const SHIP_CELLS = 6; // jeden kandydat na statek na tyle × tyle kwartałów
// Szanse na komórkę (auto) i super-komórkę (statek), razem z gęstością: w pocztówce (także 3D) poniżej limitów gatunku,
// więc limit zwykle nie działa i część wspólna dwóch prostokątów zostaje ta sama.
const CAR_P = 0.035;
const SHIP_P = 0.15;
// Gęstość brył i pojazdów: pełna do FULL_PX od prostokąta trasy, potem maleje do zera na FADE_PX dalej. Zależy tylko od trasy,
// nie od rect, a ogranicza liczbę brył w dużym prostokącie podłogi 3D (zamiast limitu, który dawał szew przy tle ekranu).
const FULL_PX = 450;
const FADE_PX = 700;

const round = (p: Pt): Pt => [Math.round(p[0]), Math.round(p[1])];
const fmt = (p: Pt) => `${Math.round(p[0])} ${Math.round(p[1])}`;
const ringD = (ring: Pt[]) => `M${ring.map(fmt).join('L')}Z`;

function segDist(px: number, py: number, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Indeks kubełkowy odcinków trasy poszerzonych o korytarz: nearRoute sprawdza tylko odcinki z kubełka punktu.
function routeIndex(points: Pt[], corridor: number): (x: number, y: number) => boolean {
  const buckets = new Map<string, number[]>();
  for (let s = 1; s < points.length; s++) {
    const [a, b] = [points[s - 1], points[s]];
    const bx0 = Math.floor((Math.min(a[0], b[0]) - corridor) / BUCKET);
    const bx1 = Math.floor((Math.max(a[0], b[0]) + corridor) / BUCKET);
    const by0 = Math.floor((Math.min(a[1], b[1]) - corridor) / BUCKET);
    const by1 = Math.floor((Math.max(a[1], b[1]) + corridor) / BUCKET);
    for (let bx = bx0; bx <= bx1; bx++)
      for (let by = by0; by <= by1; by++) {
        const key = `${bx}:${by}`;
        const list = buckets.get(key);
        if (list) list.push(s);
        else buckets.set(key, [s]);
      }
  }
  return (x, y) => {
    const list = buckets.get(`${Math.floor(x / BUCKET)}:${Math.floor(y / BUCKET)}`);
    return !!list?.some((s) => segDist(x, y, points[s - 1], points[s]) < corridor);
  };
}

// Miasto pod trasą (ADR 0012): globalna siatka kwartałów, każda komórka z własnym strumieniem losowości,
// więc dwa wywołania z różnymi rect dają to samo miasto w części wspólnej. Czysta funkcja: bez Math.random i czasu.
export function generateWorld(
  points: [number, number][],
  rect: Rect,
  seed: number,
  genre: GenreId,
): World {
  const { block: B, heights, props: limits, accents } = GENRES[genre];
  const corridor = 0.45 * B;
  const rc = (i: number, j: number, kind: string) => mulberry32(hashSeed(seed, genre, i, j, kind));
  const nearRoute = routeIndex(points, corridor);
  const [bx0, by0, bx1, by1] = points.reduce(
    ([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const density = ([x, y]: Pt) => {
    const d = Math.hypot(Math.max(bx0 - x, 0, x - bx1), Math.max(by0 - y, 0, y - by1));
    return Math.max(0, Math.min(1, 1 - (d - FULL_PX) / FADE_PX));
  };

  const corners = new Map<string, Pt>();
  // Róg przed wygięciem (z drganiem) i po nim.
  const raw = (i: number, j: number): Pt => {
    const r = rc(i, j, 'c');
    return [(i + (r() - 0.5) * 0.16) * B, (j + (r() - 0.5) * 0.16) * B];
  };
  const corner = (i: number, j: number): Pt => {
    const key = `${i}:${j}`;
    let p = corners.get(key);
    if (!p) corners.set(key, (p = warpPx(raw(i, j))));
    return p;
  };
  // Punkt w komórce (u, v w [0, 1]) z interpolacji czterech wygiętych rogów, jak inCell w demoMap.ts.
  const inCell = (i: number, j: number, u: number, v: number): Pt => {
    const [a, b, c, d] = [corner(i, j), corner(i + 1, j), corner(i + 1, j + 1), corner(i, j + 1)];
    return [
      (1 - v) * ((1 - u) * a[0] + u * b[0]) + v * ((1 - u) * d[0] + u * c[0]),
      (1 - v) * ((1 - u) * a[1] + u * b[1]) + v * ((1 - u) * d[1] + u * c[1]),
    ];
  };
  const quad = (i: number, j: number, u0: number, v0: number, u1: number, v1: number): Pt[] =>
    [inCell(i, j, u0, v0), inCell(i, j, u1, v0), inCell(i, j, u1, v1), inCell(i, j, u0, v1)].map(round);
  // Gładki szum wartości w [0, 1): losowe wartości co NOISE_CELLS komórek, interpolacja z wygładzeniem.
  const lattice = (I: number, J: number) => rc(I, J, 'n')();
  const noise = (i: number, j: number) => {
    const fx = i / NOISE_CELLS;
    const fy = j / NOISE_CELLS;
    const I = Math.floor(fx);
    const J = Math.floor(fy);
    const s = (t: number) => t * t * (3 - 2 * t);
    const u = s(fx - I);
    const v = s(fy - J);
    const top = lattice(I, J) * (1 - u) + lattice(I + 1, J) * u;
    const bottom = lattice(I, J + 1) * (1 - u) + lattice(I + 1, J + 1) * u;
    return top * (1 - v) + bottom * v;
  };
  const blocked = (ring: Pt[]) => ring.some(([x, y]) => nearRoute(x, y));
  // Bryła: wierzchołki i punkty na 1/4, 1/2, 3/4 każdej krawędzi poza korytarzem, więc nic nie wchodzi na ulicę trasy (34 px).
  const edgeBlocked = (ring: Pt[]) =>
    blocked(
      ring.flatMap(([ax, ay], k) => {
        const [bx, by] = ring[(k + 1) % ring.length];
        return [0, 0.25, 0.5, 0.75].map((t): Pt => [ax + (bx - ax) * t, ay + (by - ay) * t]);
      }),
    );
  // Woda nigdy pod trasą: ani środek, ani rogi komórki w korytarzu.
  const isWater = (i: number, j: number) => noise(i, j) < 0.1 && !blocked([inCell(i, j, 0.5, 0.5), ...quad(i, j, 0, 0, 1, 1)]);
  // Ulica prosto między wygiętymi rogami: fala wygięcia (~2 km płótna) jest o wiele dłuższa niż kwartał, a dwa punkty
  // zamiast czterech mieszczą SVG podłogi 3D w budżecie 300 KB.
  const street = (a: [number, number], b: [number, number]) => `M${fmt(corner(...a))}L${fmt(corner(...b))}`;

  const [x0, y0, x1, y1] = rect;
  const i0 = Math.floor(x0 / B) - 1;
  const i1 = Math.ceil(x1 / B) + 1;
  const j0 = Math.floor(y0 / B) - 1;
  const j1 = Math.ceil(y1 / B) + 1;
  const minor: string[] = [];
  const mid: string[] = [];
  const water: string[] = [];
  const green: string[] = [];
  const runway: string[] = [];
  const buildings: Building[] = [];
  const cars: Prop[] = [];

  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++) {
      if (isWater(i, j)) {
        water.push(ringD(quad(i, j, 0, 0, 1, 1)));
        continue;
      }
      (j % 4 === 0 ? mid : minor).push(street([i, j], [i + 1, j]));
      (i % 4 === 0 ? mid : minor).push(street([i, j], [i, j + 1]));

      const car = rc(i, j, 'car');
      if (car() < CAR_P * density(inCell(i, j, 0.5, 0.5))) {
        const t = car();
        const [a, b] = car() < 0.5 ? [corner(i, j), corner(i + 1, j)] : [corner(i, j), corner(i, j + 1)];
        const p: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (!nearRoute(p[0], p[1]))
          cars.push({ kind: 'car', x: Math.round(p[0]), y: Math.round(p[1]), angle: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI) });
      }

      const n = noise(i, j);
      if (n < 0.2) {
        green.push(ringD(quad(i, j, 0.08, 0.08, 0.92, 0.92)));
        continue;
      }
      if (rc(i, j, 'pad')() < 0.015) {
        // Lądowisko: pas wzdłuż dłuższej osi komórki i krąg; bez budynków. Przy trasie zwykły kwartał.
        const along = Math.hypot(...sub(corner(i + 1, j), corner(i, j))) >= Math.hypot(...sub(corner(i, j + 1), corner(i, j)));
        const [a, b] = along ? [inCell(i, j, 0.15, 0.5), inCell(i, j, 0.85, 0.5)] : [inCell(i, j, 0.5, 0.15), inCell(i, j, 0.5, 0.85)];
        const ring = Array.from({ length: 12 }, (_, k) => {
          const ang = (k / 12) * 2 * Math.PI;
          return inCell(i, j, 0.5 + 0.18 * Math.cos(ang), 0.5 + 0.18 * Math.sin(ang));
        });
        if (!blocked([a, b, ...ring])) {
          runway.push(`M${fmt(a)}L${fmt(b)}`, ringD(ring));
          continue;
        }
      }
      if (rc(i, j, 'keep')() >= density(inCell(i, j, 0.5, 0.5))) continue;
      const r = rc(i, j, 'b');
      // Neon i szyld z osobnego strumienia, więc układ miasta zostaje ten sam; losowane dla każdej kandydatki, nie tylko dodanej.
      const ar = rc(i, j, 'a');
      const accent = () => accents[Math.floor(ar() * accents.length)];
      const height = (k = r()) => Math.max(0, Math.round(heights[0] + (heights[1] - heights[0]) * k * k));
      if (r() < 0.1) {
        // Niska kopuła: ośmiokąt w środku kwartału.
        const ring = Array.from({ length: 8 }, (_, k) => {
          const ang = (k / 8) * 2 * Math.PI;
          return round(inCell(i, j, 0.5 + 0.3 * Math.cos(ang), 0.5 + 0.3 * Math.sin(ang)));
        });
        const [cx, cy] = inCell(i, j, 0.5, 0.5);
        if (!nearRoute(cx, cy) && !edgeBlocked(ring)) buildings.push({ ring, h: Math.round(heights[0] * 0.6), min: 0, accent: accent() });
        continue;
      }
      const count = 1 + Math.floor(r() * 3);
      const span = (0.88 - 0.12 - 0.06 * (count - 1)) / count;
      for (let k = 0; k < count; k++) {
        const u0 = 0.12 + k * (span + 0.06);
        const v0 = 0.12 + r() * 0.2;
        const v1 = 0.88 - r() * 0.2;
        const ring = quad(i, j, u0, v0, u0 + span, v1);
        const [tint, sign] = [accent(), ar() < 0.3];
        const cx = ring.reduce((s, p) => s + p[0], 0) / 4;
        const cy = ring.reduce((s, p) => s + p[1], 0) / 4;
        if (!nearRoute(cx, cy) && !edgeBlocked(ring)) {
          const h = height();
          buildings.push({ ring, h, min: 0, accent: tint, sign: sign && h >= 80 });
        }
      }
    }

  // Statki: jeden kandydat na super-komórkę, tylko w prostokącie.
  const ships: Prop[] = [];
  const S = SHIP_CELLS * B;
  for (let sj = Math.floor(y0 / S); sj <= Math.floor(y1 / S); sj++)
    for (let si = Math.floor(x0 / S); si <= Math.floor(x1 / S); si++) {
      const r = rc(si, sj, 'ship');
      const p = r();
      const [x, y] = warpPx([(si + r()) * S, (sj + r()) * S]);
      if (p >= SHIP_P * density([x, y])) continue;
      const angle = Math.round(r() * 360);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) ships.push({ kind: 'ship', x: Math.round(x), y: Math.round(y), angle });
    }

  // Bez limitu liczby brył: o liczbie decyduje gęstość (zależna od trasy), więc wynik w części wspólnej nie zależy od rect.
  // Limit pojazdów tylko jako zabezpieczenie, w stałej kolejności skrótu pozycji (nie rzędów), więc bez przewagi górnych rzędów.
  const capped = (list: Prop[], max: number) =>
    list.length <= max ? list : [...list].sort((a, b) => hashSeed(seed, a.x, a.y) - hashSeed(seed, b.x, b.y)).slice(0, max);
  const major = points.length > 1 ? [`M${points.map(fmt).join('L')}`] : [];
  const join = (a: string[]) => (a.length ? a.join('') : undefined);
  return {
    layers: {
      water: join(water),
      green: join(green),
      building: join(buildings.map((b) => ringD(b.ring))),
      runway: join(runway),
      minor: join(minor),
      mid: join(mid),
      major: join(major),
      buildings,
    },
    props: [...capped(cars, limits.cars), ...capped(ships, limits.ships)],
  };
}

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
