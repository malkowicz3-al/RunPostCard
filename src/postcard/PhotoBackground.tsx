// Zdjęcie już przycięte do 1080x1920 (loadPhoto), więc bez dopasowania; prostokąt przyciemnia dla czytelności.
export function PhotoBackground({ href, dim }: { href: string; dim: number }) {
  return (
    <g>
      <image href={href} x={0} y={0} width={1080} height={1920} preserveAspectRatio="none" />
      <rect width={1080} height={1920} fill="#000" opacity={dim} />
    </g>
  );
}
