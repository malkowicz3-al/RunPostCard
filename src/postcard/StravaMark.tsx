import poweredByWhite from '../assets/brand/strava/powered-by-strava-white.svg?raw';
import poweredByBlack from '../assets/brand/strava/powered-by-strava-black.svg?raw';
import poweredByOrange from '../assets/brand/strava/powered-by-strava-orange.svg?raw';

export type StravaMarkVariant = 'white' | 'black' | 'orange';

// Oficjalne znaki bez zmian (wytyczne Stravy); data URL, żeby eksport SVG -> PNG je zawierał.
const toHref = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const HREFS: Record<StravaMarkVariant, string> = {
  white: toHref(poweredByWhite),
  black: toHref(poweredByBlack),
  orange: toHref(poweredByOrange),
};
const HEIGHT = 40;
const WIDTH = (365 / 37) * HEIGHT; // proporcje viewBox plików 365x37

// (x, y) to lewy górny róg znaku.
export function StravaMark({ x, y, variant = 'white' }: { x: number; y: number; variant?: StravaMarkVariant }) {
  return <image href={HREFS[variant]} x={x} y={y} width={WIDTH} height={HEIGHT} />;
}
