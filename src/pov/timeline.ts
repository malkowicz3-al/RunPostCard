import type { Moment } from './moments';

// Czas lotu POV (ADR 0011): flyS(dystans) przez całą trasę, przy każdym postoju dodatkowe HOLD_S w strefie ±ZONE_M, na końcu TAIL_S postoju.
export const ZONE_M = 150; // ± metrów wokół postoju: zwolnienie i napis
export const SPLIT_HOLD_S = 2;
export const KEY_HOLD_S = 2.5;
export const TAIL_S = 1.5;
export const MAX_HOLDS_S = 25; // suma postojów; przy wielu międzyczasach każdy krótszy, film nie rośnie bez końca
const BUMP = 315 / 256; // 1 / ∫(1 - x²)⁴ dx na [-1, 1]

// Lot bez postojów: 20 s + 3 s na km, w granicach 30–70 s.
export const flyS = (totalM: number) => Math.min(70, Math.max(30, 20 + (3 * totalM) / 1000));

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// Pół-szerokość strefy każdego postoju (ułamek dystansu): ZONE_M, ale bez nachodzenia na sąsiadów i poza trasę.
export function zones(moments: Moment[], totalM: number): number[] {
  const z = ZONE_M / Math.max(1, totalM);
  return moments.map((m, i) =>
    Math.min(z, m.f, 1 - m.f, i > 0 ? (m.f - moments[i - 1].f) / 2 : 1, i < moments.length - 1 ? (moments[i + 1].f - m.f) / 2 : 1),
  );
}

// Postęp (ułamek dystansu) w każdej klatce: odwrotność T(p) = ∫ (flyS + Σ hold · garb(p)) dp, plus postój na p = 1.
// Garb (1 - x²)⁴ ma pochodne zero na brzegach strefy (bez szarpnięcia), a ok. 90% czasu postoju w środkowej połowie (pełny napis).
export function povFrameProgress(moments: Moment[], fps: number, totalM: number): number[] {
  const fly = flyS(totalM);
  const zs = zones(moments, totalM);
  const steps = Math.max(2000, Math.ceil(totalM / 5));
  const hold = (m: Moment) => (m.kind === 'split' ? SPLIT_HOLD_S : KEY_HOLD_S);
  const scale = Math.min(1, MAX_HOLDS_S / Math.max(1e-9, moments.reduce((s, m) => s + hold(m), 0)));
  const rate = (p: number) => {
    let r = fly;
    moments.forEach((m, i) => {
      const x = (p - m.f) / zs[i];
      if (Math.abs(x) < 1) r += (hold(m) * scale * BUMP * (1 - x * x) ** 4) / zs[i];
    });
    return r;
  };
  const t = [0];
  for (let k = 1; k <= steps; k++) t.push(t[k - 1] + rate((k - 0.5) / steps) / steps);
  const total = t[steps];
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i / fps < total - 1e-6; i++) {
    const now = i / fps;
    while (k < steps - 1 && t[k + 1] < now) k++;
    out.push((k + (now - t[k]) / (t[k + 1] - t[k])) / steps);
  }
  out.push(1);
  for (let i = 0; i < Math.round(TAIL_S * fps); i++) out.push(1);
  return out;
}

// Napis postoju w p: widoczny w jego strefie, wchodzi w pierwszej i znika w ostatniej ćwiartce.
export function bannerAlpha(p: number, moments: Moment[], totalM: number): { m: Moment; alpha: number } | null {
  // p ≥ 1: końcowy postój bez tabliczki (moment blisko mety nie zostaje w połowie przezroczysty).
  if (p >= 1) return null;
  const zs = zones(moments, totalM);
  const i = moments.findIndex((x, k) => Math.abs(p - x.f) < zs[k]);
  if (i < 0) return null;
  const u = (p - moments[i].f + zs[i]) / (2 * zs[i]);
  return { m: moments[i], alpha: smoothstep(Math.min(u, 1 - u) / 0.25) };
}
