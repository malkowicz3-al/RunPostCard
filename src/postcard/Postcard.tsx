import type { Activity } from '../strava/api';
import { fitRoute } from '../lib/routePath';
import { MAP_ATTRIBUTION, type MapLayers } from '../lib/vectorMap';
import { Background } from './Background';
import { Route, ROUTE_BOX } from './Route';
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
}: {
  activity: Activity;
  fontCss?: string;
  background?: PostcardBackground;
  map?: MapLayers;
  theme?: ThemeId;
  accent?: string;
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const fit = fitRoute(activity.map.summary_polyline, ROUTE_BOX);
  const showMap = background === 'map' && fit && map;
  const out = showMap ? THEMES[theme].render(map, { accent }) : null;
  const text = out?.text ?? { color: '#ffffff' };

  return (
    <svg className="postcard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      {fontCss && <style>{fontCss}</style>}
      {background === 'gradient' && <Background />}
      <g>
        {out?.scene}
        {fit && <Route {...out?.route} d={fit.d} />}
      </g>
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
