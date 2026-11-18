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
  const iso = useMemo(() => (view === '3d' && streams ? isoRoute(streams, ROUTE_BOX) : null), [view, streams]);
  const is3d = !!iso;
  // W 3D mapa płaska nie pasuje do rzutu: tło 'map' spada do gradientu.
  const showMap = !is3d && background === 'map' && fit && map;
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
      {(background === 'gradient' || (is3d && background === 'map')) && <Background />}
      <g>
        {out?.scene}
        {iso ? <IsoRoute iso={iso} /> : fit && <Route {...out?.route} d={fit.d} />}
      </g>
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
