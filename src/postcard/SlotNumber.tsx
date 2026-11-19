// Styl tekstu danych (wybór w panelu): pogrubienie i kontur obrysem, bo pliki fontów mają jedną grubość.
export type TextStyle = { bold?: boolean; italic?: boolean; outline?: boolean; shadow?: boolean };

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
  part?: 'value' | 'label'; // tylko jedna część (warstwy „Behind”, ADR 0009); bez = obie
  look?: TextStyle;
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
  part,
  look,
}: SlotProps) {
  const stroke = look?.outline ? size * 0.025 : look?.bold ? size * 0.035 : 0;
  return (
    <g>
      {part !== 'label' && (
        <text
          x={x}
          y={y}
          fontSize={size}
          textAnchor={anchor}
          fill={look?.outline ? 'none' : 'currentColor'}
          {...(stroke && { stroke: 'currentColor', strokeWidth: stroke, strokeLinejoin: 'round' as const })}
        >
          {value}
        </text>
      )}
      {part !== 'value' && labelPos !== 'none' && (
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
