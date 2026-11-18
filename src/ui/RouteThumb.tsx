import { useMemo } from 'react';
import { fitRoute } from '../lib/routePath';
import { LINE_KEYS, MAP_KEYS, THUMB, type MapKey } from '../lib/vectorMap';
import { useMapLayers } from './useMapLayers';

// Miniatura w viewBox 100x100; margines 8, żeby zaokrąglone końce nie były ucinane.
const BOX: [[number, number], [number, number]] = [
  [8, 8],
  [92, 92],
];
const SIZE: [number, number] = [100, 100];

// Grubości linii mapy w jednostkach viewBox (ok. 3 piksele ekranu na jednostkę).
const WIDTHS: Partial<Record<MapKey, number>> = { waterway: 1, minor: 0.5, mid: 0.8, major: 1.2 };

export function RouteThumb({ polyline }: { polyline: string }) {
  const fit = useMemo(() => fitRoute(polyline, BOX), [polyline]);
  const { layers } = useMapLayers(fit?.projection ?? null, SIZE, THUMB, true);
  return (
    <svg className="route-thumb" viewBox="0 0 100 100" aria-hidden="true">
      {layers &&
        MAP_KEYS.map((key) => {
          const d = layers[key];
          if (!d) return null;
          const color = key === 'water' || key === 'waterway' ? 'var(--map-water)' : 'var(--map-road)';
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
      <path
        d={fit?.d ?? ''}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
