import { LINE_KEYS, MAP_KEYS, type MapLayers } from '../lib/vectorMap';
import { MAP_BACKGROUND, MAP_COLORS, MAP_WIDTHS } from './mapStyle';

// Tło "map": ciemny prostokąt i po jednej ścieżce na warstwę (wektor inline, więc eksport działa bez data URL).
export function MapBackground({ layers }: { layers: MapLayers }) {
  return (
    <>
      <rect width={1080} height={1920} fill={MAP_BACKGROUND} />
      {MAP_KEYS.map((key) => {
        const d = layers[key];
        if (!d) return null;
        return LINE_KEYS.has(key) ? (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={MAP_COLORS[key]}
            strokeWidth={MAP_WIDTHS[key]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path key={key} d={d} fill={MAP_COLORS[key]} />
        );
      })}
    </>
  );
}
