// Gradient + ziarno z filtra feTurbulence; tylko awaryjne tło (bez trasy albo bez mapy). Ciemny, bo tekst jest biały.
const STOPS = ['#1e1b4b', '#f97316'];

// Ten sam gradient w CSS (podgląd w oknie danych).
export const gradientCss = () => `linear-gradient(180deg, ${STOPS.join(', ')})`;

export function Background() {
  return (
    <>
      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="1">
          {STOPS.map((c, i) => (
            <stop key={i} offset={i / (STOPS.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
        <filter id="bg-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg-gradient)" />
      <rect width="1080" height="1920" filter="url(#bg-grain)" opacity="0.12" />
    </>
  );
}
