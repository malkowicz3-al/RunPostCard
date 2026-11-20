import type { Building } from '../lib/vectorMap';

// Bryły świata w widoku płaskim: jedna ścieżka na kolor gatunku (bez koloru: fallback), zamiast warstwy building.
export function outlines(buildings: Building[] = [], fallback: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const { ring, accent = fallback } of buildings)
    out.set(accent, (out.get(accent) ?? '') + `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`);
  return out;
}
