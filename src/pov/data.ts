import type { GeoProjection } from 'd3-geo';
import { ShapeUtils, Vector2 } from 'three';
import type { RunStreams } from '../strava/api';
import type { Building } from '../lib/vectorMap';
import { demAt, type Dem } from '../lib/dem';
import { smoothByDistance } from '../lib/isoRoute';
import { mix } from '../lib/color';

// Dane sceny POV bez obiektów Three.js (testowalne w node). Układ jak w Three.js:
// x = wschód, y = wysokość, z = południe, w metrach od środka trasy na płótnie pocztówki.
export type V3 = [number, number, number];
export type Frame = { cx: number; cy: number; m: number }; // środek trasy w px płótna, metrów na px
export type Ground = (x: number, z: number) => number; // wysokość podłoża [m sceny]
export type Track = { pos: V3[]; dist: number[]; total: number }; // próbki co STEP_M, dist od startu
export type Mesh = { positions: Float32Array; colors: Float32Array; index: Uint32Array };

const EARTH_RADIUS_M = 6371000;
export const STEP_M = 10;
const LATLNG_HALF_M = 30; // wygładzenie GPS (włochata linia z bliska)
const ALT_HALF_M = 100;
const TERRAIN_EXAGGERATION = 1.5;
const FLAT_TARGET_M = 150; // bez terenu: rozpiętość wysokości podbita do ok. 150 m, najwyżej ×3 (jak widok 3D)
export const LIFT_M = 3; // trasa nad podłożem
const BACK_M = 120;
const UP_M = 55; // nisko, żeby budynki czytały się jako bryły
const AHEAD_M = 250;
const LOOK_DOWN_M = 155; // cel kamery pod trasą
const HEADING_HALF_M = 120; // kierunek z różnicy punktów ±120 m
const HEADING_SMOOTH_M = 200; // wytłumienie skrętów kamery
export const CLEAR_M = 20; // kamera co najmniej tyle nad terenem
export const MAX_BUILDINGS = 3000;
export const MIN_BUILDING_M = 12; // domyślne 10 m z mapy z góry ginie w podłodze
export const FOV = 55; // pionowy kąt kamery w stopniach (PerspectiveCamera w scene.ts)

export function localFrame(projection: GeoProjection, points: [number, number][]): Frame {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const lat = projection.invert?.([cx, cy])?.[1] ?? 0;
  // d3 Mercator: x = scale · λ, więc 1 px = R · cos(lat) / scale metrów (jak mPerUnit w loadDem).
  return { cx, cy, m: (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180)) / projection.scale() };
}

export const toLocal = (f: Frame, [x, y]: [number, number]): [number, number] => [(x - f.cx) * f.m, (y - f.cy) * f.m];
export const toCanvas = (f: Frame, x: number, z: number): [number, number] => [f.cx + x / f.m, f.cy + z / f.m];

export function groundOf(f: Frame, dem: Dem | null, base: number, exaggeration: number): Ground {
  if (!dem) return () => 0;
  return (x, z) => {
    const [px, py] = toCanvas(f, x, z);
    return (demAt(dem, px, py) - base) * exaggeration;
  };
}

function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo, hi];
}

// Trasa wygładzona i próbkowana co STEP_M po dystansie; z DEM na terenie, bez niego na wysokości zegarka nad płaską podłogą.
export function track(s: RunStreams, projection: GeoProjection, dem: Dem | null): { frame: Frame; track: Track; ground: Ground } {
  const lat = smoothByDistance(s.latlng.map(([la]) => la), s.distance, LATLNG_HALF_M);
  const lng = smoothByDistance(s.latlng.map(([, lo]) => lo), s.distance, LATLNG_HALF_M);
  const canvas = lat.map((la, i) => (projection([lng[i], la]) ?? [0, 0]) as [number, number]);
  const frame = localFrame(projection, canvas);
  const alt = dem
    ? canvas.map(([x, y]) => demAt(dem, x, y))
    : s.altitude
      ? smoothByDistance(s.altitude, s.distance, ALT_HALF_M)
      : canvas.map(() => 0);
  const [base, top] = extent(alt);
  const span = top - base;
  const exaggeration = dem ? TERRAIN_EXAGGERATION : span > 0 ? Math.min(3, Math.max(1, FLAT_TARGET_M / span)) : 1;
  const local = canvas.map((p) => toLocal(frame, p));
  const d0 = s.distance[0];
  const total = s.distance[s.distance.length - 1] - d0;
  const n = Math.max(2, Math.ceil(total / STEP_M) + 1);
  const pos: V3[] = [];
  const dist: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.min(total, i * STEP_M);
    while (j < s.distance.length - 2 && s.distance[j + 1] - d0 < d) j++;
    const a = s.distance[j] - d0;
    const b = s.distance[j + 1] - d0;
    const f = b > a ? Math.min(1, Math.max(0, (d - a) / (b - a))) : 0;
    const x = local[j][0] + (local[j + 1][0] - local[j][0]) * f;
    const z = local[j][1] + (local[j + 1][1] - local[j][1]) * f;
    const h = alt[j] + (alt[j + 1] - alt[j]) * f;
    pos.push([x, (h - base) * exaggeration + LIFT_M, z]);
    dist.push(d);
  }
  return { frame, track: { pos, dist, total }, ground: groundOf(frame, dem, base, exaggeration) };
}

// Punkt trasy na dystansie d (liniowo między próbkami).
function along(t: Track, d: number): V3 {
  const n = t.pos.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(d / STEP_M)));
  const span = t.dist[i + 1] - t.dist[i];
  const f = span > 0 ? Math.min(1, Math.max(0, (d - t.dist[i]) / span)) : 0;
  const [a, b] = [t.pos[i], t.pos[i + 1]];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export type CameraPath = { track: Track; ground: Ground; eye: V3[]; look: V3[] };

// Klatki kamery w każdej próbce: za biegaczem i nad nim, patrzy przed siebie; kierunek wytłumiony po dystansie.
export function cameraPath(t: Track, ground: Ground): CameraPath {
  const k = Math.round(HEADING_HALF_M / STEP_M);
  const n = t.pos.length;
  const hx = t.pos.map((_, i) => t.pos[Math.min(n - 1, i + k)][0] - t.pos[Math.max(0, i - k)][0]);
  const hz = t.pos.map((_, i) => t.pos[Math.min(n - 1, i + k)][2] - t.pos[Math.max(0, i - k)][2]);
  const sx = smoothByDistance(hx, t.dist, HEADING_SMOOTH_M);
  const sz = smoothByDistance(hz, t.dist, HEADING_SMOOTH_M);
  let last: [number, number] = [1, 0];
  const heading = sx.map((x, i) => {
    const len = Math.hypot(x, sz[i]);
    if (len > 1e-6) last = [x / len, sz[i] / len];
    return last;
  });
  const eye = t.pos.map(([x, y, z], i): V3 => [x - heading[i][0] * BACK_M, y + UP_M, z - heading[i][1] * BACK_M]);
  // Wysokość kamery wygładzona (bez skoków nad grzbietami), potem i tak nie niżej niż teren + CLEAR_M.
  const ys = smoothByDistance(
    eye.map(([x, y, z]) => Math.max(y, ground(x, z) + CLEAR_M)),
    t.dist,
    HEADING_SMOOTH_M,
  );
  eye.forEach((e, i) => (e[1] = Math.max(ys[i], ground(e[0], e[2]) + CLEAR_M)));
  // Cel LOOK_DOWN_M pod trasą: kamera pochylona ok. 30°, biegacz ok. 5° nad środkiem kadru (nie pod statystykami).
  const look = t.pos.map(([x, y, z], i): V3 => [x + heading[i][0] * AHEAD_M, y - LOOK_DOWN_M, z + heading[i][1] * AHEAD_M]);
  return { track: t, ground, eye, look };
}

const catmull = (p0: number, p1: number, p2: number, p3: number, f: number) =>
  0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);

function spline(points: V3[], d: number): V3 {
  const n = points.length;
  const x = Math.min(n - 1, Math.max(0, d / STEP_M));
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const at = (k: number) => points[Math.min(n - 1, Math.max(0, k))];
  const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
  return [0, 1, 2].map((c) => catmull(p0[c], p1[c], p2[c], p3[c], f)) as V3;
}

// progress 0..1 = ułamek dystansu. Kamera po krzywej Catmull-Rom przez klatki, biegacz na trasie.
export function cameraAt(path: CameraPath, progress: number): { eye: V3; look: V3; runner: V3 } {
  const d = Math.min(1, Math.max(0, progress)) * path.track.total;
  const eye = spline(path.eye, d);
  eye[1] = Math.max(eye[1], path.ground(eye[0], eye[2]) + CLEAR_M);
  return { eye, look: spline(path.look, d), runner: along(path.track, d) };
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// Punkt sceny na ekranie kamery w p, jak PerspectiveCamera(fov, aspect) z lookAt i osią y w górę: [0..1, 0..1] od lewego górnego rogu; null = za kamerą.
export function project(path: CameraPath, p: number, v: V3, aspect: number, fov = FOV): [number, number] | null {
  const { eye, look } = cameraAt(path, p);
  const forward = unit(sub(look, eye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(v, eye);
  const z = dot(d, forward);
  if (z <= 1) return null; // 1 = near kamery
  const tan = Math.tan((fov * Math.PI) / 360);
  return [(1 + dot(d, right) / (z * tan * aspect)) / 2, (1 - dot(d, up) / (z * tan)) / 2];
}

export function hexRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [1, 1, 1];
  const v = parseInt(m[1], 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// Kolor brył POV: kolor budynku motywu wyraźnie ku jasnemu na ciemnym tle i ku ciemnemu na jasnym (inaczej giną w podłodze).
export function povBuildingColor(building: string, background: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(building)) return building;
  const [r, g, b] = hexRgb(background);
  return mix(building, 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? '#ffffff' : '#000000', 0.4);
}

// Wstęga trasy: 2 wierzchołki na próbkę. Bez bottom pozioma (szerokość width), z bottom pionowa kurtyna do podłoża.
export function ribbon(t: Track, width: number, color: (t: number) => string, bottom?: Ground): Mesh {
  const n = t.pos.length;
  const positions = new Float32Array(n * 6);
  const colors = new Float32Array(n * 6);
  const index = new Uint32Array((n - 1) * 6);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = t.pos[i];
    const a = t.pos[Math.max(0, i - 1)];
    const b = t.pos[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const [nx, nz] = [-(b[2] - a[2]) / len, (b[0] - a[0]) / len];
    const w = width / 2;
    const pair = bottom
      ? [x, y, z, x, bottom(x, z), z]
      : [x + nx * w, y, z + nz * w, x - nx * w, y, z - nz * w];
    positions.set(pair, i * 6);
    const rgb = hexRgb(color(t.total > 0 ? t.dist[i] / t.total : 0));
    colors.set([...rgb, ...rgb], i * 6);
  }
  for (let i = 0; i < n - 1; i++) {
    const v = i * 2;
    index.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
  }
  return { positions, colors, index };
}

// Bryła z obrysu (x, z) od base do top: ściany i dach, trójkąty bez indeksu (płaskie normalne z computeVertexNormals).
export function extrude(ring: [number, number][], base: number, top: number): number[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  if (pts.length < 3 || !(top > base)) return [];
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[(i + 1) % pts.length];
    out.push(ax, base, az, bx, base, bz, bx, top, bz, ax, base, az, bx, top, bz, ax, top, az);
  }
  for (const [a, b, c] of ShapeUtils.triangulateShape(pts.map(([x, z]) => new Vector2(x, z)), []))
    for (const k of [a, b, c]) out.push(pts[k][0], top, pts[k][1]);
  return out;
}

// Największe obrysy (vectorMap sortuje malejąco po polu), każdy na wysokości terenu w środku.
export function buildingsData(buildings: Building[], f: Frame, ground: Ground, cap = MAX_BUILDINGS): Float32Array {
  const out: number[] = [];
  for (const { ring, h, min } of buildings.slice(0, cap)) {
    const local = ring.map((p) => toLocal(f, p));
    const cx = local.reduce((s, [x]) => s + x, 0) / local.length;
    const cz = local.reduce((s, [, z]) => s + z, 0) / local.length;
    const g = ground(cx, cz);
    for (const v of extrude(local, g + min, g + Math.max(h, MIN_BUILDING_M))) out.push(v);
  }
  return new Float32Array(out);
}
