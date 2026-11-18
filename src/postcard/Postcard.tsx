import type { Activity } from '../strava/api';
import { Background } from './Background';
import { Route } from './Route';
import { StravaMark } from './StravaMark';
import { DATA, FORMS, defaultLayout } from './slots';

export function Postcard({
  activity,
  fontCss,
  transparent = false,
}: {
  activity: Activity;
  fontCss?: string;
  transparent?: boolean;
}) {
  return (
    <svg className="postcard" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">
      {fontCss && <style>{fontCss}</style>}
      {!transparent && <Background />}
      <Route polyline={activity.map.summary_polyline} />
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
      <StravaMark x={60} y={1860} />
    </svg>
  );
}
