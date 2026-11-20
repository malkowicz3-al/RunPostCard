import type { Moment } from './moments';

// Czas lotu POV (ADR 0011): FLY_S przez całą trasę, przy momentach zwolnienie do MIN_SPEED, na końcu TAIL_S postoju.
export const FLY_S = 20;
export const HOLD_ZONE = 0.04; // ± ułamek dystansu wokół momentu: zwolnienie i napis
export const MIN_SPEED = 0.12;
export const TAIL_S = 1.5;
const STEPS = 2000;

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

// Względna prędkość w p (1 = bez momentów).
function speed(p: number, moments: Moment[]): number {
  let s = 1;
  for (const m of moments) s -= (1 - MIN_SPEED) * (1 - smoothstep(Math.abs(p - m.f) / HOLD_ZONE));
  return Math.max(MIN_SPEED, s);
}

// Postęp (ułamek dystansu) w każdej klatce: odwrotność T(p) = FLY_S · ∫ dp / s(p), plus postój na p = 1.
export function povFrameProgress(moments: Moment[], fps: number): number[] {
  const t = [0];
  for (let k = 1; k <= STEPS; k++) t.push(t[k - 1] + (FLY_S / STEPS) / speed((k - 0.5) / STEPS, moments));
  const total = t[STEPS];
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i / fps < total - 1e-6; i++) {
    const now = i / fps;
    while (k < STEPS - 1 && t[k + 1] < now) k++;
    out.push((k + (now - t[k]) / (t[k + 1] - t[k])) / STEPS);
  }
  out.push(1);
  for (let i = 0; i < Math.round(TAIL_S * fps); i++) out.push(1);
  return out;
}

// Napis momentu w p: widoczny w strefie ±HOLD_ZONE, wchodzi w pierwszej i znika w ostatniej ćwiartce.
export function bannerAlpha(p: number, moments: Moment[]): { m: Moment; alpha: number } | null {
  // p ≥ 1: końcowy postój bez tabliczki (moment blisko mety nie zostaje w połowie przezroczysty).
  const m = p < 1 ? moments.find((x) => Math.abs(p - x.f) < HOLD_ZONE) : undefined;
  if (!m) return null;
  const u = (p - m.f + HOLD_ZONE) / (2 * HOLD_ZONE);
  return { m, alpha: smoothstep(Math.min(u, 1 - u) / 0.25) };
}
