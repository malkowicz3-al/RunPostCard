import { useMemo } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { isoRoute } from '../lib/isoRoute';
import { fitRoute } from '../lib/routePath';
import { highlights as findHighlights } from '../lib/runHighlights';
import { MAP_ATTRIBUTION, type MapLayers } from '../lib/vectorMap';
import { Background } from './Background';
import { IsoRoute } from './IsoRoute';
import { Route, ROUTE_BOX } from './Route';
import { RouteMarkers } from './RouteMarkers';
import { StravaMark } from './StravaMark';
import { DATA, FORMS, defaultLayout } from './slots';
import { THEMES, type ThemeId } from './themes';

export type PostcardBackground = 'gradient' | 'transparent' | 'map';

export function Postcard({
  activity,
  fontCss,
  background = 'gradient',
  map,
  theme = 'dark',
  accent,
  streams,
  view = 'flat',
  highlights = false,
}: {
  activity: Activity;
  fontCss?: string;
  background?: PostcardBackground;
  map?: MapLayers;
  theme?: ThemeId;
  accent?: string;
  streams?: RunStreams | null;
  view?: 'flat' | '3d';
  highlights?: boolean;
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const polyline = activity.map.summary_polyline;
  const fit = useMemo(() => fitRoute(polyline, ROUTE_BOX), [polyline]);
  const iso = useMemo(
    () => (view === '3d' && streams && fit ? isoRoute(streams, ROUTE_BOX, fit.projection) : null),
    [view, streams, fit],
  );
  const is3d = !!iso;
  const showMap = background === 'map' && fit && map;
  const items = useMemo(() => (highlights && streams ? findHighlights(streams) : []), [highlights, streams]);
  // Markery płaskie: strumień latlng tą samą projekcją co trasa; indeksy jak w strumieniu.
  const flatPoints = useMemo(
    () => (!is3d && fit && streams ? streams.latlng.map(([lat, lng]) => fit.projection([lng, lat])) : []),
    [is3d, fit, streams],
  );
  const out = showMap ? THEMES[theme].render(map, { accent }) : null;
  const text = out?.text ?? { color: '#ffffff' };

  return (
    <svg className="postcard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      {fontCss && <style>{fontCss}</style>}
      {background === 'gradient' && <Background />}
      {iso ? (
        <g>
          {out && (
            <>
              {/* Podłoga 3D: ta sama mapa co w widoku płaskim, przekształcona macierzą izometrii; brzegi wygaszone. */}
              <rect width={1080} height={1920} fill={THEMES[theme].style({ accent }).background} />
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
                <g mask="url(#iso-floor-fade)">{out.scene}</g>
              </g>
            </>
          )}
          <IsoRoute iso={iso} flat={out?.route.stroke} text={text.color} />
        </g>
      ) : (
        <g>
          {out?.scene}
          {fit && <Route {...out?.route} d={fit.d} />}
        </g>
      )}
      {items.length > 0 && <RouteMarkers points={iso ? iso.points : flatPoints} items={items} color={text.color} />}
      <g color={text.color} filter={text.filter}>
        {defaultLayout.map(({ slot, x, y, size }) => {
          const Form = FORMS[slot.form];
          const data = DATA[slot.data];
          return (
            <Form
              key={slot.id}
              x={x}
              y={y}
              size={size}
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
          fontFamily="'Barlow Condensed', system-ui, sans-serif"
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
