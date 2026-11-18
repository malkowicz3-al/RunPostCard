import { LINE_KEYS, MAP_KEYS, type MapLayers } from '../lib/vectorMap';
import type { MapStyle } from './mapStyle';

// Tło "map": prostokąt tła i po jednej ścieżce na warstwę (wektor inline, więc eksport działa bez data URL).
export function MapBackground({ layers, style }: { layers: MapLayers; style: MapStyle }) {
  return (
    <>
      <rect width={1080} height={1920} fill={style.fill ?? style.background} />
      {MAP_KEYS.map((key) => {
        const d = layers[key];
        if (!d) return null;
        const filter = style.filters?.[key];
        return LINE_KEYS.has(key) ? (
          <path
            key={key}
            d={d}
            fill="none"
            stroke={style.colors[key]}
            strokeWidth={style.widths[key]}
            strokeDasharray={style.dashes?.[key]}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={filter}
          />
        ) : (
          <path key={key} d={d} fill={style.colors[key]} filter={filter} />
        );
      })}
    </>
  );
}
