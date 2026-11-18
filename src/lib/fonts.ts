import { fetchDataUrl } from './dataUrl';

// Font pocztówki wstrzykujemy do SVG jako data URL. Gdy pliku brak, zwracamy undefined i zostaje fallback system-ui.
const FONT_URL = '/fonts/BarlowCondensed-Bold.ttf';

export function loadFontCss(): Promise<string | undefined> {
  return fetchDataUrl(FONT_URL)
    .then(
      (url) =>
        `@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(${url}) format('truetype');}`,
    )
    .catch(() => undefined);
}
