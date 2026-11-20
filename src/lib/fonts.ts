import { fetchDataUrl } from './dataUrl';

export type FontId =
  | 'barlow'
  | 'bebas'
  | 'anton'
  | 'oswald'
  | 'teko'
  | 'archivo'
  | 'russo'
  | 'blackops'
  | 'saira'
  | 'grotesk'
  | 'orbitron'
  | 'audiowide'
  | 'chakra'
  | 'rubikmono'
  | 'bungee'
  | 'monoton'
  | 'righteous'
  | 'racing'
  | 'alfa'
  | 'bangers'
  | 'pressstart'
  | 'marker'
  | 'pacifico'
  | 'lobster'
  | 'kaushan'
  | 'pirata';
export const DEFAULT_FONT: FontId = 'barlow';

type Font = {
  label: string;
  file: string;
  family: string;
  weight: number;
  faceWeight?: string;
  scale: number;
  group: 'Sport' | 'Tech' | 'Retro' | 'Script';
};

// weight: grubość tekstu pocztówki; faceWeight: zakres w @font-face (font zmienny), domyślnie = weight.
// scale: mnożnik rozmiaru z szerokości glifów (pomiar w przeglądarce): czas „1:23:45” przy 100·scale mieści się
// w kolumnie 270 px, a dystans „100.0” przy 300·scale w ok. 960 px. Bardzo szerokie fonty dostają małą skalę.
// Fonty jednej grubości mają 400, żeby przeglądarka nie dorysowywała sztucznego pogrubienia.
// Kolejność = kolejność na liście (grupy ciągiem).
export const FONTS: Record<FontId, Font> = {
  barlow: { label: 'Barlow', file: 'BarlowCondensed-Bold.ttf', family: 'Barlow Condensed', weight: 700, scale: 1, group: 'Sport' },
  bebas: { label: 'Bebas', file: 'BebasNeue-Regular.ttf', family: 'Bebas Neue', weight: 400, scale: 1.1, group: 'Sport' },
  anton: { label: 'Anton', file: 'Anton-Regular.ttf', family: 'Anton', weight: 400, scale: 0.95, group: 'Sport' },
  oswald: {
    label: 'Oswald',
    file: 'Oswald-Variable.ttf',
    family: 'Oswald',
    weight: 700,
    faceWeight: '200 700',
    scale: 0.9,
    group: 'Sport',
  },
  teko: {
    label: 'Teko',
    file: 'Teko-Variable.ttf',
    family: 'Teko',
    weight: 600,
    faceWeight: '300 700',
    scale: 1.05,
    group: 'Sport',
  },
  archivo: { label: 'Archivo', file: 'ArchivoBlack-Regular.ttf', family: 'Archivo Black', weight: 400, scale: 0.65, group: 'Sport' },
  russo: { label: 'Russo One', file: 'RussoOne-Regular.ttf', family: 'Russo One', weight: 400, scale: 0.8, group: 'Sport' },
  blackops: { label: 'Black Ops', file: 'BlackOpsOne-Regular.ttf', family: 'Black Ops One', weight: 400, scale: 0.65, group: 'Sport' },
  saira: { label: 'Saira', file: 'SairaCondensed-Black.ttf', family: 'Saira Condensed', weight: 900, scale: 0.93, group: 'Sport' },
  grotesk: {
    label: 'Grotesk',
    file: 'SpaceGrotesk-Variable.ttf',
    family: 'Space Grotesk',
    weight: 700,
    faceWeight: '300 700',
    scale: 0.8,
    group: 'Tech',
  },
  orbitron: {
    label: 'Orbitron',
    file: 'Orbitron-Variable.ttf',
    family: 'Orbitron',
    weight: 800,
    faceWeight: '400 900',
    scale: 0.65,
    group: 'Tech',
  },
  audiowide: { label: 'Audiowide', file: 'Audiowide-Regular.ttf', family: 'Audiowide', weight: 400, scale: 0.7, group: 'Tech' },
  chakra: { label: 'Chakra', file: 'ChakraPetch-Bold.ttf', family: 'Chakra Petch', weight: 700, scale: 0.75, group: 'Tech' },
  rubikmono: { label: 'Rubik Mono', file: 'RubikMonoOne-Regular.ttf', family: 'Rubik Mono One', weight: 400, scale: 0.45, group: 'Tech' },
  bungee: { label: 'Bungee', file: 'Bungee-Regular.ttf', family: 'Bungee', weight: 400, scale: 0.65, group: 'Retro' },
  monoton: { label: 'Monoton', file: 'Monoton-Regular.ttf', family: 'Monoton', weight: 400, scale: 0.75, group: 'Retro' },
  righteous: { label: 'Righteous', file: 'Righteous-Regular.ttf', family: 'Righteous', weight: 400, scale: 0.8, group: 'Retro' },
  racing: { label: 'Racing Sans', file: 'RacingSansOne-Regular.ttf', family: 'Racing Sans One', weight: 400, scale: 0.8, group: 'Retro' },
  alfa: { label: 'Alfa Slab', file: 'AlfaSlabOne-Regular.ttf', family: 'Alfa Slab One', weight: 400, scale: 0.64, group: 'Retro' },
  bangers: { label: 'Bangers', file: 'Bangers-Regular.ttf', family: 'Bangers', weight: 400, scale: 0.98, group: 'Retro' },
  pressstart: { label: 'Press Start', file: 'PressStart2P-Regular.ttf', family: 'Press Start 2P', weight: 400, scale: 0.38, group: 'Retro' },
  marker: { label: 'Marker', file: 'PermanentMarker-Regular.ttf', family: 'Permanent Marker', weight: 400, scale: 0.82, group: 'Script' },
  pacifico: { label: 'Pacifico', file: 'Pacifico-Regular.ttf', family: 'Pacifico', weight: 400, scale: 0.85, group: 'Script' },
  lobster: { label: 'Lobster', file: 'Lobster-Regular.ttf', family: 'Lobster', weight: 400, scale: 0.95, group: 'Script' },
  kaushan: { label: 'Kaushan', file: 'KaushanScript-Regular.ttf', family: 'Kaushan Script', weight: 400, scale: 0.73, group: 'Script' },
  pirata: { label: 'Pirata One', file: 'PirataOne-Regular.ttf', family: 'Pirata One', weight: 400, scale: 0.85, group: 'Script' },
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
