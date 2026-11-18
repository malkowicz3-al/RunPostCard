import { useMemo } from 'react';
import { fitRoute } from '../lib/routePath';
import { LINE_KEYS, MAP_KEYS, THUMB, type MapKey } from '../lib/vectorMap';
import type { MapStyle } from '../postcard/mapStyle';
import { useMapLayers } from './useMapLayers';

// Miniatura w viewBox 100x100; margines 8, żeby zaokrąglone końce nie były ucinane.
const BOX: [[number, number], [number, number]] = [
  [8, 8],
  [92, 92],
];
const SIZE: [number, number] = [100, 100];

// Grubości linii mapy w jednostkach viewBox (ok. 3 piksele ekranu na jednostkę).
const WIDTHS: Partial<Record<MapKey, number>> = { waterway: 1, minor: 0.5, mid: 0.8, major: 1.2 };

// style: brak = tokeny CSS --map-* (lista biegów), null = sama trasa, MapStyle = kolory motywu (bez filtrów).
export function RouteThumb({
  polyline,
  style,
  route = 'currentColor',
}: {
  polyline: string;
  style?: MapStyle | null;
  route?: string;
}) {
  const fit = useMemo(() => fitRoute(polyline, BOX), [polyline]);
  const { layers } = useMapLayers(fit?.projection ?? null, SIZE, THUMB, style !== null);
  return (
    <svg className="route-thumb" viewBox="0 0 100 100" aria-hidden="true">
      {style && <rect width={100} height={100} fill={style.background} />}
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
