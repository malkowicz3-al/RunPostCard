import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GeoProjection } from 'd3-geo';
import { backdropViewBox, nextBackdropArea, type LoadedArea } from '../lib/backdrop';
import { cameraTransform, type Camera } from '../lib/camera';
import type { IsoRoute as Iso } from '../lib/isoRoute';
import type { Rect, Region } from '../lib/mapTiles';
import { loadAreaLayers, type MapProfile } from '../lib/vectorMap';
import { Buildings3D } from '../postcard/Buildings3D';
import { IsoRoute } from '../postcard/IsoRoute';
import { MapBackground } from '../postcard/MapBackground';
import { terrainImage, type TerrainImage } from '../postcard/Postcard';
import { Route } from '../postcard/Route';
import { THEMES, type ThemeId } from '../postcard/themes';
import { useRegionLayers } from './useRegionLayers';

// Stała referencja dla useRegionLayers; fragment tła to zawsze poziom pocztówki (k = 1), resztę wybiera loadAreaLayers.
const loadArea = (projection: GeoProjection, size: [number, number], profile: MapProfile, region: Region, signal?: AbortSignal) =>
  loadAreaLayers(projection, size, profile, region.rect, signal);

const MAX_BACKDROP_BUILDINGS = 3000;

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
  iso,
  terrain,
  points,
  color,
}: {
  frameRef: RefObject<HTMLElement | null>;
  projection: GeoProjection;
  route: string; // ścieżka trasy (fit.d)
  theme: ThemeId;
  accent?: string;
  profile: MapProfile;
  camera: Camera;
  settled: Camera; // kamera po zatrzymaniu: od niej zależy doczytany obszar
  iso?: Iso; // widok 3D: mapa jako podłoga z macierzą izometrii i trasa z przewyższeniem
  terrain?: TerrainImage; // ten sam obraz terenu co na pocztówce (3D: zamiast podłogi i brył)
  points?: [number, number][]; // punkty trasy (fit.points) do linii w odcinkach
  color?: (t: number) => string; // styl linii jak na pocztówce
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
  const { refined } = useRegionLayers(projection, region, profile, !(iso && terrain), loadArea);

  const { style, routeStyle } = useMemo(() => {
    const { filters: _f, fill: _fill, fills: _fills, ...style } = THEMES[theme].style({ accent });
    return { style, routeStyle: THEMES[theme].render({}, { accent }).route };
  }, [theme, accent]);

  // Tło ekranu obejmuje większy obszar niż pocztówka: mniejszy limit brył (obrysy są już od największych).
  const buildings = useMemo(() => (iso ? refined?.layers.buildings?.slice(0, MAX_BACKDROP_BUILDINGS) : undefined), [iso, refined]);
  const [x0, y0, x1, y1] = viewBox ?? [0, 0, 1080, 1920];
  return (
    <svg
      ref={svgRef}
      className="map-backdrop"
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
              {refined && (
                <MapBackground
                  layers={buildings ? { ...refined.layers, building: undefined } : refined.layers}
                  style={style}
                  rect={refined.rect}
                />
              )}
            </g>
            {buildings && (
              <Buildings3D
                buildings={buildings}
                matrix={iso.matrix}
                pxPerM={iso.pxPerM}
                color={style.colors.building}
                shape={style.buildings3d}
                accent={style.colors.mid}
              />
            )}
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
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="backdrop-dim" fill="#000000" opacity={0.5} />
    </svg>
  );
}
