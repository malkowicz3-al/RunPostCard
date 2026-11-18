import { hashSeed, mulberry32 } from '../../lib/random';
import type { Area, MapData, Rect, Ring } from '../../lib/vectorMap';
import type { LayoutItem } from '../slots';

// Czyste funkcje rozmieszczania ikon, wspólne dla motywów (ADR 0005).

export const snap = (v: number, g: number) => Math.round(v / g) * g;

// Promień, parzysto-nieparzyście po wszystkich pierścieniach, więc otwory działają same.
export function pointInPolygon([x, y]: [number, number], rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

const inAny = (areas: Area[], x: number, y: number) =>
  areas.some(({ box, rings }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && pointInPolygon([x, y], rings));

// Siatka zajętości płótna; prostokąt zajmuje każdą komórkę, którą przecina.
export class OccupancyGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cells: Uint8Array;

  constructor(
    readonly size: [number, number],
    readonly cell = 12,
  ) {
    this.cols = Math.ceil(size[0] / cell);
    this.rows = Math.ceil(size[1] / cell);
    this.cells = new Uint8Array(this.cols * this.rows);
  }

  private range([x0, y0, x1, y1]: Rect): Rect {
    const c = this.cell;
    return [
      Math.max(0, Math.floor(x0 / c)),
      Math.max(0, Math.floor(y0 / c)),
      Math.min(this.cols, Math.ceil(x1 / c)),
      Math.min(this.rows, Math.ceil(y1 / c)),
    ];
  }

  markRect(rect: Rect) {
    const [c0, r0, c1, r1] = this.range(rect);
    for (let r = r0; r < r1; r++) this.cells.fill(1, r * this.cols + c0, r * this.cols + c1);
  }

  // Poza płótnem nigdy nie jest wolno.
  isFree(rect: Rect): boolean {
    if (rect[0] < 0 || rect[1] < 0 || rect[2] > this.size[0] || rect[3] > this.size[1]) return false;
    const [c0, r0, c1, r1] = this.range(rect);
    for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) if (this.cells[r * this.cols + c]) return false;
    return true;
  }

  // Odcinki próbkowane co pół komórki; kwadrat o promieniu radius wokół każdej próbki.
  markRoute(points: [number, number][], radius: number) {
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[i + 1] ?? points[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (this.cell / 2)));
      for (let s = 0; s <= n; s++) {
        const x = ax + ((bx - ax) * s) / n;
        const y = ay + ((by - ay) * s) / n;
        this.markRect([x - radius, y - radius, x + radius, y + radius]);
      }
    }
  }
}

// Pełne pasy szerokości płótna pod slotami (odporne na długość wartości) + pas znaku Stravy i podpisu.
export function slotZones(layout: LayoutItem[]): Rect[] {
  return [...layout.map(({ y, size }): Rect => [0, y - 0.8 * size - 20, 1080, y + 80]), [0, 1800, 1080, 1920]];
}

// (x, y) = lewy górny róg kwadratu ikony.
export type Icon = { x: number; y: number; size: number; flip: boolean };
export type Placement = { dragon?: Icon; castles: Icon[]; houses: Icon[]; trees: Omit<Icon, 'flip'>[] };
type BuildingOpts = { count: number; spacing: number; k: number; min: number; max: number };
export type PlaceOpts = {
  routeWidth: number;
  grid?: number;
  dragon: { min: number; max: number; minWater: number };
  castles: BuildingOpts;
  houses: BuildingOpts;
  trees: { spacing: number; size: number; max: number };
};
export type PlaceInput = {
  map: MapData;
  size: [number, number];
  route: [number, number][];
  seed: number;
  exclude: Rect[];
};

const iconRect = ({ x, y, size }: { x: number; y: number; size: number }): Rect => [x, y, x + size, y + size];

// Największy kwadrat wolnych komórek spełniających ok (DP, O(komórek)).
function largestSquare(occ: OccupancyGrid, ok: (x: number, y: number) => boolean) {
  const { cols, rows, cell, cells } = occ;
  const dp = new Uint16Array(cols * rows);
  let best = 0;
  let at = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (cells[i] || !ok((c + 0.5) * cell, (r + 0.5) * cell)) continue;
      dp[i] = r && c ? 1 + Math.min(dp[i - cols], dp[i - 1], dp[i - cols - 1]) : 1;
      if (dp[i] > best) [best, at] = [dp[i], i];
    }
  const c = at % cols;
  const r = Math.floor(at / cols);
  return { x: (c - best + 1) * cell, y: (r - best + 1) * cell, side: best * cell };
}

// Kolejność: smok, zamki, domy, drzewa; każda postawiona ikona zajmuje swój kwadrat.
export function placeIcons({ map, size, route, seed, exclude }: PlaceInput, opts: PlaceOpts): Placement {
  const { grid } = opts;
  const g = (v: number) => (grid ? snap(v, grid) : v);
  const floorG = (v: number) => (grid ? Math.floor(v / grid) * grid : v);
  const { buildings, green, water } = map.objects;
  const occ = new OccupancyGrid(size);
  for (const rect of exclude) occ.markRect(rect);
  occ.markRoute(route, opts.routeWidth / 2 + 12);

  let dragon: Icon | undefined;
  const bigWater = water.filter((w) => w.area >= opts.dragon.minWater);
  let sq = largestSquare(occ, (x, y) => inAny(bigWater, x, y));
  if (sq.side < opts.dragon.min) sq = largestSquare(occ, () => true);
  if (sq.side >= opts.dragon.min) {
    const s = floorG(Math.min(sq.side, opts.dragon.max));
    const off = floorG((sq.side - s) / 2);
    dragon = { x: sq.x + off, y: sq.y + off, size: s, flip: mulberry32(hashSeed(seed, 'dragon'))() < 0.5 };
    occ.markRect(iconRect(dragon));
  }

  const sorted = [...buildings].sort((a, b) => b.area - a.area);
  const placeBuildings = (o: BuildingOpts, stream: string): Icon[] => {
    const rand = mulberry32(hashSeed(seed, stream));
    const out: Icon[] = [];
    for (const b of sorted) {
      if (out.length >= o.count) break;
      const s = g(Math.min(o.max, Math.max(o.min, Math.sqrt(b.area) * o.k)));
      const jitter = s / 8;
      const icon = {
        x: g(b.x - s / 2 + (rand() * 2 - 1) * jitter),
        y: g(b.y - s / 2 + (rand() * 2 - 1) * jitter),
        size: s,
        flip: rand() < 0.5,
      };
      if (!occ.isFree(iconRect(icon)) || out.some((p) => Math.hypot(p.x - icon.x, p.y - icon.y) < o.spacing)) continue;
      out.push(icon);
      occ.markRect(iconRect(icon));
    }
    return out;
  };
  const castles = placeBuildings(opts.castles, 'castles');
  const houses = placeBuildings(opts.houses, 'houses');

  // Globalna siatka z drganiem: nakładające się park i las nie dublują drzew.
  const trees: Placement['trees'] = [];
  const rand = mulberry32(hashSeed(seed, 'trees'));
  const { spacing: sp, max } = opts.trees;
  const s = g(opts.trees.size);
  for (let cy = sp / 2; cy < size[1] && trees.length < max; cy += sp)
    for (let cx = sp / 2; cx < size[0] && trees.length < max; cx += sp) {
      const x = g(cx + ((rand() * 2 - 1) * sp) / 3 - s / 2);
      const y = g(cy + ((rand() * 2 - 1) * sp) / 3 - s / 2);
      const tree = { x, y, size: s };
      if (!occ.isFree(iconRect(tree)) || !inAny(green, x + s / 2, y + s / 2)) continue;
      trees.push(tree);
      occ.markRect(iconRect(tree));
    }

  return { dragon, castles, houses, trees };
}

// Trasa schodkowa: tylko odcinki H/V po siatce g, kroki w proporcji dx:dy (odchylenie ≤ 1 komórka).
export function staircase(points: [number, number][], g: number): string {
  const pts = points.map(([x, y]) => [Math.round(x / g), Math.round(y / g)]);
  if (!pts.length) return '';
  let [cx, cy] = pts[0];
  let d = `M${cx * g} ${cy * g}`;
  let dir = '';
  const flush = () => {
    if (dir) d += dir[0] === 'H' ? `H${cx * g}` : `V${cy * g}`;
  };
  for (const [x, y] of pts.slice(1)) {
    const a = Math.abs(x - cx);
    const b = Math.abs(y - cy);
    const sx = Math.sign(x - cx);
    const sy = Math.sign(y - cy);
    for (let ix = 0, iy = 0; ix < a || iy < b; ) {
      const horizontal = (ix + 0.5) / a < (iy + 0.5) / b;
      // Kierunek z ze znakiem: zawrócenie w tej samej osi to nowy odcinek.
      const next = horizontal ? `H${sx}` : `V${sy}`;
      if (next !== dir) {
        flush();
        dir = next;
      }
      if (horizontal) {
        ix++;
        cx += sx;
      } else {
        iy++;
        cy += sy;
      }
    }
  }
  flush();
  return d;
}
