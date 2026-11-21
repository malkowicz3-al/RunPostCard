import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GeoProjection } from 'd3-geo';
import { backdropViewBox, nextBackdropArea, type LoadedArea } from '../lib/backdrop';
import { cameraDelta, cameraTransform, type Camera } from '../lib/camera';
import type { IsoRoute as Iso } from '../lib/isoRoute';
import type { Rect, Region } from '../lib/mapTiles';
import { loadAreaLayers, type MapProfile } from '../lib/vectorMap';
import { IsoRoute } from '../postcard/IsoRoute';
import { MapBackground } from '../postcard/MapBackground';
import { terrainImage, type TerrainImage } from '../postcard/Postcard';
import { Route } from '../postcard/Route';
import { THEMES, type MapTheme, type ThemeId } from '../postcard/themes';
import { decorateWorld } from '../world/decorate';
import type { GenreId } from '../world/genres';
import { useRegionLayers } from './useRegionLayers';

// Stała referencja dla useRegionLayers; fragment tła to zawsze poziom pocztówki (k = 1), resztę wybiera loadAreaLayers.
const loadArea = (projection: GeoProjection, size: [number, number], profile: MapProfile, region: Region, signal?: AbortSignal) =>
  loadAreaLayers(projection, size, profile, region.rect, signal);

// Mapa na cały ekran pod pocztówką (ADR 0007): te same jednostki, projekcja i kamera; bez filtrów motywu, przyciemniona.
export function MapBackdrop({
  frameRef,
  projection,
  route,
  theme,
  accent,
  profile,
  camera,
  settled,
  moving,
  iso,
  terrain,
  points,
  color,
  world,
}: {
  frameRef: RefObject<HTMLElement | null>;
  projection: GeoProjection;
  route: string; // ścieżka trasy (fit.d)
  theme: ThemeId | MapTheme;
  accent?: string;
  profile: MapProfile;
  camera: Camera;
  settled: Camera; // kamera po zatrzymaniu: od niej zależy doczytany obszar
  moving: boolean; // kamera w ruchu (także sam obrót w 3D, którego camera nie zawiera)
  iso?: Iso; // widok 3D: mapa jako podłoga z macierzą izometrii i trasa z przewyższeniem
  terrain?: TerrainImage; // ten sam obraz terenu co na pocztówce (3D: zamiast podłogi i brył)
  points?: [number, number][]; // punkty trasy (fit.points) do linii w odcinkach
  color?: (t: number) => string; // styl linii jak na pocztówce
  world?: { seed: number; genre: GenreId; variant?: string }; // tło World: kafelki z dekoracją gatunku (ADR 0013), bez pojazdów
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<Rect | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const frame = frameRef.current;
    if (!svg || !frame) return;
    // Ta sama wartość zostawia stary obiekt, inaczej każde przewinięcie doczytywałoby obszar od nowa.
    const measure = () => {
      const next = backdropViewBox(svg.getBoundingClientRect(), frame.getBoundingClientRect());
      setViewBox((prev) => (prev && prev.every((v, i) => Math.abs(v - next[i]) < 0.5) ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    observer.observe(frame);
    // ResizeObserver nie widzi przesunięcia ramki bez zmiany rozmiaru (np. zmiana treści nad nią).
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [frameRef]);

  // Przewinięcie albo małe przesunięcie w doczytanym obszarze nie zmienia zapytania.
  const area = useRef<LoadedArea | null>(null);
  const region = useMemo((): Region | null => {
    if (!viewBox) return null;
    area.current = nextBackdropArea(area.current, viewBox, settled, iso?.matrix);
    return area.current;
  }, [viewBox, settled, iso]);
  // 3D z terenem: podłogi wektorowej nie ma, więc nie pobieramy jej.
  const { refined: tiles } = useRegionLayers(projection, region, profile, !(iso && terrain), loadArea);
  const refined = useMemo(
    () => (world && points && tiles ? { rect: tiles.rect, layers: decorateWorld(tiles.layers, points, world.seed, world.genre, world.variant) } : tiles),
    [tiles, world?.seed, world?.genre, world?.variant, points],
  );

  const { style, routeStyle } = useMemo(() => {
    const def = typeof theme === 'string' ? THEMES[theme] : theme;
    const { filters: _f, fill: _fill, fills: _fills, ...style } = def.style({ accent });
    return { style, routeStyle: def.render({}, { accent }).route };
  }, [theme, accent]);

  // W trakcie ruchu kamery zamiast tysięcy ścieżek przekształca się obraz tła zrobiony, gdy kamera stała (jak podgląd
  // pocztówki, useBaseSnapshot). Obraz pasuje tylko do tej samej treści (w 3D obrót zmienia iso, wtedy zwykłe SVG).
  const content = [refined, style, routeStyle, iso, terrain, color, route, points, viewBox];
  const [snap, setSnap] = useState<{ href: string; camera: Camera; content: unknown[]; width: number } | null>(null);
  const snapUrl = useRef<string | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (moving || !svg || !viewBox) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const { width, height } = svg.getBoundingClientRect();
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.src = url;
      img.decode().then(
        () => {
          if (cancelled) return URL.revokeObjectURL(url);
          if (snapUrl.current) URL.revokeObjectURL(snapUrl.current);
          snapUrl.current = url;
          setSnap({ href: url, camera, content, width });
        },
        () => URL.revokeObjectURL(url),
      );
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [moving, camera, ...content]);
  useEffect(() => () => void (snapUrl.current && URL.revokeObjectURL(snapUrl.current)), []);
  const valid = snap && snap.content.every((c, i) => c === content[i]) ? snap : null;
  const useSnap = moving ? valid : null;

  const [x0, y0, x1, y1] = viewBox ?? [0, 0, 1080, 1920];
  // Macierz w jednostkach SVG -> piksele ekranu: viewBox ma proporcje okna (slice bez przesunięcia), skala s.
  const snapTransform = () => {
    const [a, b, c, d, e, f] = cameraDelta(valid!.camera, camera);
    const s = valid!.width / (x1 - x0);
    const tx = s * (a * x0 + c * y0 + e - x0);
    const ty = s * (b * x0 + d * y0 + f - y0);
    return `translate(${tx}px, ${ty}px) matrix(${a}, ${b}, ${c}, ${d}, 0, 0)`;
  };
  return (
    <>
    {/* Zamontowany, gdy pasuje (ukryty przy stojącej kamerze), żeby na początku ruchu był już namalowany. */}
    {valid && (
      <img
        className="map-backdrop map-backdrop-snap"
        src={valid.href}
        alt=""
        style={{ transform: snapTransform(), visibility: useSnap ? undefined : 'hidden' }}
      />
    )}
    <svg
      ref={svgRef}
      className="map-backdrop"
      style={useSnap ? { visibility: 'hidden' } : undefined}
      aria-hidden="true"
      viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`}
      preserveAspectRatio="xMinYMin slice"
    >
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={style.background} />
      <g transform={cameraTransform(camera)}>
        {iso && terrain ? (
          <>
            {terrainImage(terrain)}
            <IsoRoute iso={iso} flat={routeStyle.stroke} dash={routeStyle.dash} zoom={camera.zoom} onSurface color={color} />
          </>
        ) : iso ? (
          <>
            <g transform={`matrix(${iso.matrix.join(' ')})`}>
              {/* Tło to tylko podgląd: budynki płasko, bez brył (płynny obrót i przesuwanie). */}
              {refined && <MapBackground layers={refined.layers} style={style} rect={refined.rect} />}
            </g>
            <IsoRoute iso={iso} flat={routeStyle.stroke} dash={routeStyle.dash} zoom={camera.zoom} gradientId="backdrop-curtain-grad" color={color} />
          </>
        ) : (
          <>
            {refined && <MapBackground layers={refined.layers} style={style} rect={refined.rect} />}
            {terrain && terrainImage(terrain)}
            <Route d={route} stroke={routeStyle.stroke} width={routeStyle.width} dash={routeStyle.dash} zoom={camera.zoom} points={points} color={color} />
          </>
        )}
      </g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#000000" opacity={0.5} />
    </svg>
    </>
  );
}
