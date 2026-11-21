import { ROUTE_BOX } from '../postcard/Route';

// Kamera pocztówki: przybliżenie i obrót (stopnie) wokół środka pola trasy oraz przesunięcie (jednostki SVG).
// W 3D angle to azymut izometrii (isoRoute), a reszta dostaje kamerę z angle 0.
export type Camera = { zoom: number; x: number; y: number; angle?: number };
export const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
export const MAX_ZOOM = 4;

const SIZE: [number, number] = [1080, 1920];
const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
export const CAMERA_CENTER: [number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2];
const [CX, CY] = CAMERA_CENTER;
const HALF_BOX: [number, number] = [(bx1 - bx0) / 2, (by1 - by0) / 2];
const RAD = Math.PI / 180;

// s = C + pan + zoom·R(angle)·(p − C); bez obrotu dokładnie stary napis.
export const cameraTransform = ({ zoom, x, y, angle }: Camera) =>
  angle
    ? `translate(${CX + x} ${CY + y}) scale(${zoom}) rotate(${angle}) translate(${-CX} ${-CY})`
    : `translate(${CX * (1 - zoom) + x} ${CY * (1 - zoom) + y}) scale(${zoom})`;
// Punkt po tej samej transformacji co cameraTransform.
export const applyCamera = ({ zoom, x, y, angle }: Camera, [px, py]: [number, number]): [number, number] => {
  if (!angle) return [CX * (1 - zoom) + x + px * zoom, CY * (1 - zoom) + y + py * zoom];
  const cos = Math.cos(angle * RAD);
  const sin = Math.sin(angle * RAD);
  const [dx, dy] = [px - CX, py - CY];
  return [CX + x + zoom * (dx * cos - dy * sin), CY + y + zoom * (dx * sin + dy * cos)];
};
// Odwrotność applyCamera: punkt ekranu -> punkt płótna.
export const unapplyCamera = ({ zoom, x, y, angle }: Camera, [sx, sy]: [number, number]): [number, number] => {
  const dx = (sx - CX - x) / zoom;
  const dy = (sy - CY - y) / zoom;
  if (!angle) return [CX + dx, CY + dy];
  const cos = Math.cos(angle * RAD);
  const sin = Math.sin(angle * RAD);
  return [CX + dx * cos + dy * sin, CY - dx * sin + dy * cos];
};

// Macierz SVG [a b c d e f] z ekranu kamery from na ekran kamery to (podobieństwo): obraz zrobiony przy from,
// przekształcony nią, pokrywa się z widokiem przy to (podgląd z gotowego obrazu w trakcie ruchu).
export const cameraDelta = (from: Camera, to: Camera): [number, number, number, number, number, number] => {
  const map = (p: [number, number]) => applyCamera(to, unapplyCamera(from, p));
  const [e, f] = map([0, 0]);
  const [ax, ay] = map([1, 0]);
  const [cx, cy] = map([0, 1]);
  return [ax - e, ay - f, cx - e, cy - f, e, f];
};

// Kąt w [−180, 180]; 180 zostaje 180 (koniec suwaka).
export const wrapAngle = (a: number) => (a >= -180 && a <= 180 ? a : a - 360 * Math.floor((a + 180) / 360));

// Obrót dwóch palców: zmiana kierunku od drugiego palca do ruszanego, w stopniach (−180, 180].
export const twistDegrees = (prev: [number, number], next: [number, number], other: [number, number]) => {
  const d = (Math.atan2(next[1] - other[1], next[0] - other[0]) - Math.atan2(prev[1] - other[1], prev[0] - other[0])) / RAD;
  return d > 180 ? d - 360 : d <= -180 ? d + 360 : d;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Środek trasy nie wychodzi poza płótno, a przy zoomie każdy punkt pola trasy da się przesunąć na środek.
// Płasko też: lukę poza płótnem wypełnia mapa doczytana poza nim (loadRegionLayers). Przy obrocie: połówki obróconego pola.
// W 3D kamera się nie obraca (azymut robi isoRoute), więc pole liczymy jak przy 0°, a sam kąt zostaje.
export const clampCamera = ({ zoom, x, y, angle }: Camera, is3d = false): Camera => {
  const a = wrapAngle(angle ?? 0);
  const r = is3d ? 0 : a * RAD;
  const cos = Math.abs(Math.cos(r));
  const sin = Math.abs(Math.sin(r));
  const [h0, h1] = HALF_BOX;
  // Płasko z obrotem można oddalić, aż obrócone pole trasy zmieści się w nieobróconym.
  const z = clamp(zoom, Math.min(1, h0 / (cos * h0 + sin * h1), h1 / (sin * h0 + cos * h1)), MAX_ZOOM);
  const lx = Math.max(CX, z * (cos * h0 + sin * h1));
  const ly = z * (sin * h0 + cos * h1);
  return {
    zoom: z,
    x: clamp(x, -lx, Math.max(SIZE[0] - CX, lx)),
    y: clamp(y, -Math.max(CY, ly), Math.max(SIZE[1] - CY, ly)),
    ...(a ? { angle: a } : {}),
  };
};

// Te same wartości zostawiają stary obiekt: bez nowego settled i bez doczytywania mapy.
export const keepCamera = (prev: Camera, next: Camera): Camera =>
  next.zoom === prev.zoom && next.x === prev.x && next.y === prev.y && (next.angle ?? 0) === (prev.angle ?? 0) ? prev : next;
