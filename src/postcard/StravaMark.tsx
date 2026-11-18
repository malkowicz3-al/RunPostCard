import poweredByWhite from '../assets/brand/strava/powered-by-strava-white.svg?raw';

// Oficjalny znak bez zmian (wytyczne Stravy); data URL, żeby eksport SVG -> PNG go zawierał.
const HREF = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(poweredByWhite)}`;
const HEIGHT = 40;
const WIDTH = (365 / 37) * HEIGHT; // proporcje viewBox pliku 365x37

// (x, y) to lewy górny róg znaku.
export function StravaMark({ x, y }: { x: number; y: number }) {
  return <image href={HREF} x={x} y={y} width={WIDTH} height={HEIGHT} />;
}
