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

// Strumienie jednego biegu; wszystkie tablice mają tę samą długość co latlng.
export type RunStreams = {
  latlng: [number, number][]; // [lat, lng], jak decodePolyline
  distance: number[]; // m od startu
  time?: number[]; // s od startu
  altitude?: number[]; // m
  heartrate?: number[]; // bpm
  velocity?: number[]; // m/s (velocity_smooth)
};

export class SessionExpiredError extends Error {}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

async function stravaGet<T>(path: string): Promise<T> {
  let token: string | null;
  try {
    token = await getAccessToken();
  } catch {
    clearSession();
    throw new SessionExpiredError();
  }
  if (!token) throw new SessionExpiredError();

  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
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

  return (await res.json()) as T;
}

const getActivities = (perPage: number) => stravaGet<unknown[]>(`/athlete/activities?per_page=${perPage}`);

// Odpowiedź key_by_type: { latlng: { data: [...] }, ... }. Brak opcjonalnego klucza jest normalny
// (np. bez pulsometru); tablica o innej długości niż latlng jest odrzucana, żeby indeksy się zgadzały.
export function normalizeStreams(raw: unknown): RunStreams | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, { data?: unknown } | undefined>;
  const data = (key: string) => {
    const d = obj[key]?.data;
    return Array.isArray(d) ? d : undefined;
  };
  const latlng = data('latlng') as [number, number][] | undefined;
  const distance = data('distance') as number[] | undefined;
  if (!latlng || !distance || latlng.length < 2 || distance.length !== latlng.length) return null;
  const optional = (key: string) => {
    const d = data(key) as number[] | undefined;
    return d && d.length === latlng.length ? d : undefined;
  };
  const streams: RunStreams = { latlng, distance };
  const time = optional('time');
  const altitude = optional('altitude');
  const heartrate = optional('heartrate');
  const velocity = optional('velocity_smooth');
  if (time) streams.time = time;
  if (altitude) streams.altitude = altitude;
  if (heartrate) streams.heartrate = heartrate;
  if (velocity) streams.velocity = velocity;
  return streams;
}

export async function fetchStreams(id: number): Promise<RunStreams | null> {
  return normalizeStreams(
    await stravaGet<unknown>(
      `/activities/${id}/streams?keys=latlng,altitude,heartrate,velocity_smooth,distance,time&key_by_type=true`,
    ),
  );
}

export async function fetchRuns(): Promise<Activity[]> {
  const activities = (await getActivities(30)) as Activity[];
  return activities.filter((a) => a.map.summary_polyline && RUN_TYPES.has(a.sport_type));
}

// Tylko dev (?debug=1): surowa odpowiedź bez filtra, do podglądu struktury danych.
export function fetchActivitiesRaw(): Promise<unknown[]> {
  return getActivities(10);
}
