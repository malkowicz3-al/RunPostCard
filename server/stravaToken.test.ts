import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeToken } from './stravaToken';

const env = { VITE_STRAVA_CLIENT_ID: '123', STRAVA_CLIENT_SECRET: 'top-secret' };

const stravaReply = (status: number, json: unknown = {}) =>
  new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exchangeToken', () => {
  it('odrzuca body bez code i refresh_token', async () => {
    const res = await exchangeToken({}, env);
    expect(res.status).toBe(400);
  });

  it('odrzuca body z oboma polami', async () => {
    const res = await exchangeToken({ code: 'a', refresh_token: 'b' }, env);
    expect(res.status).toBe(400);
  });

  it('odrzuca niestringowy code', async () => {
    const res = await exchangeToken({ code: 42 }, env);
    expect(res.status).toBe(400);
  });

  it('brak sekretu daje 500 bez ujawniania wartości', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await exchangeToken({ code: 'abc' }, { VITE_STRAVA_CLIENT_ID: '123' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.json)).not.toContain('123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wymienia code na token i zwraca tylko potrzebne pola', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      stravaReply(200, {
        access_token: 'at',
        refresh_token: 'rt',
        expires_at: 1900000000,
        athlete: { id: 1, firstname: 'X' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await exchangeToken({ code: 'abc' }, env);

    expect(res).toEqual({
      status: 200,
      json: { access_token: 'at', refresh_token: 'rt', expires_at: 1900000000 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.strava.com/oauth/token');
    const sent = new URLSearchParams(init.body as URLSearchParams);
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('code')).toBe('abc');
    expect(sent.get('client_secret')).toBe('top-secret');
  });

  it('odświeża token przez refresh_token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      stravaReply(200, { access_token: 'at2', refresh_token: 'rt2', expires_at: 1 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await exchangeToken({ refresh_token: 'rt' }, env);

    const sent = new URLSearchParams(fetchMock.mock.calls[0][1].body as URLSearchParams);
    expect(sent.get('grant_type')).toBe('refresh_token');
    expect(sent.get('refresh_token')).toBe('rt');
  });

  it('odrzucenie przez Stravę daje 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stravaReply(400, { message: 'Bad Request' })));
    const res = await exchangeToken({ code: 'bad' }, env);
    expect(res.status).toBe(401);
  });

  it('błąd po stronie Stravy daje 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stravaReply(500)));
    const res = await exchangeToken({ code: 'abc' }, env);
    expect(res.status).toBe(502);
  });
});
