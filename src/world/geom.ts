import type { Pt } from './grid';

const BUCKET = 64;

export function segDist(px: number, py: number, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

// Indeks kubełkowy odcinków trasy poszerzonych o korytarz: nearRoute sprawdza tylko odcinki z kubełka punktu.
export function routeIndex(points: Pt[], corridor: number): (x: number, y: number) => boolean {
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

// Linie i pierścienie warstwy z buildMapLayers ('M x yLx y…' sklejone, liczby ujemne i ułamkowe; Z poligonów pomijamy).
export function parseLines(d = ''): Pt[][] {
  return d
    .replace(/Z/g, '')
    .split('M')
    .filter(Boolean)
    .map((sub) => sub.split('L').map((p) => p.trim().split(/[ ,]+/).map(Number) as Pt));
}

// Obrót i przesunięcie wielokąta do ścieżki (jedna ścieżka na wiele ikon, bez <use>); współrzędne co 0,1 px.
export const poly = (pts: Pt[], x: number, y: number, angle = 0) => {
  const [c, s] = [Math.cos((angle * Math.PI) / 180), Math.sin((angle * Math.PI) / 180)];
  return `M${pts.map(([px, py]) => `${Math.round((x + px * c - py * s) * 10) / 10} ${Math.round((y + px * s + py * c) * 10) / 10}`).join('L')}Z`;
};
export const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
