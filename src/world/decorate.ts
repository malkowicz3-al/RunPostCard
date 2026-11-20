import type { Building, MapLayers } from '../lib/vectorMap';
import { GENRES, type GenreId } from './genres';
import type { Pt } from './grid';
import { hashSeed, mulberry32 } from './rng';

// Pojazd w px płótna, kąt w stopniach.
export type Prop = { kind: 'car' | 'ship'; x: number; y: number; angle: number; genre: GenreId };

const BUCKET = 64;
const HALF_STREET = 17; // pół szerokości ulicy trasy (asfalt 28 px + krawężnik)
const CAR_CORRIDOR = 34; // auta poza całą ulicą trasy
const MIN_SIGN_H = 25; // szyld tylko na wyższych budynkach (m)
const MIN_SEG = 20; // najkrótszy odcinek ulicy z autem (px)
const SHIP_MARGIN = 0.15;
const LARGE_H = 18; // duże bryły (m albo dłuższy bok obrysu w px) zostają przy rzadszej zabudowie
const LARGE_SPAN = 60;

const fmt = (p: Pt) => `${Math.round(p[0])} ${Math.round(p[1])}`;

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

// Świat na prawdziwej mapie (ADR 0013): ulica trasy zamiast dróg major (te idą do mid), bez brył na ulicy trasy,
// neon i szyldy ze skrótu środka bryły (ten sam budynek w bazie, refined i tle dostaje ten sam kolor). Czysta funkcja.
export function decorateWorld(layers: MapLayers, points: Pt[], seed: number, genre: GenreId): MapLayers {
  const { accents, signs, keep, ruin } = GENRES[genre];
  const major = points.length > 1 ? `M${points.map(fmt).join('L')}` : undefined;
  const mid = [layers.mid, layers.major].filter(Boolean).join('') || undefined;
  if (!layers.buildings) return { ...layers, major, mid };
  const nearRoute = routeIndex(points, HALF_STREET);
  // Wierzchołki i punkty krawędzi co najwyżej co pół ulicy poza korytarzem, więc nic nie wchodzi na ulicę trasy
  // (także długa ściana hali, którą trasa przecina w połowie).
  const blocked = (ring: Pt[]) =>
    ring.some(([ax, ay], k) => {
      const [bx, by] = ring[(k + 1) % ring.length];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / HALF_STREET));
      for (let i = 0; i < n; i++) if (nearRoute(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return true;
      return false;
    });
  const buildings: Building[] = layers.buildings
    .filter((b) => !blocked(b.ring))
    .flatMap((b) => {
      const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length;
      const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length;
      const r = mulberry32(hashSeed(seed, genre, Math.round(cx / 4), Math.round(cy / 4)));
      const accent = accents[Math.floor(r() * accents.length)];
      const s = r() < 0.3;
      // Gęstość i ruiny z grubszej siatki 16 px: ten sam budynek z kafelków refined i tła ma nieco inne wierzchołki,
      // a zniknięcie albo zmiana wysokości po doczytaniu mapy rzucałyby się w oczy bardziej niż inny kolor.
      const rk = mulberry32(hashSeed(seed, genre, 'keep', Math.round(cx / 16), Math.round(cy / 16)));
      const keepR = rk();
      const ruinR = rk();
      if (keepR >= keep && b.h < LARGE_H) {
        const xs = b.ring.map((p) => p[0]);
        const ys = b.ring.map((p) => p[1]);
        if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < LARGE_SPAN) return [];
      }
      const h = ruinR < ruin ? Math.min(b.h, Math.max(b.min + 3, b.min + (b.h - b.min) * (0.35 + 0.5 * rk()))) : b.h;
      return [{ ...b, h, accent, sign: signs && s && h >= MIN_SIGN_H }];
    });
  const building = buildings.map((b) => `M${b.ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('') || undefined;
  return { ...layers, major, mid, buildings, building };
}

// Linie warstwy z buildMapLayers ('M x yLx y…' sklejone, liczby ujemne i ułamkowe).
export function parseLines(d = ''): Pt[][] {
  return d
    .split('M')
    .filter(Boolean)
    .map((sub) => sub.split('L').map((p) => p.trim().split(/[ ,]+/).map(Number) as Pt));
}

// Pojazdy (ADR 0013): auta na prawdziwych ulicach minor i mid poza ulicą trasy, statki w płótnie. Czysta funkcja.
export function worldProps(layers: MapLayers, points: Pt[], seed: number, genre: GenreId): Prop[] {
  const { props } = GENRES[genre];
  if (!props.cars && !props.ships) return [];
  const nearRoute = routeIndex(points, CAR_CORRIDOR);
  const candidates: { car: Prop; key: number }[] = [];
  for (const line of [...parseLines(layers.minor), ...parseLines(layers.mid)])
    for (let k = 1; k < line.length; k++) {
      const [a, b] = [line[k - 1], line[k]];
      if (!(Math.hypot(b[0] - a[0], b[1] - a[1]) >= MIN_SEG)) continue;
      const key = hashSeed(seed, genre, Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2));
      const t = mulberry32(key)();
      const [x, y] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      // Sprawdzamy samo auto, nie środek odcinka: długa prosta ulica może przecinać trasę.
      if (nearRoute(x, y)) continue;
      const angle = Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
      candidates.push({ car: { kind: 'car', x: Math.round(x), y: Math.round(y), angle, genre }, key });
    }
  const cars = candidates
    .sort((p, q) => p.key - q.key)
    .slice(0, props.cars)
    .map((c) => c.car);
  const r = mulberry32(hashSeed(seed, genre, 'ship'));
  const span = 1 - 2 * SHIP_MARGIN;
  const ships = Array.from({ length: props.ships }, (): Prop => ({
    kind: 'ship',
    x: Math.round(1080 * (SHIP_MARGIN + span * r())),
    y: Math.round(1920 * (SHIP_MARGIN + span * r())),
    angle: Math.round(r() * 360),
    genre,
  }));
  return [...cars, ...ships];
}
