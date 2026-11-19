import { useMemo } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { DEFAULT_CAMERA, cameraTransform, type Camera } from '../lib/camera';
import { isoRoute, type IsoRoute as IsoData } from '../lib/isoRoute';
import type { Rect } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import { TERRAIN_ATTRIBUTION } from '../lib/dem';
import { DEFAULT_FONT, FONTS, fontStack, type FontId } from '../lib/fonts';
import { MAP_ATTRIBUTION, type Building, type MapLayers } from '../lib/vectorMap';
import { Buildings3D } from './Buildings3D';
import { Background } from './Background';
import { MapBackground } from './MapBackground';
import { IsoRoute } from './IsoRoute';
import { PhotoBackground } from './PhotoBackground';
import { Route, ROUTE_BOX } from './Route';
import { StravaMark } from './StravaMark';
import { SlotNumber } from './SlotNumber';
import { DATA, chartFor, defaultLayout, fitted, type LayoutItem } from './slots';
import { THEMES, type ThemeId } from './themes';

// Obraz terenu (data URL) i jego prostokąt: płasko w jednostkach płótna mapy, w 3D w jednostkach pocztówki przed kamerą.
export type TerrainImage = { href: string; rect: Rect };

export const terrainImage = ({ href, rect: [x0, y0, x1, y1] }: TerrainImage) => (
  <image href={href} x={x0} y={y0} width={x1 - x0} height={y1 - y0} preserveAspectRatio="none" />
);

export type PostcardBackground = 'gradient' | 'transparent' | 'map' | 'photo';
// Podpis mapy pionowo przy prawej krawędzi: początek linii bazowej, tekst biegnie w górę.
const ATTRIBUTION_AT: [number, number] = [1056, 1890];

export function Postcard({
  activity,
  fontCss,
  font = DEFAULT_FONT,
  background = 'gradient',
  map,
  photo,
  theme = 'dark',
  accent,
  streams,
  view = 'flat',
  camera = DEFAULT_CAMERA,
  iso: givenIso,
  refined,
  terrain,
  layout = defaultLayout,
  route = true,
}: {
  activity: Activity;
  fontCss?: string;
  font?: FontId;
  background?: PostcardBackground;
  map?: MapLayers;
  photo?: { href: string; dim: number };
  theme?: ThemeId;
  accent?: string;
  streams?: RunStreams | null;
  view?: 'flat' | '3d';
  camera?: Camera;
  iso?: IsoData | null; // policzone wyżej (ekran i tak go potrzebuje), inaczej liczone tutaj
  refined?: { rect: Rect; layers: MapLayers }; // ostrzejsza mapa przybliżonego fragmentu (płasko lub podłoga 3D)
  terrain?: TerrainImage; // tylko z tłem map: 3D relief zamiast podłogi i brył, płasko cieniowanie nad mapą
  layout?: LayoutItem[];
  route?: boolean; // false: tylko tło i statystyki (np. na własnym zdjęciu)
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const polyline = activity.map.summary_polyline;
  const fit = useMemo(() => fitRoute(polyline, ROUTE_BOX), [polyline]);
  const iso = useMemo(
    () => (view === '3d' && streams && fit ? (givenIso ?? isoRoute(streams, ROUTE_BOX, fit.projection)) : null),
    [view, streams, fit, givenIso],
  );
  const showMap = background === 'map' && fit && map;
  // W 3D z bryłami podłoga bez płaskich budynków.
  const floor = (l: MapLayers): MapLayers => (iso && l.buildings ? { ...l, building: undefined } : l);
  const out = showMap ? THEMES[theme].render(floor(map), { accent }) : null;
  const style = useMemo(() => THEMES[theme].style({ accent }), [theme, accent]);
  const relief = out ? terrain : undefined;
  // Bryły ze środkiem w ostrzejszym fragmencie biorą obrysy z niego, pozostałe z mapy bazowej.
  const buildings = useMemo((): Building[] | null => {
    if (!iso || !(map?.buildings || refined?.layers.buildings)) return null;
    const base = map?.buildings ?? [];
    if (!refined) return base;
    const [x0, y0, x1, y1] = refined.rect;
    const inside = ({ ring }: Building) => {
      const x = ring.reduce((sum, [px]) => sum + px, 0) / ring.length;
      const y = ring.reduce((sum, [, py]) => sum + py, 0) / ring.length;
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    };
    return [...base.filter((b) => !inside(b)), ...(refined.layers.buildings ?? []).filter(inside)];
  }, [iso, map, refined]);
  const text = out?.text ?? { color: '#ffffff' };
  const { weight, scale } = FONTS[font];
  // Własne tło warstwy zakrywa mapę podstawową w prostokącie; defs motywu (filtry, wzory) są już w scene.
  const refinedMap = out && refined && (
    <>
      <defs>
        <clipPath id="refined-clip">
          <rect
            x={refined.rect[0]}
            y={refined.rect[1]}
            width={refined.rect[2] - refined.rect[0]}
            height={refined.rect[3] - refined.rect[1]}
          />
        </clipPath>
      </defs>
      <g clipPath="url(#refined-clip)">
        <MapBackground layers={floor(refined.layers)} style={style} rect={refined.rect} />
      </g>
    </>
  );

  return (
    <svg
      className="postcard"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1080 1920"
      fontFamily={fontStack(font)}
      fontWeight={weight}
    >
      {fontCss && <style>{fontCss}</style>}
      {background === 'photo' && photo && <PhotoBackground {...photo} />}
      {background === 'gradient' && <Background />}
      {iso ? (
        <g>
          {out && <rect width={1080} height={1920} fill={style.background} />}
          <g transform={cameraTransform(camera)}>
            {relief && terrainImage(relief)}
            {out && !relief && (
              // Podłoga 3D: ta sama mapa co w widoku płaskim, przekształcona macierzą izometrii; poza płótnem dochodzi fragment refined.
              <g transform={`matrix(${iso.matrix.join(' ')})`}>
                {out.scene}
                {refinedMap}
              </g>
            )}
            {out && !relief && buildings && (
              <Buildings3D
                buildings={buildings}
                matrix={iso.matrix}
                pxPerM={iso.pxPerM}
                color={style.colors.building}
                fill={style.fills?.building}
                filter={style.filters?.building}
              />
            )}
          </g>
          {/* Faktura papieru w przestrzeni płótna (jak w widoku płaskim), nie na pochylonej i powiększanej podłodze. */}
          {out?.overlay}
          {route && (<g transform={cameraTransform(camera)}>
            <IsoRoute
              iso={iso}
              flat={out?.route.stroke}
              filter={out?.route.filter}
              dash={out?.route.dash}
              zoom={camera.zoom}
              onSurface={!!relief}
            />
          </g>)}
        </g>
      ) : (
        <g>
          {/* Przesunięta kamera odsłania obszar poza płótnem, zanim dojdą kafelki: tło motywu zamiast pustki. */}
          {out && <rect width={1080} height={1920} fill={style.background} />}
          <g transform={cameraTransform(camera)}>
            {out?.scene}
            {refinedMap}
            {relief && terrainImage(relief)}
          </g>
          {out?.overlay}
          {fit && route && (
            <g transform={cameraTransform(camera)}>
              <Route {...out?.route} d={fit.d} zoom={camera.zoom} />
            </g>
          )}
        </g>
      )}
      <g color={text.color} filter={text.filter}>
        {layout.map((item) => {
          const value = DATA[item.slot.data].value(activity);
          const chart = chartFor(item, streams);
          // chartFor sprawdza box i streams.
          if (chart) {
            return (
              <chart.Component
                key={item.slot.id}
                box={item.box!}
                streams={streams!}
                activity={activity}
                label={chart.label}
                value={value}
                scale={scale}
              />
            );
          }
          const { size, labelSize, label } = fitted(item, value, scale);
          return (
            <SlotNumber
              key={item.slot.id}
              x={item.x}
              y={item.y}
              size={size}
              scale={scale}
              anchor={item.anchor}
              labelPos={item.labelPos}
              labelSize={labelSize}
              label={label}
              value={value}
            />
          );
        })}
      </g>
      <StravaMark x={60} y={1820} variant={out?.mark} />
      {out && (
        <text
          transform={`translate(${ATTRIBUTION_AT.join(' ')}) rotate(-90)`}
          fontSize={18}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          fill={text.color}
          opacity={0.6}
        >
          {relief ? `${MAP_ATTRIBUTION} · ${TERRAIN_ATTRIBUTION}` : MAP_ATTRIBUTION}
        </text>
      )}
    </svg>
  );
}
