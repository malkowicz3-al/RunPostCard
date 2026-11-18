import { hexToRgb } from '../../lib/color';

// Faktury motywów stylizowanych (do <defs>). Obszar filtra = całe płótno, jak Glow w neon.tsx (działa też w podłodze 3D).
// sRGB: inaczej (linearRGB) heks w feColorMatrix wychodzi jaśniejszy niż podany.
const CANVAS = { filterUnits: 'userSpaceOnUse', colorInterpolationFilters: 'sRGB', x: 0, y: 0, width: 1080, height: 1920 } as const;

// Ziarno: szum w kolorze color, krycie = slope·szum + offset (duży slope = progowanie, kropki druku).
export function Grain({ id, color, frequency, slope, offset }: { id: string; color: string; frequency: number; slope: number; offset: number }) {
  const [r, g, b] = hexToRgb(color).map((c) => (c / 255).toFixed(3));
  return (
    <filter id={id} {...CANVAS}>
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
