export type Pt = [number, number];

// Graf jest kratką, a miasto nie: gładkie wygięcie płaszczyzny (do ~180 m, nachylenie < 0,2, więc bez zawinięć).
// Tylko długie fale (okres ~7–8 km): dzielnice obrócone o różne kąty, ulice na pocztówce prawie proste, bez marszczenia.
// Mapa i trasy przechodzą przez nie przy wyjściu.
export const warp = ([x, y]: Pt): Pt => [x + 180 * Math.sin(y / 1300 + 0.4), y + 180 * Math.sin(x / 1100 + 1.3)];

// Odcinki dłuższe niż 40 m dzielimy, żeby po wygięciu były łukiem, a nie cięciwą.
export function densify(pts: Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 40);
    for (let s = 1; s <= n; s++) out.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]);
  }
  return out;
}
