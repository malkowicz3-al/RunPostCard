import { useMemo } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { isoRoute, type IsoRoute as IsoData } from '../lib/isoRoute';
import type { Rect } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import { DEFAULT_FONT, FONTS, fontStack, type FontId } from '../lib/fonts';
import { highlights as findHighlights } from '../lib/runHighlights';
import { MAP_ATTRIBUTION, type MapLayers } from '../lib/vectorMap';
import { Background } from './Background';
import { MapBackground } from './MapBackground';
import { IsoRoute } from './IsoRoute';
import { PhotoBackground } from './PhotoBackground';
import { Route, ROUTE_BOX } from './Route';
import { RouteMarkers } from './RouteMarkers';
import { StravaMark } from './StravaMark';
import { DATA, FORMS, defaultLayout } from './slots';
import { THEMES, type ThemeId } from './themes';

export type PostcardBackground = 'gradient' | 'transparent' | 'map' | 'photo';
// Kamera widoku 3D: przybliżenie wokół środka pola trasy i przesunięcie (jednostki SVG).
export type Camera = { zoom: number; x: number; y: number };
export const DEFAULT_CAMERA: Camera = { zoom: 1, x: 0, y: 0 };

const [[bx0, by0], [bx1, by1]] = ROUTE_BOX;
export const CAMERA_CENTER: [number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2];
const [CX, CY] = CAMERA_CENTER;

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
  highlights = false,
  camera = DEFAULT_CAMERA,
  iso: givenIso,
  refined,
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
  highlights?: boolean;
  camera?: Camera;
  iso?: IsoData | null; // policzone wyżej (ekran i tak go potrzebuje), inaczej liczone tutaj
  refined?: { rect: Rect; layers: MapLayers }; // ostrzejsza mapa przybliżonego fragmentu podłogi 3D
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const polyline = activity.map.summary_polyline;
  const fit = useMemo(() => fitRoute(polyline, ROUTE_BOX), [polyline]);
  const iso = useMemo(
    () => (view === '3d' && streams && fit ? (givenIso ?? isoRoute(streams, ROUTE_BOX, fit.projection)) : null),
    [view, streams, fit, givenIso],
  );
  const is3d = !!iso;
  const showMap = background === 'map' && fit && map;
  const items = useMemo(() => (highlights && streams ? findHighlights(streams) : []), [highlights, streams]);
  // Markery płaskie: strumień latlng tą samą projekcją co trasa; indeksy jak w strumieniu.
  const flatPoints = useMemo(
    () => (!is3d && fit && streams ? streams.latlng.map(([lat, lng]) => fit.projection([lng, lat])) : []),
    [is3d, fit, streams],
  );
  const { zoom, x: panX, y: panY } = camera;
  // Markery poza grupą kamery (stały rozmiar kropek i podpisów), więc punkty liczymy tą samą matematyką.
  const isoPoints = useMemo(
    () => iso?.points.map(([x, y]): [number, number] => [CX + zoom * (x - CX) + panX, CY + zoom * (y - CY) + panY]) ?? [],
    [iso, zoom, panX, panY],
  );
  const out = showMap ? THEMES[theme].render(map, { accent }) : null;
  const text = out?.text ?? { color: '#ffffff' };
  const { weight, scale } = FONTS[font];

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
          {out && <rect width={1080} height={1920} fill={THEMES[theme].style({ accent }).background} />}
          <g transform={`translate(${CX * (1 - zoom) + panX} ${CY * (1 - zoom) + panY}) scale(${zoom})`}>
            {out && (
              <>
                {/* Podłoga 3D: ta sama mapa co w widoku płaskim, przekształcona macierzą izometrii; brzegi wygaszone. */}
                <defs>
                  {/* Środek wygaszania w środku pola trasy (ROUTE_BOX), nie płótna, żeby podłoga była symetryczna. */}
                  <radialGradient id="iso-floor-fade-grad" gradientUnits="userSpaceOnUse" cx={540} cy={720} r={760}>
                    <stop offset="0.6" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#000000" />
                  </radialGradient>
                  <mask id="iso-floor-fade">
                    <rect width={1080} height={1920} fill="url(#iso-floor-fade-grad)" />
                  </mask>
                </defs>
                <g transform={`matrix(${iso.matrix.join(' ')})`}>
                  <g mask="url(#iso-floor-fade)">
                    {out.scene}
                    {/* Własne tło warstwy zakrywa mapę podstawową w prostokącie; defs motywu (filtry, wzory) są już w scene. */}
                    {refined && (
                      <>
                        <defs>
                          <clipPath id="iso-refined-clip">
                            <rect
                              x={refined.rect[0]}
                              y={refined.rect[1]}
                              width={refined.rect[2] - refined.rect[0]}
                              height={refined.rect[3] - refined.rect[1]}
                            />
                          </clipPath>
                        </defs>
                        <g clipPath="url(#iso-refined-clip)">
                          <MapBackground layers={refined.layers} style={THEMES[theme].style({ accent })} />
                        </g>
                      </>
                    )}
                  </g>
                </g>
              </>
            )}
          </g>
          {/* Faktura papieru w przestrzeni płótna (jak w widoku płaskim), nie na pochylonej i powiększanej podłodze. */}
          {out?.overlay}
          <g transform={`translate(${CX * (1 - zoom) + panX} ${CY * (1 - zoom) + panY}) scale(${zoom})`}>
            <IsoRoute iso={iso} flat={out?.route.stroke} filter={out?.route.filter} zoom={zoom} />
          </g>
        </g>
      ) : (
        <g>
          {out?.scene}
          {out?.overlay}
          {fit && <Route {...out?.route} d={fit.d} />}
        </g>
      )}
      {items.length > 0 && <RouteMarkers points={iso ? isoPoints : flatPoints} items={items} color={text.color} />}
      <g color={text.color} filter={text.filter}>
        {defaultLayout.map(({ slot, x, y, size }) => {
          const Form = FORMS[slot.form];
          const data = DATA[slot.data];
          return (
            <Form
              key={slot.id}
              x={x}
              y={y}
              size={size * scale}
              scale={scale}
              label={data.label}
              value={data.value(activity)}
            />
          );
        })}
      </g>
      <StravaMark x={60} y={1820} variant={out?.mark} />
      {out && (
        <text
          x={1020}
          y={1885}
          fontSize={26}
          fontWeight={700}
          fontFamily="system-ui, sans-serif"
          textAnchor="end"
          fill={text.color}
          opacity={0.8}
        >
          {MAP_ATTRIBUTION}
        </text>
      )}
    </svg>
  );
}
