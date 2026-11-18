import type { GeoProjection } from 'd3-geo';
import { cartoKey, mapTiles, tileUrl } from '../lib/mapTiles';

// Kafelki pocztówki: ciemna mapa pod białą treścią, płótno 1080x1920, kafelek ok. 512 jednostek.
export function postcardTileUrls(projection: GeoProjection): string[] {
  return mapTiles(projection, [1080, 1920], 1).map((t) => tileUrl('dark_all', t, cartoKey));
}

// images: URL kafelka -> data URL (eksport SVG -> PNG nie pobiera zewnętrznych obrazów).
export function MapBackground({
  projection,
  images,
}: {
  projection: GeoProjection;
  images: Record<string, string>;
}) {
  return (
    <>
      {mapTiles(projection, [1080, 1920], 1).map((t) => (
        <image
          key={`${t.left},${t.top}`}
          href={images[tileUrl('dark_all', t, cartoKey)]}
          x={t.left}
          y={t.top}
          // +1 zakładki: antyaliasing styku sąsiednich kafelków przy skalowaniu daje widoczną jasną linię.
          width={t.width + 1}
          height={t.height + 1}
          preserveAspectRatio="none"
        />
      ))}
    </>
  );
}
