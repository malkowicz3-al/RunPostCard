import { useMemo } from 'react';
import { fitRoute } from '../lib/routePath';
import { LINE_KEYS, MAP_KEYS, THUMB, type MapKey } from '../lib/vectorMap';
import type { MapStyle } from '../postcard/mapStyle';
import { useMapLayers } from './useMapLayers';

// Miniatura w viewBox 100 x height (domyślnie kwadrat); margines 8, żeby zaokrąglone końce nie były ucinane.
const MARGIN = 8;

// Grubości linii mapy w jednostkach viewBox (ok. 3 piksele ekranu na jednostkę).
const WIDTHS: Partial<Record<MapKey, number>> = { waterway: 1, minor: 0.5, mid: 0.8, major: 1.2 };

// style: brak = tokeny CSS --map-* (lista biegów), null = sama trasa, MapStyle = kolory motywu (bez filtrów).
export function RouteThumb({
  polyline,
  style,
  route = 'currentColor',
  height = 100,
}: {
  polyline: string;
  style?: MapStyle | null;
  route?: string;
  height?: number; // np. 75 = kadr 4:3 (numery startowe na liście)
}) {
  const fit = useMemo(
    () =>
      fitRoute(polyline, [
        [MARGIN, MARGIN],
        [100 - MARGIN, height - MARGIN],
      ]),
    [polyline, height],
  );
  const size = useMemo((): [number, number] => [100, height], [height]);
  const { layers } = useMapLayers(fit?.projection ?? null, size, THUMB, style !== null);
  return (
    <svg className="route-thumb" viewBox={`0 0 100 ${height}`} style={{ aspectRatio: `100 / ${height}` }} aria-hidden="true">
      {style && <rect width={100} height={height} fill={style.background} />}
      {layers &&
        style !== null &&
        MAP_KEYS.map((key) => {
          const d = layers[key];
          if (!d) return null;
          const color = style
            ? style.colors[key]
            : key === 'water' || key === 'waterway'
              ? 'var(--map-water)'
              : 'var(--map-road)';
          return LINE_KEYS.has(key) ? (
            <path
              key={key}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={WIDTHS[key]}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path key={key} d={d} fill={color} />
          );
        })}
      {/* pathLength=1: animacja rysowania trasy w CSS (lista biegów) nie zależy od długości. */}
      <path
        className="route-line"
        pathLength={1}
        d={fit?.d ?? ''}
        fill="none"
        stroke={route}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
