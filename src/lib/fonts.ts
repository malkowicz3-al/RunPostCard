import { fetchDataUrl } from './dataUrl';

export type FontId = 'barlow' | 'bebas' | 'archivo' | 'grotesk' | 'marker' | 'bungee';
export const DEFAULT_FONT: FontId = 'barlow';

// weight: grubość tekstu pocztówki; faceWeight: zakres w @font-face (font zmienny), domyślnie = weight.
// scale: mnożnik rozmiaru dobrany z szerokości glifów, żeby czas „1:23:45” mieścił się w kolumnie 270 px jak w Barlow.
// Fonty jednej grubości mają 400, żeby przeglądarka nie dorysowywała sztucznego pogrubienia.
export const FONTS: Record<
  FontId,
  { label: string; file: string; family: string; weight: number; faceWeight?: string; scale: number }
> = {
  barlow: { label: 'Barlow', file: 'BarlowCondensed-Bold.ttf', family: 'Barlow Condensed', weight: 700, scale: 1 },
  bebas: { label: 'Bebas', file: 'BebasNeue-Regular.ttf', family: 'Bebas Neue', weight: 400, scale: 1.1 },
  archivo: { label: 'Archivo', file: 'ArchivoBlack-Regular.ttf', family: 'Archivo Black', weight: 400, scale: 0.65 },
  grotesk: {
    label: 'Grotesk',
    file: 'SpaceGrotesk-Variable.ttf',
    family: 'Space Grotesk',
    weight: 700,
    faceWeight: '300 700',
    scale: 0.8,
  },
  marker: { label: 'Marker', file: 'PermanentMarker-Regular.ttf', family: 'Permanent Marker', weight: 400, scale: 0.82 },
  bungee: { label: 'Bungee', file: 'Bungee-Regular.ttf', family: 'Bungee', weight: 400, scale: 0.65 },
};

export const fontStack = (id: FontId) => `'${FONTS[id].family}', system-ui, sans-serif`;

export function fontFaceRule(id: FontId, src: string): string {
  const { family, weight, faceWeight } = FONTS[id];
  return `@font-face{font-family:'${family}';font-weight:${faceWeight ?? weight};src:url(${src}) format('truetype');}`;
}

// Font pocztówki wstrzykujemy do SVG jako data URL. Gdy pliku brak, zwracamy undefined i zostaje fallback system-ui.
export function loadFontCss(id: FontId = DEFAULT_FONT): Promise<string | undefined> {
  return fetchDataUrl('/fonts/' + FONTS[id].file)
    .then((url) => fontFaceRule(id, url))
    .catch(() => undefined);
}
