// Kolory w formacie #rrggbb (taki zwraca <input type="color">).
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

// t = 0 -> a, t = 1 -> b.
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

// Obrót odcienia w HSL; nasycenie i jasność (więc też najjaśniejszy i najciemniejszy kanał) bez zmian.
export function shiftHue(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const c = max - min;
  if (!c) return hex;
  const h0 = max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  const h = (((h0 * 60 + deg) % 360) + 360) % 360;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60)];
  return rgbToHex(rgb.map((v) => v + min) as [number, number, number]);
}
