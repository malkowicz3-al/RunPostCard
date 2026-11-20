import type { Rect } from '../lib/mapTiles';
import { LINE_KEYS, MAP_KEYS, type MapLayers } from '../lib/vectorMap';
import type { MapStyle } from './mapStyle';

// Tło "map": prostokąt tła i po jednej ścieżce na warstwę (wektor inline, więc eksport działa bez data URL).
export function MapBackground({
  layers,
  style,
  rect: [x0, y0, x1, y1] = [0, 0, 1080, 1920],
}: {
  layers: MapLayers;
  style: MapStyle;
  rect?: Rect;
}) {
  return (
    <>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={style.fill ?? style.background} />
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
        ) : style.outlines?.[key] ? (
          // paint-order: obrys pod wypełnieniem, więc szwy kafelków przecinających poligon nie dają kresek w środku.
          <path
            key={key}
            d={d}
            fill={style.fills?.[key] ?? style.colors[key]}
            stroke={style.outlines[key]}
            strokeWidth={style.widths[key]}
            paintOrder="stroke"
            strokeLinejoin="round"
            filter={filter}
          />
        ) : (
          <path key={key} d={d} fill={style.fills?.[key] ?? style.colors[key]} filter={filter} />
        );
      })}
    </>
  );
}
