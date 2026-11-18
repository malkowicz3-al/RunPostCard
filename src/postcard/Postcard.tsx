import { useMemo } from 'react';
import type { Activity } from '../strava/api';
import { hashSeed } from '../lib/random';
import { fitRoute } from '../lib/routePath';
import { MAP_ATTRIBUTION, type MapData } from '../lib/vectorMap';
import { Background } from './Background';
import { Route, ROUTE_BOX } from './Route';
import { StravaMark } from './StravaMark';
import { DATA, FORMS, defaultLayout } from './slots';
import { THEMES, type ThemeId } from './themes';
import { slotZones } from './themes/geometry';

export type PostcardBackground = 'gradient' | 'transparent' | 'map';

const SIZE: [number, number] = [1080, 1920];
const EXCLUDE = slotZones(defaultLayout);

export function Postcard({
  activity,
  fontCss,
  background = 'gradient',
  map,
  theme = 'minimal',
}: {
  activity: Activity;
  fontCss?: string;
  background?: PostcardBackground;
  map?: MapData;
  theme?: ThemeId;
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  const showMap = background === 'map' && fit && map;
  // Rozmieszczanie ikon trwa do kilkudziesięciu ms, więc nie przy każdym renderze (np. po doczytaniu fontu).
  const out = useMemo(
    () =>
      showMap
        ? THEMES[theme].render({
            map,
            size: SIZE,
            route: fit.points,
            seed: hashSeed(activity.id),
            activity,
            exclude: EXCLUDE,
          })
        : null,
    [showMap, theme, map, fit, activity],
  );
  const text = out?.text ?? { color: '#ffffff' };

  return (
    <svg className="postcard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      {fontCss && <style>{fontCss}</style>}
      {background === 'gradient' && <Background />}
      <g>
        {out?.scene}
        {fit && <Route {...out?.route} d={out?.route.d ?? fit.d} />}
      </g>
      {out?.overlay}
      <g
        color={text.color}
        stroke={text.outline}
        strokeWidth={text.outlineWidth}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
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
