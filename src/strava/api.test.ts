import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRuns, fetchStreams, normalizeStreams, SessionExpiredError } from './api';
import { clearSession } from './auth';

vi.mock('./auth', () => ({
  getAccessToken: vi.fn(async () => 'tok'),
  clearSession: vi.fn(),
}));

const fetchMock = vi.fn();
const respond = (status: number, body: unknown = {}) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const latlng = { data: [[50, 19], [50.001, 19.001], [50.002, 19.002]] };
const distance = { data: [0, 100, 200] };

describe('normalizeStreams', () => {
  it('pełna odpowiedź: wszystkie strumienie, velocity_smooth -> velocity', () => {
    const s = normalizeStreams({
      latlng,
      distance,
      time: { data: [0, 30, 60] },
      altitude: { data: [200, 205, 210] },
      heartrate: { data: [120, 130, 140] },
      velocity_smooth: { data: [3, 3.3, 3.1] },
      cadence: { data: [84, 86, 85] },
    });
    expect(s).toEqual({
      latlng: latlng.data,
      distance: distance.data,
      time: [0, 30, 60],
      altitude: [200, 205, 210],
      heartrate: [120, 130, 140],
      velocity: [3, 3.3, 3.1],
      cadence: [84, 86, 85],
    });
  });

  it('bez tętna jest w porządku', () => {
    const s = normalizeStreams({ latlng, distance, altitude: { data: [1, 2, 3] } });
    expect(s?.heartrate).toBeUndefined();
    expect(s?.altitude).toEqual([1, 2, 3]);
  });

  it('brak latlng albo distance -> null', () => {
    expect(normalizeStreams({ distance })).toBeNull();
    expect(normalizeStreams({ latlng })).toBeNull();
    expect(normalizeStreams({ latlng: { data: 'x' }, distance })).toBeNull();
  });

  it('mniej niż 2 punkty albo różne długości latlng/distance -> null', () => {
    expect(normalizeStreams({ latlng: { data: [[50, 19]] }, distance: { data: [0] } })).toBeNull();
    expect(normalizeStreams({ latlng, distance: { data: [0, 100] } })).toBeNull();
  });

  it('opcjonalny strumień o złej długości jest odrzucany', () => {
    const s = normalizeStreams({ latlng, distance, altitude: { data: [1, 2] }, heartrate: { data: [1, 2, 3] } });
    expect(s?.altitude).toBeUndefined();
    expect(s?.heartrate).toEqual([1, 2, 3]);
  });

  it('nie obiekt -> null', () => {
    expect(normalizeStreams(null)).toBeNull();
    expect(normalizeStreams([])).toBeNull();
    expect(normalizeStreams('x')).toBeNull();
  });
});

describe('fetchStreams', () => {
  it('ok: właściwy URL, nagłówek Bearer, znormalizowane strumienie', async () => {
    respond(200, { latlng, distance, velocity_smooth: { data: [3, 3, 3] } });
    const s = await fetchStreams(42);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/activities/42/streams?keys=latlng,altitude,heartrate,velocity_smooth,cadence,distance,time&key_by_type=true',
      { headers: { Authorization: 'Bearer tok' } },
    );
    expect(s).toEqual({ latlng: latlng.data, distance: distance.data, velocity: [3, 3, 3] });
  });

  it('401 -> SessionExpiredError i czyszczenie sesji', async () => {
    respond(401);
    await expect(fetchStreams(42)).rejects.toBeInstanceOf(SessionExpiredError);
    expect(clearSession).toHaveBeenCalled();
  });

  it('429 -> błąd limitu, sesja zostaje', async () => {
    respond(429);
    await expect(fetchStreams(42)).rejects.toThrow(/rate limit/);
    expect(clearSession).not.toHaveBeenCalled();
  });
});

describe('fetchRuns', () => {
  const run = (id: number, sport_type: string, poly = 'abc') => ({ id, sport_type, map: { summary_polyline: poly } });

  it('ok: tylko biegi z trasą', async () => {
    respond(200, [run(1, 'Run'), run(2, 'Ride'), run(3, 'TrailRun', ''), run(4, 'VirtualRun')]);
    const { runs, done } = await fetchRuns();
    expect(runs.map((r) => r.id)).toEqual([1, 4]);
    expect(done).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.strava.com/api/v3/athlete/activities?per_page=50');
  });

  it('stronicowanie: page w URL; pełna strona (przed filtrem) to jeszcze nie koniec', async () => {
    respond(200, [run(1, 'Run'), run(2, 'Ride')]);
    const { runs, done } = await fetchRuns(3, 2);
    expect(runs.map((r) => r.id)).toEqual([1]);
    expect(done).toBe(false);
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.strava.com/api/v3/athlete/activities?per_page=2&page=3');
  });

  it('401 -> SessionExpiredError i czyszczenie sesji', async () => {
    respond(401);
    await expect(fetchRuns()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(clearSession).toHaveBeenCalled();
  });
});
