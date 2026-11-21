import type { Building, MapLayers } from '../lib/vectorMap';
import { genreDef, type Genre, type GenreId } from './genres';
import type { Pt } from './grid';
import { parseLines, routeIndex } from './geom';
import { hashSeed, mulberry32 } from './rng';

export { parseLines };

// Pojazd w px płótna, kąt w stopniach; look z gatunku w wariancie (Props nie sięga do GENRES).
export type Prop = { kind: 'car' | 'ship'; x: number; y: number; angle: number; genre: GenreId; look: Genre['props']['look'] };

const HALF_STREET = 17; // pół szerokości ulicy trasy (asfalt 28 px + krawężnik)
const CAR_CORRIDOR = 34; // auta poza całą ulicą trasy
const MIN_SIGN_H = 25; // szyld tylko na wyższych budynkach (m)
const MIN_SEG = 20; // najkrótszy odcinek ulicy z autem (px)
const SHIP_MARGIN = 0.15;

const fmt = (p: Pt) => `${Math.round(p[0])} ${Math.round(p[1])}`;

// Świat na prawdziwej mapie (ADR 0013): ulica trasy zamiast dróg major (te idą do mid), bez brył na ulicy trasy,
// neon i szyldy ze skrótu środka bryły (ten sam budynek w bazie, refined i tle dostaje ten sam kolor). Czysta funkcja.
// Wariant zmienia tylko kolory (skrót bez wariantu, więc te same bryły dostają odpowiadające sobie kolory).
export function decorateWorld(layers: MapLayers, points: Pt[], seed: number, genre: GenreId, variant?: string): MapLayers {
  const { accents, signs } = genreDef(genre, variant);
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
    .map((b) => {
      const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length;
      const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length;
      const r = mulberry32(hashSeed(seed, genre, Math.round(cx / 4), Math.round(cy / 4)));
      const accent = accents[Math.floor(r() * accents.length)];
      const s = r() < 0.3;
      return { ...b, accent, sign: signs && s && b.h >= MIN_SIGN_H };
    });
  const building = buildings.map((b) => `M${b.ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('') || undefined;
  return { ...layers, major, mid, buildings, building };
}

// Pojazdy (ADR 0013): auta na prawdziwych ulicach minor i mid poza ulicą trasy, statki w płótnie. Czysta funkcja.
export function worldProps(layers: MapLayers, points: Pt[], seed: number, genre: GenreId, variant?: string): Prop[] {
  const { props } = genreDef(genre, variant);
  const { look } = props;
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
      candidates.push({ car: { kind: 'car', x: Math.round(x), y: Math.round(y), angle, genre, look }, key });
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
    look,
  }));
  return [...cars, ...ships];
}
