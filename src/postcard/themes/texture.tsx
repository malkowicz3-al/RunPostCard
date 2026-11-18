import { hexToRgb } from '../../lib/color';

// Faktury motywów stylizowanych (do <defs>). Obszar filtra = całe płótno, jak Glow w neon.tsx (działa też w podłodze 3D).
// sRGB: inaczej (linearRGB) heks w feColorMatrix wychodzi jaśniejszy niż podany.
// Obszar z zapasem poza płótnem: po przesunięciu kamery (i na podłodze 3D) mapa wychodzi poza 0..1080×1920,
// a filtr ucina wszystko poza swoim obszarem. Przeglądarka i tak liczy filtr tylko w widocznej części.
export const FILTER_AREA = { filterUnits: 'userSpaceOnUse', x: -3240, y: -3840, width: 7560, height: 9600 } as const;
const CANVAS = { ...FILTER_AREA, colorInterpolationFilters: 'sRGB' } as const;

// Ziarno: szum w kolorze color, krycie = slope·szum + offset (duży slope = progowanie, kropki druku).
export function Grain({ id, color, frequency, slope, offset }: { id: string; color: string; frequency: number; slope: number; offset: number }) {
  const [r, g, b] = hexToRgb(color).map((c) => (c / 255).toFixed(3));
  return (
    // Ziarno leży tylko w nakładce w przestrzeni płótna, a feTurbulence wypełnia cały obszar filtra: bez zapasu.
    <filter id={id} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x={0} y={0} width={1080} height={1920}>
      <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={3} />
      <feColorMatrix type="matrix" values={`0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${slope} 0 0 0 ${offset}`} />
    </filter>
  );
}

// Jedna nakładka na całe płótno zamiast filtra na każdej warstwie (wydajność przy Details).
export const Overlay = ({ fill, filter }: { fill?: string; filter?: string }) => (
  <rect width={1080} height={1920} fill={fill} filter={filter} />
);

// Drżąca kreska; blur + opacity zmiękczają brzegi (plamy akwareli).
export function Wobble({
  id,
  scale,
  frequency = 0.03,
  seed = 1,
  blur,
  opacity,
}: {
  id: string;
  scale: number;
  frequency?: number;
  seed?: number;
  blur?: number;
  opacity?: number;
}) {
  return (
    <filter id={id} {...CANVAS}>
      <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} seed={seed} result="noise" />
      <feDisplacementMap in="SourceGraphic" in2="noise" scale={scale} xChannelSelector="R" yChannelSelector="G" />
      {!!blur && <feGaussianBlur stdDeviation={blur} />}
      {!!opacity && (
        <feComponentTransfer>
          <feFuncA type="linear" slope={opacity} />
        </feComponentTransfer>
      )}
    </filter>
  );
}

// Kreskowanie: tło background i linie co gap pod kątem angle.
export function Hatch({
  id,
  background,
  color,
  angle,
  gap = 8,
  width = 1.2,
  opacity = 0.5,
}: {
  id: string;
  background: string;
  color: string;
  angle: number;
  gap?: number;
  width?: number;
  opacity?: number;
}) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform={`rotate(${angle})`}>
      <rect width={gap} height={gap} fill={background} />
      <path d={`M0 ${gap / 2}H${gap}`} stroke={color} strokeWidth={width} opacity={opacity} />
    </pattern>
  );
}

// Winieta: ciemniejsze brzegi płótna.
export function Vignette({ id, color, opacity }: { id: string; color: string; opacity: number }) {
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={540} cy={960} r={1100}>
      <stop offset="0.55" stopColor={color} stopOpacity={0} />
      <stop offset="1" stopColor={color} stopOpacity={opacity} />
    </radialGradient>
  );
}

// Raster druku: kropka promienia r co gap na tle background (gęstość farby = rozmiar kropki).
export function Dots({ id, background, color, r, gap = 6 }: { id: string; background: string; color: string; r: number; gap?: number }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform="rotate(45)">
      <rect width={gap} height={gap} fill={background} />
      <circle cx={gap / 2} cy={gap / 2} r={r} fill={color} />
    </pattern>
  );
}

// Obrys pod kreską (np. czarny kontur trasy komiksowej): pogrubiony kształt w kolorze color pod oryginałem.
export function Outline({ id, color, radius }: { id: string; color: string; radius: number }) {
  return (
    <filter id={id} {...CANVAS}>
      <feMorphology in="SourceAlpha" operator="dilate" radius={radius} result="wide" />
      <feFlood floodColor={color} />
      <feComposite operator="in" in2="wide" result="outline" />
      <feMerge>
        <feMergeNode in="outline" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

// Podwójna linia (ściany labiryntu): zwężony środek kreski w kolorze color na oryginale.
// Filtr zamiast drugiej ścieżki, bo ostrzejszy fragment 3D rysuje samo MapBackground.
export function Inline({ id, color, radius }: { id: string; color: string; radius: number }) {
  return (
    <filter id={id} {...CANVAS}>
      <feMorphology in="SourceAlpha" operator="erode" radius={radius} result="core" />
      <feFlood floodColor={color} />
      <feComposite operator="in" in2="core" result="inner" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="inner" />
      </feMerge>
    </filter>
  );
}
