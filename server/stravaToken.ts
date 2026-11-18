// Jedyna logika backendu: wymiana kodu OAuth albo odświeżenie tokenu przez sekret aplikacji.
// Nie zna HTTP; wejścia (Vite, Vercel) tylko tłumaczą żądanie na to wywołanie.

export type TokenResponse = { status: number; json: unknown };

export type Env = Record<string, string | undefined>;

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

const error = (status: number, message: string): TokenResponse => ({
  status,
  json: { error: message },
});

export async function exchangeToken(body: unknown, env: Env): Promise<TokenResponse> {
  const input: Record<string, unknown> =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const hasCode = 'code' in input;
  if (hasCode === 'refresh_token' in input) {
    return error(400, 'expected exactly one of code or refresh_token');
  }

  const key = hasCode ? 'code' : 'refresh_token';
  const value = input[key];
  if (typeof value !== 'string' || value === '') {
    return error(400, 'code or refresh_token must be a non-empty string');
  }

  const clientId = env.VITE_STRAVA_CLIENT_ID;
  const clientSecret = env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return error(500, 'server is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: hasCode ? 'authorization_code' : 'refresh_token',
    [key]: value,
  });

  let res: Response;
  try {
    res = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
  } catch {
    return error(502, 'could not reach Strava');
  }

  if (res.status >= 400 && res.status < 500) {
    return error(401, 'Strava rejected the code or token');
  }
  if (!res.ok) {
    return error(502, 'Strava returned an error');
  }

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof data?.access_token !== 'string' || typeof data.refresh_token !== 'string') {
    return error(502, 'unexpected response from Strava');
  }

  return {
    status: 200,
    json: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    },
  };
}
