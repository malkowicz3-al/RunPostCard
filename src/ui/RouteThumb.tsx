import { cartoKey, MAP_ENABLED, mapTiles, tileUrl } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import { useColorScheme } from './useColorScheme';

// Miniatura w viewBox 100x100; margines 8, żeby zaokrąglone końce nie były ucinane.
const BOX: [[number, number], [number, number]] = [
  [8, 8],
  [92, 92],
];

// Miniatura ma ok. 3 piksele ekranu na jednostkę viewBox.
const PIXEL_RATIO = 3;

export function RouteThumb({ polyline }: { polyline: string }) {
  const style = useColorScheme() === 'light' ? 'light_all' : 'dark_all';
  const fit = fitRoute(polyline, BOX);
  return (
    <svg className="route-thumb" viewBox="0 0 100 100" aria-hidden="true">
      {fit &&
        MAP_ENABLED &&
        mapTiles(fit.projection, [100, 100], PIXEL_RATIO).map((t) => (
          <image
            key={`${t.left},${t.top}`}
            href={tileUrl(style, t, cartoKey)}
            x={t.left}
            y={t.top}
            width={t.width}
            height={t.height}
            preserveAspectRatio="none"
          />
        ))}
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
