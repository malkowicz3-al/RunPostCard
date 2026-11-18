import { CAMERA_CENTER, type Camera } from './camera';
import type { Rect, Region } from './mapTiles';

type Box = { left: number; top: number; width: number; height: number };

// viewBox tła ekranu w jednostkach pocztówki: ramka = 1080 jednostek szerokości, jej lewy górny róg = (0, 0).
export function backdropViewBox(screen: Box, frame: Box): Rect {
  const u = 1080 / frame.width;
  const x0 = (screen.left - frame.left) * u;
  const y0 = (screen.top - frame.top) * u;
  return [x0, y0, x0 + screen.width * u, y0 + screen.height * u];
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

// Obszar płótna widoczny w tle przy danej kamerze (odwrotność cameraTransform, potem odwrotność macierzy 3D), z marginesem.
export function backdropArea(
  [x0, y0, x1, y1]: Rect,
  { zoom, x, y }: Camera,
  margin = 0.15,
  [a, b, c, d, e, f]: Matrix = IDENTITY,
): Rect {
  const [cx, cy] = CAMERA_CENTER;
  const mx = (x1 - x0) * margin;
  const my = (y1 - y0) * margin;
  const det = a * d - c * b;
  if (!det) return backdropArea([x0, y0, x1, y1], { zoom, x, y }, margin);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const sx of [x0 - mx, x1 + mx])
    for (const sy of [y0 - my, y1 + my]) {
      const px = cx + (sx - cx - x) / zoom - e;
      const py = cy + (sy - cy - y) / zoom - f;
      xs.push((d * px - c * py) / det);
      ys.push((a * py - b * px) / det);
    }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// Fragment tła to zawsze poziom pocztówki (k = 1); zoom kamery i macierz, przy których go wyznaczono.
export type LoadedArea = Region & { zoom: number; matrix: Matrix };

// Ten sam zoom (ten sam poziom kafelków), ta sama macierz i widoczna część wciąż w doczytanym prostokącie: zostaje stary obszar.
export function nextBackdropArea(prev: LoadedArea | null, viewBox: Rect, camera: Camera, matrix: Matrix = IDENTITY): LoadedArea {
  const [x0, y0, x1, y1] = backdropArea(viewBox, camera, 0, matrix);
  if (prev && prev.zoom === camera.zoom && prev.matrix === matrix) {
    const [px0, py0, px1, py1] = prev.rect;
    if (x0 >= px0 && y0 >= py0 && x1 <= px1 && y1 <= py1) return prev;
  }
  return { k: 1, rect: backdropArea(viewBox, camera, 0.15, matrix), zoom: camera.zoom, matrix };
}
