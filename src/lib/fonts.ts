// Font pocztówki wstrzykujemy do SVG jako data URL, bo <img> z SVG nie ładuje zewnętrznych zasobów.
// Gdy pliku brak, zwracamy undefined i zostaje fallback system-ui.
const FONT_URL = '/fonts/BarlowCondensed-Bold.woff2';

let cached: Promise<string | undefined> | undefined;

export function loadFontCss(): Promise<string | undefined> {
  cached ??= fetch(FONT_URL)
    .then(async (res) => {
      // Bez public/fonts serwer SPA zwraca index.html ze statusem 200 — to nie jest font.
      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) return undefined;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
      return `@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(data:font/woff2;base64,${base64}) format('woff2');}`;
    })
    .catch(() => undefined);
  return cached;
}
