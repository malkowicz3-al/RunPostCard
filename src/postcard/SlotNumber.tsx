export type SlotProps = { x: number; y: number; size: number; label: string; value: string; scale?: number };

// Forma "liczba": wartość z etykietą pod spodem. Kolor tylko przez currentColor (motywy, ADR 0005).
// Font i grubość dziedziczone z <svg> pocztówki; scale = mnożnik rozmiaru wybranego fontu.
export function SlotNumber({ x, y, size, label, value, scale = 1 }: SlotProps) {
  return (
    <g>
      <text x={x} y={y} fontSize={size} textAnchor="middle" fill="currentColor">
        {value}
      </text>
      <text
        x={x}
        y={y + 60}
        fontSize={36 * scale}
        letterSpacing={4 * scale}
        textAnchor="middle"
        fill="currentColor"
        opacity={0.8}
      >
        {label}
      </text>
    </g>
  );
}
