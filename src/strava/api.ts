import { clearSession, getAccessToken } from './auth';

export type Activity = {
  id: number;
  name: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  average_heartrate?: number;
  start_date_local: string;
  map: { summary_polyline: string };
};

export class SessionExpiredError extends Error {}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export async function fetchRuns(): Promise<Activity[]> {
  let token: string | null;
  try {
    token = await getAccessToken();
  } catch {
    clearSession();
    throw new SessionExpiredError();
  }
  if (!token) throw new SessionExpiredError();

  const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearSession();
    throw new SessionExpiredError();
  }
  if (res.status === 429) {
    throw new Error('Strava rate limit reached. Try again in a few minutes.');
  }
  if (!res.ok) throw new Error(`Strava request failed (${res.status}).`);

  const activities = (await res.json()) as Activity[];
  return activities.filter((a) => a.map.summary_polyline && RUN_TYPES.has(a.sport_type));
}
