import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, handleCallback } from './auth';

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, String(v)),
    removeItem: (k: string) => void items.delete(k),
  };
};

const jsonReply = (json: unknown) =>
  new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });

const stubLocation = (query: string) =>
  vi.stubGlobal('location', { href: `http://localhost/${query}`, pathname: '/', origin: 'http://localhost' });

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('history', { replaceState: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleCallback', () => {
  it('odrzuca zły state', async () => {
    storage.setItem('strava_oauth_state', 'expected');
    stubLocation('?code=abc&state=other');
    await expect(handleCallback()).rejects.toThrow('invalid state');
  });

  it('odrzuca brak state', async () => {
    storage.setItem('strava_oauth_state', 'expected');
    stubLocation('?code=abc');
    await expect(handleCallback()).rejects.toThrow('invalid state');
  });

  it('dla poprawnego state zapisuje sesję', async () => {
    storage.setItem('strava_oauth_state', 'expected');
    stubLocation('?code=abc&state=expected');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonReply({ access_token: 'at', refresh_token: 'rt', expires_at: 1900000000 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await handleCallback();

    expect(JSON.parse(storage.getItem('strava_session') ?? '{}').access_token).toBe('at');
    expect(fetchMock).toHaveBeenCalledWith('/api/strava/token', expect.objectContaining({ method: 'POST' }));
  });
});

describe('getAccessToken', () => {
  it('przy wygasłym tokenie odświeża go przez refresh_token', async () => {
    storage.setItem(
      'strava_session',
      JSON.stringify({ access_token: 'old', refresh_token: 'rt', expires_at: Date.now() / 1000 - 10 }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      jsonReply({ access_token: 'new', refresh_token: 'rt2', expires_at: 1900000000 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await getAccessToken()).toBe('new');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refresh_token: 'rt' });
  });
});
