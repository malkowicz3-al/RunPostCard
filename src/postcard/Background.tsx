// Gradient + ziarno z filtra feTurbulence; jeden preset na stałe (presety w etapie 2).
export function Background() {
  return (
    <>
      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#f97316" />
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
