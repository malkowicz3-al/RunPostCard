export type SlotProps = { x: number; y: number; size: number; label: string; value: string };

// Forma "liczba": wartość z etykietą pod spodem.
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
        fill="#ffffff"
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
        fill="#ffffff"
        opacity={0.8}
      >
        {label}
      </text>
    </g>
  );
}
