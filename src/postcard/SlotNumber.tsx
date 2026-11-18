export type SlotAnchor = 'start' | 'middle' | 'end';
export type LabelPos = 'below' | 'above' | 'none';

export type SlotProps = {
  x: number;
  y: number;
  size: number;
  label: string;
  value: string;
  scale?: number;
  anchor?: SlotAnchor;
  labelPos?: LabelPos;
  labelSize?: number; // przed mnożnikiem fontu
};

// Linia bazowa etykiety nad wartością (size = rozmiar wartości po skali).
export const labelAboveY = (y: number, size: number) => y - 0.75 * size - 14;

// Forma "liczba": wartość z etykietą. Kolor tylko przez currentColor (motywy, ADR 0005).
// Font i grubość dziedziczone z <svg> pocztówki; scale = mnożnik rozmiaru wybranego fontu.
export function SlotNumber({
  x,
  y,
  size,
  label,
  value,
  scale = 1,
  anchor = 'middle',
  labelPos = 'below',
  labelSize = 36,
}: SlotProps) {
  return (
    <g>
      <text x={x} y={y} fontSize={size} textAnchor={anchor} fill="currentColor">
        {value}
      </text>
      {labelPos !== 'none' && (
        <text
          x={x}
          y={labelPos === 'below' ? y + 60 : labelAboveY(y, size)}
          fontSize={labelSize * scale}
          letterSpacing={(labelSize / 9) * scale}
          textAnchor={anchor}
          fill="currentColor"
          opacity={0.8}
        >
          {label}
        </text>
      )}
    </g>
  );
}
