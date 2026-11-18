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

// Obszar płótna widoczny w tle przy danej kamerze (odwrotność cameraTransform), z marginesem.
export function backdropArea([x0, y0, x1, y1]: Rect, { zoom, x, y }: Camera, margin = 0.15): Rect {
  const [cx, cy] = CAMERA_CENTER;
  const mx = (x1 - x0) * margin;
  const my = (y1 - y0) * margin;
  const inv = (s: number, c: number, pan: number) => c + (s - c - pan) / zoom;
  return [inv(x0 - mx, cx, x), inv(y0 - my, cy, y), inv(x1 + mx, cx, x), inv(y1 + my, cy, y)];
}

// Fragment tła to zawsze poziom pocztówki (k = 1); zoom kamery, przy którym go wyznaczono.
export type LoadedArea = Region & { zoom: number };

// Ten sam zoom (ten sam poziom kafelków) i widoczna część wciąż w doczytanym prostokącie: zostaje stary obszar.
export function nextBackdropArea(prev: LoadedArea | null, viewBox: Rect, camera: Camera): LoadedArea {
  const [x0, y0, x1, y1] = backdropArea(viewBox, camera, 0);
  if (prev && prev.zoom === camera.zoom) {
    const [px0, py0, px1, py1] = prev.rect;
    if (x0 >= px0 && y0 >= py0 && x1 <= px1 && y1 <= py1) return prev;
  }
  return { k: 1, rect: backdropArea(viewBox, camera), zoom: camera.zoom };
}
