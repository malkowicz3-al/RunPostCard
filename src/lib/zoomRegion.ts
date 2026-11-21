import { unapplyCamera, type Camera } from './camera';
import type { Rect, Region } from './mapTiles';

// Podłoga 3D poza tym prostokątem leży poza płaskim płótnem albo jest wygaszona (maska: koło 540,720 r=760).
const FLOOR: Rect = [0, 0, 1080, 1480];

// Fragment płaskiej mapy widoczny przy kamerze 3D (s = C + zoom·R·(p − C) + pan, potem macierz izometrii),
// z marginesem, żeby szew z mapą podstawową był poza kadrem. null = zoom za mały albo nic nie widać.
export function zoomRegion(
  camera: Camera,
  [a, b, c, d, e, f]: [number, number, number, number, number, number],
  [w, h]: [number, number],
  margin = 0.15,
  floor: Rect = FLOOR, // widok płaski: całe płótno
): Region | null {
  // Próg 1,5: od tego zoomu mapTiles (round log2) wybiera kafelki o poziom gęstsze.
  const det = a * d - c * b;
  const { zoom } = camera;
  if (zoom < 1.5 || !det) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sx of [-w * margin, w * (1 + margin)])
    for (const sy of [-h * margin, h * (1 + margin)]) {
      const [ux, uy] = unapplyCamera(camera, [sx, sy]);
      const px = ux - e;
      const py = uy - f;
      xs.push((d * px - c * py) / det);
      ys.push((a * py - b * px) / det);
    }
  const rect: Rect = [
    Math.max(floor[0], Math.min(...xs)),
    Math.max(floor[1], Math.min(...ys)),
    Math.min(floor[2], Math.max(...xs)),
    Math.min(floor[3], Math.max(...ys)),
  ];
  if (rect[0] >= rect[2] || rect[1] >= rect[3]) return null;
  return { k: 2 ** Math.round(Math.log2(zoom)), rect };
}
