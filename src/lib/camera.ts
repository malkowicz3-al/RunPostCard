import { ROUTE_BOX } from '../postcard/Route';

// Kamera pocztówki: przybliżenie wokół środka pola trasy i przesunięcie (jednostki SVG).
export type Camera = { zoom: number; x: number; y: number };
export const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };
export const MAX_ZOOM = 4;

const SIZE: [number, number] = [1080, 1920];
const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
export const CAMERA_CENTER: [number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2];
const [CX, CY] = CAMERA_CENTER;
const HALF_BOX: [number, number] = [(bx1 - bx0) / 2, (by1 - by0) / 2];

export const cameraTransform = ({ zoom, x, y }: Camera) =>
  `translate(${CX * (1 - zoom) + x} ${CY * (1 - zoom) + y}) scale(${zoom})`;
// Punkt po tej samej transformacji co cameraTransform.
export const applyCamera = ({ zoom, x, y }: Camera, [px, py]: [number, number]): [number, number] => [
  CX * (1 - zoom) + x + px * zoom,
  CY * (1 - zoom) + y + py * zoom,
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Środek trasy nie wychodzi poza płótno, a przy zoomie każdy punkt pola trasy da się przesunąć na środek.
// Płasko też: lukę poza płótnem wypełnia mapa doczytana poza nim (loadRegionLayers).
export const clampCamera = ({ zoom, x, y }: Camera): Camera => {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const lx = Math.max(CX, HALF_BOX[0] * z);
  const ly = HALF_BOX[1] * z;
  return {
    zoom: z,
    x: clamp(x, -lx, Math.max(SIZE[0] - CX, lx)),
    y: clamp(y, -Math.max(CY, ly), Math.max(SIZE[1] - CY, ly)),
  };
};

// Te same wartości zostawiają stary obiekt: bez nowego settled i bez doczytywania mapy.
export const keepCamera = (prev: Camera, next: Camera): Camera =>
  next.zoom === prev.zoom && next.x === prev.x && next.y === prev.y ? prev : next;
