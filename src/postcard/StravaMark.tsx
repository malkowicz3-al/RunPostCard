// TODO: podmienić na oficjalne zasoby ze Strava Brand Guidelines (na razie tekstowy placeholder).
export function StravaMark({ x, y }: { x: number; y: number }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={30}
      fontWeight={700}
      fontFamily="'Barlow Condensed', system-ui, sans-serif"
      letterSpacing={2}
      fill="#fc4c02"
    >
      POWERED BY STRAVA
    </text>
  );
}
