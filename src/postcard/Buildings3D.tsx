import { memo, useMemo } from 'react';
import { mix } from '../lib/color';
import type { IsoRoute } from '../lib/isoRoute';
import type { Building } from '../lib/vectorMap';
import type { BuildingShape } from './mapStyle';

// W skali pocztówki 20 m to tylko kilka px; podbicie niezależne od przewyższenia trasy.
const BUILDING_EXAGGERATION = 1.5;
// Okna, blanki, anteny i kondygnacje tylko dla brył szerszych niż DETAIL_PX i o ścianach wyższych niż DETAIL_WALL_PX
// (px pocztówki przy zoomie 1; budynek bez render_height, 10 m, ma ok. 5,6 px).
const DETAIL_PX = 12;
const DETAIL_WALL_PX = 5;
const ANTENNA_M = 20; // antena tylko na wyższych niż tyle
const FLOOR_M = 3.5; // piętro (okna, kondygnacje voxel)
const MAX_FLOORS = 30;
const MAX_MERLONS = 40; // ząbki na krawędź
const ANTENNAS = 8; // tyle najwyższych brył w motywie tower dostaje antenę
// Obiekty świąteczne (Building.festive): szerokość na ekranie z rzutu obrysu, w tych granicach (px).
const FESTIVE_MIN_PX = 10;
const FESTIVE_MAX_PX = 60;
const RIBBON = '#fff3c4';
const PINES = ['#2e8b4e', '#237a42', '#1a6636'];
const TRUNK = '#6b4226';
const STAR = '#f5c62e';
const BAUBLES = ['#d7263d', '#f5c62e', '#2f6fd6', '#ffffff'];
const BUNNY = '#fbf7f2';
const BUNNY_LINE = '#7d6b7d';
const BUNNY_EAR = '#f4a6c0';

type Pt = [number, number];
type Part = { d: string; fill?: string; stroke?: string; width?: number; opacity?: number };
type Solid = { y: number; parts: Part[] };

const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const partSvg = ({ d, fill, stroke, width, opacity }: Part) =>
  !d
    ? ''
    : `<path d="${d}" fill="${attr(fill ?? 'none')}"${stroke ? ` stroke="${attr(stroke)}"` : ''}` +
      `${width != null ? ` stroke-width="${width}"` : ''}${opacity != null ? ` opacity="${opacity}"` : ''}/>`;

// Prostokąt minimalny obrysu (kierunek jednej z krawędzi). s: położenie w poprzek kalenicy, -1..1 (0 na kalenicy);
// krawędzie przecinające kalenicę dostają punkt z s = 0, więc oba spadki dachu są płaskimi wielokątami z prawdziwego obrysu.
export function gable(ring: Pt[]): { pts: [number, number, number][]; half: number; ratio: number } {
  let best = { area: Infinity, nx: 0, ny: 1, c: 0, half: 0, ratio: 1 };
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!len) continue;
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of ring) {
      const u = x * ux + y * uy;
      const v = y * ux - x * uy;
      u0 = Math.min(u0, u);
      u1 = Math.max(u1, u);
      v0 = Math.min(v0, v);
      v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area >= best.area) continue;
    // Spadek w poprzek dłuższego boku, więc kierunek n to krótszy bok.
    best =
      u1 - u0 >= v1 - v0
        ? { area, nx: -uy, ny: ux, c: (v0 + v1) / 2, half: (v1 - v0) / 2, ratio: (u1 - u0) / (v1 - v0) }
        : { area, nx: ux, ny: uy, c: (u0 + u1) / 2, half: (u1 - u0) / 2, ratio: (v1 - v0) / (u1 - u0) };
  }
  const side = ([x, y]: Pt) => (best.half ? (x * best.nx + y * best.ny - best.c) / best.half : 0);
  const pts: [number, number, number][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p0 = ring[i];
    const p1 = ring[(i + 1) % ring.length];
    const s0 = side(p0);
    const s1 = side(p1);
    pts.push([p0[0], p0[1], s0]);
    if (s0 * s1 < 0) {
      const t = s0 / (s0 - s1);
      pts.push([p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]), 0]);
    }
  }
  return { pts, half: best.half, ratio: best.ratio };
}

// Bryły w przestrzeni ekranu (pod kamerą, jak trasa): obrys przez macierz izometrii, dach wyżej o wysokość.
// Algorytm malarza: od tyłu (mniejsze y podstawy) do przodu; ściany tylko od strony widza. Bez <defs>, więc
// kilka pocztówek na stronie nie koliduje id. shape zmienia tylko bryłę, obrys zostaje prawdziwy.
// Bryła na budynek z tym samym widokiem liczona raz: powrót do 3D i doczytana ostrzejsza mapa (te same obiekty
// budynków bazowych) nie liczą wszystkiego od nowa. WeakMap, więc pamięć znika razem z mapą.
const solidCache = new WeakMap<Building, { key: string; solid: Solid }>();

export const Buildings3D = memo(function Buildings3D({
  buildings,
  matrix: [a, b, c, d, e, f],
  pxPerM,
  color,
  fill,
  filter,
  shape = 'plain',
  accent,
}: {
  buildings: Building[];
  matrix: IsoRoute['matrix'];
  pxPerM: number;
  color: string; // colors.building (hex): z niego odcienie ścian
  fill?: string; // farba dachu (np. url(#kreskowanie)); domyślnie color
  filter?: string;
  shape?: BuildingShape;
  accent?: string; // neon okien i krawędzi dachu w wariancie tower
}) {
  const markup = useMemo(() => {
    const s = pxPerM * BUILDING_EXAGGERATION;
    const mPerUnit = Math.hypot(a, 2 * b) / pxPerM; // metry na jednostkę płótna (iso: a = f·cos, b = f·sin/2 przy każdym azymucie, pxPerM = k0·f)
    const sx = (x: number, y: number) => a * x + c * y + e;
    const sy = (x: number, y: number) => b * x + d * y + f;
    const P = (x: number, y: number, z: number) => `${p(sx(x, y))} ${p(sy(x, y) - z * s)}`;
    const poly = (pts: [number, number, number][]) => 'M' + pts.map(([x, y, z]) => P(x, y, z)).join('L') + 'Z';
    const left = mix(color, '#000000', 0.45);
    const right = mix(color, '#000000', 0.25);
    const roofFill = fill ?? color;
    const neon = accent ?? mix(color, '#ffffff', 0.6);
    const tall = shape === 'tower' ? (buildings.map((u) => u.h).sort((u, v) => v - u)[ANTENNAS - 1] ?? 0) : Infinity;

    // Krawędzie od strony widza: [i, j, lewa?]. Normalna na zewnątrz = sign · (dy, -dx); widoczna, gdy w dół ekranu.
    // Podwójne pole rzutu: na podłoże albo z wysokością z (dach).
    const area2 = (pts: [number, number, number][], lifted: boolean) => {
      let area = 0;
      const y = (q: [number, number, number]) => sy(q[0], q[1]) - (lifted ? q[2] * s : 0);
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
        area += sx(pts[j][0], pts[j][1]) * y(pts[i]) - sx(pts[i][0], pts[i][1]) * y(pts[j]);
      return area;
    };
    const visible = (pts: [number, number, number][]) => {
      const sign = Math.sign(area2(pts, false));
      const out: [number, number, boolean][] = [];
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[j];
        if (sign * (sx(x0, y0) - sx(x1, y1)) > 0) out.push([i, j, sign * (sy(x1, y1) - sy(x0, y0)) < 0]);
      }
      return out;
    };
    // Ściany od z0 do wysokości wierzchołka (z), więc szczyt dachu dwuspadowego wychodzi sam.
    const prism = (pts: [number, number, number][], z0: number, lf = left, rf = right): Part[] => {
      let l = '';
      let r = '';
      for (const [i, j, isLeft] of visible(pts)) {
        const [x0, y0, t0] = pts[i];
        const [x1, y1, t1] = pts[j];
        const quad = `M${P(x0, y0, z0)}L${P(x1, y1, z0)}L${P(x1, y1, t1)}L${P(x0, y0, t0)}Z`;
        if (isLeft) l += quad;
        else r += quad;
      }
      return [
        { d: l, fill: lf },
        { d: r, fill: rf },
      ];
    };
    const floors = (z0: number, z1: number) => {
      const out: number[] = [];
      for (let z = z0 + FLOOR_M; z < z1 - 1 && out.length < MAX_FLOORS; z += FLOOR_M) out.push(z);
      return out;
    };
    // Poziome linie (okna, piętra) na widocznych ścianach.
    const lines = (pts: [number, number, number][], zs: number[], stroke: string, opacity: number): Part => {
      let dd = '';
      for (const [i, j] of visible(pts))
        for (const z of zs) dd += `M${P(pts[i][0], pts[i][1], z)}L${P(pts[j][0], pts[j][1], z)}`;
      return { d: dd, stroke, width: 0.8, opacity };
    };

    // Elipsa w px ekranu (środek x, y).
    const ell = (x: number, y: number, rx: number, ry: number) =>
      `M${p(x - rx)} ${p(y)}a${p(rx)} ${p(ry)} 0 1 0 ${p(2 * rx)} 0a${p(rx)} ${p(ry)} 0 1 0 ${p(-2 * rx)} 0Z`;
    // Obiekt świąteczny zamiast bryły. Prezent to pudełko na prawdziwym obrysie; choinka, jajko i królik stoją pionowo
    // na ekranie (billboard z rzutu środka, bez obrotu, więc prosto przy każdym azymucie). w: szerokość rzutu (px).
    const festiveParts = ({ ring, h, min, accent: own, festive }: Building, w: number): Part[] => {
      const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
      const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
      const bx = sx(cx, cy);
      const by = sy(cx, cy) - min * s;
      // Punkt billboardu: u w prawo, v w górę od podstawy (px).
      const at = (u: number, v: number) => `${p(bx + u)} ${p(by - v)}`;
      const tri = (v0: number, half: number, v1: number) => `M${at(-half, v0)}L${at(half, v0)}L${at(0, v1)}Z`;
      if (festive === 'gift') {
        let area = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        // Wysokość jak bok obrysu (prawie sześcian), najwyżej jak budynek.
        const top = min + Math.min(Math.sqrt(Math.abs(area) / 2) * mPerUnit, h - min);
        const paper = own ?? color;
        const pts = ring.map(([x, y]): [number, number, number] => [x, y, top]);
        const out = [...prism(pts, min, mix(paper, '#000000', 0.35), mix(paper, '#000000', 0.15)), { d: poly(pts), fill: paper }];
        // Wstążka: krzyż na wieczku wzdłuż najdłuższej krawędzi i w poprzek, dalej pionowo w dół na widocznych ścianach.
        let [ux, uy, len] = [1, 0, 0];
        ring.forEach(([x0, y0], i) => {
          const [x1, y1] = ring[(i + 1) % ring.length];
          const l = Math.hypot(x1 - x0, y1 - y0);
          if (l > len) [ux, uy, len] = [(x1 - x0) / l, (y1 - y0) / l, l];
        });
        // Najbliższe przecięcie promienia ze środka z obrysem: [punkt, indeks krawędzi albo -1].
        const reach = (dx: number, dy: number): [Pt, number] => {
          let best: [number, number] = [Infinity, -1];
          ring.forEach(([x0, y0], i) => {
            const [x1, y1] = ring[(i + 1) % ring.length];
            const [ex, ey] = [x1 - x0, y1 - y0];
            const den = dx * ey - dy * ex;
            if (!den) return;
            const t = ((x0 - cx) * ey - (y0 - cy) * ex) / den;
            const k = ((x0 - cx) * dy - (y0 - cy) * dx) / den;
            if (t > 0 && k >= 0 && k <= 1 && t < best[0]) best = [t, i];
          });
          return [[cx + dx * best[0], cy + dy * best[0]], best[1]];
        };
        const seen = new Set(visible(pts).map(([i]) => i));
        let band = '';
        for (const [dx, dy] of [[ux, uy], [-ux, -uy], [-uy, ux], [uy, -ux]]) {
          const [q, i] = reach(dx, dy);
          if (i < 0) continue;
          band += `M${P(cx, cy, top)}L${P(...q, top)}`;
          if (seen.has(i)) band += `M${P(...q, top)}L${P(...q, min)}`;
        }
        const k = Math.max(2.5, Math.min(7, w * 0.12)); // kokarda
        const [tx, ty] = [sx(cx, cy), sy(cx, cy) - top * s];
        const loop = (dir: number) =>
          `M${p(tx)} ${p(ty)}C${p(tx + dir * 1.3 * k)} ${p(ty - 1.2 * k)} ${p(tx + dir * 1.3 * k)} ${p(ty + 0.4 * k)} ${p(tx)} ${p(ty)}Z`;
        out.push({ d: band, stroke: RIBBON, width: Math.round(Math.max(1.5, w * 0.08) * 10) / 10 });
        out.push({ d: loop(-1) + loop(1) + ell(tx, ty, k * 0.3, k * 0.3), fill: RIBBON });
        return out;
      }
      if (festive === 'tree') {
        const H = 1.6 * w;
        const r = Math.max(1, w * 0.05);
        const star = Array.from({ length: 10 }, (_, i) => {
          const [ang, rad] = [(i * Math.PI) / 5, (i % 2 ? 0.4 : 1) * Math.max(3, w * 0.11)];
          return at(rad * Math.sin(ang), H + rad * Math.cos(ang));
        });
        const spots = [[-0.28, 0.18], [0.22, 0.3], [-0.12, 0.47], [0.14, 0.66]];
        return [
          { d: `M${at(-0.08 * w, 0)}L${at(0.08 * w, 0)}L${at(0.08 * w, 0.14 * H)}L${at(-0.08 * w, 0.14 * H)}Z`, fill: TRUNK },
          { d: tri(0.1 * H, 0.5 * w, 0.52 * H), fill: PINES[2] },
          { d: tri(0.36 * H, 0.4 * w, 0.76 * H), fill: PINES[1] },
          { d: tri(0.6 * H, 0.29 * w, 0.97 * H), fill: PINES[0] },
          ...BAUBLES.map((fill, i) => ({ d: ell(bx + spots[i][0] * w, by - spots[i][1] * H, r, r), fill })),
          { d: `M${star.join('L')}Z`, fill: STAR },
        ];
      }
      if (festive === 'egg') {
        const H = 1.3 * w;
        const shell = own ?? color;
        // Węższe u góry: najszersze na 40% wysokości.
        const egg =
          `M${at(0, 0)}C${at(0.28 * w, 0)} ${at(0.5 * w, 0.15 * H)} ${at(0.5 * w, 0.4 * H)}` +
          `C${at(0.5 * w, 0.72 * H)} ${at(0.25 * w, H)} ${at(0, H)}C${at(-0.25 * w, H)} ${at(-0.5 * w, 0.72 * H)} ${at(-0.5 * w, 0.4 * H)}` +
          `C${at(-0.5 * w, 0.15 * H)} ${at(-0.28 * w, 0)} ${at(0, 0)}Z`;
        const zig = Array.from({ length: 7 }, (_, i) => at((i / 3 - 1) * 0.44 * w, (i % 2 ? 0.5 : 0.42) * H)).join('L');
        return [
          { d: egg, fill: shell, stroke: mix(shell, '#000000', 0.3), width: 1 },
          {
            d: `M${zig}M${at(-0.36 * w, 0.7 * H)}L${at(0.36 * w, 0.7 * H)}M${at(-0.4 * w, 0.2 * H)}L${at(0.4 * w, 0.2 * H)}`,
            stroke: '#ffffff',
            width: Math.round(Math.max(1.2, w * 0.07) * 10) / 10,
          },
        ];
      }
      // Królik siedzący bokiem: ogonek, tułów, głowa, dwa długie uszy (różowe w środku), oko.
      const ear = (u0: number, u1: number, tip: number) =>
        `M${at(u0 * w, 0.85 * w)}Q${at((u0 - 0.12) * w, 1.3 * w)} ${at(tip * w, 1.62 * w)}Q${at((u1 + 0.06) * w, 1.3 * w)} ${at(u1 * w, 0.85 * w)}Z`;
      const body =
        ell(bx + 0.4 * w, by - 0.26 * w, 0.11 * w, 0.11 * w) +
        ell(bx + 0.05 * w, by - 0.3 * w, 0.4 * w, 0.3 * w) +
        ell(bx - 0.2 * w, by - 0.72 * w, 0.22 * w, 0.2 * w) +
        ear(-0.32, -0.18, -0.34) +
        ear(-0.14, 0, -0.02);
      const eye = Math.max(0.8, 0.03 * w);
      return [
        { d: body, fill: BUNNY, stroke: BUNNY_LINE, width: 1 },
        { d: ear(-0.29, -0.21, -0.32) + ear(-0.11, -0.03, -0.04), fill: BUNNY_EAR },
        { d: ell(bx - 0.27 * w, by - 0.74 * w, eye, eye), fill: BUNNY_LINE },
      ];
    };

    const key = [a, b, c, d, e, f, pxPerM, color, fill, shape, accent, tall].join();
    const build = (bld: Building): Solid => {
      const { ring, h, min, accent: own, sign } = bld;
      let x0 = Infinity, x1 = -Infinity, maxY = -Infinity;
      for (const [x, y] of ring) {
        x0 = Math.min(x0, sx(x, y));
        x1 = Math.max(x1, sx(x, y));
        maxY = Math.max(maxY, sy(x, y));
      }
      const edge = ([i, j]: [number, number, boolean]) => Math.hypot(ring[j][0] - ring[i][0], ring[j][1] - ring[i][1]);
      const detail = x1 - x0 >= DETAIL_PX && (h - min) * s >= DETAIL_WALL_PX;
      // Klucz: najniższy punkt rzutu na podłoże + wysokość dołu, więc część na podium idzie po podium.
      const solid: Solid = { y: maxY + min * s, parts: [] };
      if (bld.festive) {
        solid.parts = festiveParts(bld, Math.max(FESTIVE_MIN_PX, Math.min(FESTIVE_MAX_PX, x1 - x0)));
        return solid;
      }
      // Kolor gatunku World jako dach (poza tower, gdzie accent to neon okien i krawędzi).
      const roof = shape === 'tower' ? roofFill : (own ?? roofFill);
      const box = (top = h) => {
        const pts = ring.map(([x, y]): [number, number, number] => [x, y, top]);
        solid.parts.push(...prism(pts, min), { d: poly(pts), fill: roof });
        return pts;
      };
      const g = shape === 'gabled' || shape === 'castle' ? gable(ring) : null;
      const isTower = shape === 'castle' && g && (h - min >= 18 || (g.ratio <= 1.3 && h - min >= 10));

      if (g && !isTower) {
        const rise = Math.min(g.half * mPerUnit * 0.6, (h - min) * 0.5);
        const pts = g.pts.map(([x, y, t]): [number, number, number] => [x, y, h - rise * Math.abs(t)]);
        solid.parts.push(...prism(pts, min));
        // Spadek odwrócony od kamery (rzut z wysokością zmienia orientację względem obrysu) jest zasłonięty: pomijamy go,
        // inaczej zamalowałby ścianę szczytową. Cień na spadku z lewej strony kalenicy (stałe światło z prawej).
        const ground = area2(pts, false);
        const mx = pts.reduce((sum, [x, y]) => sum + sx(x, y), 0) / pts.length;
        for (const hf of [pts.filter((_, i) => g.pts[i][2] <= 0), pts.filter((_, i) => g.pts[i][2] >= 0)]) {
          if (hf.length < 3 || area2(hf, true) * ground <= 0) continue;
          solid.parts.push({ d: poly(hf), fill: roof });
          if (hf.reduce((sum, [x, y]) => sum + sx(x, y), 0) / hf.length < mx)
            solid.parts.push({ d: poly(hf), fill: '#000000', opacity: 0.18 });
        }
      } else if (shape === 'voxel') {
        const n = Math.max(1, Math.round((h - min) / FLOOR_M));
        const top = min + n * FLOOR_M;
        // Kondygnacje schodkowo: dolne 60% pięter na pełnym obrysie, wyżej obrys zwężony do środka.
        const tiers = detail && n >= 3 ? [[0, 1], [0.6, 0.72], ...(n >= 8 ? [[0.85, 0.45]] : [])] : [[0, 1]];
        const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
        const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
        tiers.forEach(([from, k], i) => {
          const zb = min + Math.round(from * n) * FLOOR_M;
          const zt = i + 1 < tiers.length ? min + Math.round(tiers[i + 1][0] * n) * FLOOR_M : top;
          const pts = ring.map(([x, y]): [number, number, number] => [cx + (x - cx) * k, cy + (y - cy) * k, zt]);
          solid.parts.push(...prism(pts, zb), { d: poly(pts), fill: roof });
          if (detail) solid.parts.push(lines(pts, floors(zb, zt), mix(color, '#000000', 0.7), 0.5));
        });
      } else {
        const pts = box();
        if (isTower && detail) {
          // Blanki: co drugi odcinek krawędzi dachu wystaje o ząbek (płaski, w odcieniu ścian).
          const m = Math.max(1.5, (h - min) * 0.1, 2 / s); // ząbek co najmniej 2 px
          const seg = m / mPerUnit;
          let dd = '';
          for (let i = 0; i < ring.length; i++) {
            const [ax, ay] = ring[i];
            const [bx, by] = ring[(i + 1) % ring.length];
            const k = Math.min(MAX_MERLONS, Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / seg)));
            for (let j = 0; j < k; j += 2) {
              const [u0, u1] = [j / k, (j + 1) / k];
              const q0: Pt = [ax + (bx - ax) * u0, ay + (by - ay) * u0];
              const q1: Pt = [ax + (bx - ax) * u1, ay + (by - ay) * u1];
              dd += `M${P(...q0, h)}L${P(...q1, h)}L${P(...q1, h + m)}L${P(...q0, h + m)}Z`;
            }
          }
          solid.parts.push({ d: dd, fill: right });
        }
        if (shape === 'tower') {
          const glow = own ?? neon;
          if (detail) solid.parts.push(lines(pts, floors(min, h), glow, own ? 0.75 : 0.45));
          solid.parts.push({ d: poly(pts), stroke: glow, width: 1, opacity: 0.85 });
          if (sign && own && detail) {
            // Szyld na najdłuższej widocznej ścianie: środkowe 50% krawędzi, od 55% do 85% wysokości.
            const [i, j] = visible(pts).reduce((u, v) => (edge(v) > edge(u) ? v : u), [0, 0, false]);
            if (i !== j) {
              const [ax, ay] = ring[i];
              const [bx, by] = ring[j];
              const at = (t: number): Pt => [ax + (bx - ax) * t, ay + (by - ay) * t];
              const [z0, z1] = [min + (h - min) * 0.55, min + (h - min) * 0.85];
              const d = `M${P(...at(0.25), z0)}L${P(...at(0.75), z0)}L${P(...at(0.75), z1)}L${P(...at(0.25), z1)}Z`;
              solid.parts.push({ d, fill: own, opacity: 0.9 }, { d, stroke: mix(own, '#ffffff', 0.6), width: 1 });
            }
          }
          if (detail && h >= tall && h - min >= ANTENNA_M) {
            const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
            const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
            solid.parts.push({ d: `M${P(cx, cy, h)}L${P(cx, cy, h + Math.max(8, (h - min) * 0.25))}`, stroke: glow, width: 1.2 });
          }
        }
      }
      return solid;
    };
    const out = buildings.map((bld) => {
      const hit = solidCache.get(bld);
      if (hit?.key === key) return hit.solid;
      const solid = build(bld);
      solidCache.set(bld, { key, solid });
      return solid;
    });
    return out.sort((u, v) => u.y - v.y).map((sol) => sol.parts.map(partSvg).join('')).join('');
  }, [buildings, a, b, c, d, e, f, pxPerM, color, fill, shape, accent]);

  // Jeden gotowy tekst zamiast tysięcy elementów Reacta: wejście w 3D z ~15 tys. ścian było przez to ok. 2x wolniejsze.
  return <g filter={filter} dangerouslySetInnerHTML={{ __html: markup }} />;
});

const p = (v: number) => v.toFixed(1);
