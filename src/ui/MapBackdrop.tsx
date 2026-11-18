import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GeoProjection } from 'd3-geo';
import { backdropViewBox, nextBackdropArea, type LoadedArea } from '../lib/backdrop';
import { cameraTransform, type Camera } from '../lib/camera';
import type { IsoRoute as Iso } from '../lib/isoRoute';
import type { Rect, Region } from '../lib/mapTiles';
import { loadAreaLayers, type MapProfile } from '../lib/vectorMap';
import { IsoRoute } from '../postcard/IsoRoute';
import { MapBackground } from '../postcard/MapBackground';
import { Route } from '../postcard/Route';
import { THEMES, type ThemeId } from '../postcard/themes';
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
  iso,
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
  const { refined } = useRegionLayers(projection, region, profile, true, loadArea);

  const { style, routeStyle } = useMemo(() => {
    const { filters: _f, fill: _fill, fills: _fills, ...style } = THEMES[theme].style({ accent });
    return { style, routeStyle: THEMES[theme].render({}, { accent }).route };
  }, [theme, accent]);

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
        {iso ? (
          <>
            <g transform={`matrix(${iso.matrix.join(' ')})`}>
              {refined && <MapBackground layers={refined.layers} style={style} rect={refined.rect} />}
            </g>
            <IsoRoute iso={iso} flat={routeStyle.stroke} dash={routeStyle.dash} zoom={camera.zoom} gradientId="backdrop-curtain-grad" />
          </>
        ) : (
          <>
            {refined && <MapBackground layers={refined.layers} style={style} rect={refined.rect} />}
            <Route d={route} stroke={routeStyle.stroke} width={routeStyle.width} dash={routeStyle.dash} zoom={camera.zoom} />
          </>
        )}
      </g>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="#000000" opacity={0.5} />
    </svg>
  );
}
