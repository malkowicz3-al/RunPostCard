// Gradient + ziarno z filtra feTurbulence. Wszystkie dość ciemne, bo tekst na gradiencie jest biały.
export type GradientId = 'dusk' | 'deepsea' | 'berry' | 'moss' | 'ember' | 'aurora';

export const GRADIENTS: Record<GradientId, { label: string; stops: string[]; diagonal?: boolean }> = {
  dusk: { label: 'Dusk', stops: ['#1e1b4b', '#f97316'] },
  deepsea: { label: 'Deep sea', stops: ['#0f172a', '#0e7490', '#38bdf8'] },
  berry: { label: 'Berry', stops: ['#3b0764', '#be185d'], diagonal: true },
  moss: { label: 'Moss', stops: ['#052e16', '#3f6212', '#a3a635'] },
  ember: { label: 'Ember', stops: ['#1c0a00', '#9a1c0b', '#f59e0b'], diagonal: true },
  aurora: { label: 'Aurora', stops: ['#020617', '#0f766e', '#7c3aed'], diagonal: true },
};

export const GRADIENT_IDS = Object.keys(GRADIENTS) as GradientId[];

// Ten sam gradient w CSS (podgląd w panelu i w oknie danych).
export const gradientCss = (id: GradientId) =>
  `linear-gradient(${GRADIENTS[id].diagonal ? '170deg' : '180deg'}, ${GRADIENTS[id].stops.join(', ')})`;

export function Background({ gradient = 'dusk' }: { gradient?: GradientId }) {
  const { stops, diagonal } = GRADIENTS[gradient];
  return (
    <>
      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2={diagonal ? 0.35 : 0} y2="1">
          {stops.map((c, i) => (
            <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
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
