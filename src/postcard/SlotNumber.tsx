export type SlotProps = { x: number; y: number; size: number; label: string; value: string };

// Forma "liczba": wartość z etykietą pod spodem. Kolor tylko przez currentColor (motywy, ADR 0005).
export function SlotNumber({ x, y, size, label, value }: SlotProps) {
  return (
    <g>
      <text
        x={x}
        y={y}
        fontSize={size}
        fontWeight={700}
        fontFamily="'Barlow Condensed', system-ui, sans-serif"
        textAnchor="middle"
        fill="currentColor"
      >
        {value}
      </text>
      <text
        x={x}
        y={y + 60}
        fontSize={36}
        fontWeight={600}
        fontFamily="'Barlow Condensed', system-ui, sans-serif"
        letterSpacing={4}
        textAnchor="middle"
        fill="currentColor"
        opacity={0.8}
      >
        {label}
      </text>
    </g>
  );
}
