// Logowanie Stravą po stronie przeglądarki. Wymianę kodu i odświeżanie robi backend (/api/strava/token).

type Session = { access_token: string; refresh_token: string; expires_at: number };

const STATE_KEY = 'strava_oauth_state';
const SESSION_KEY = 'strava_session';
const REFRESH_MARGIN_S = 60;

export function buildAuthUrl(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
    redirect_uri: `${location.origin}/`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read',
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

// Wywoływane przy starcie; jeśli wracamy z Stravy, wymienia kod na token.
export async function handleCallback(): Promise<void> {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return;

  const state = url.searchParams.get('state');
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  history.replaceState(null, '', location.pathname);

  if (error) throw new Error('Strava authorization was cancelled.');
  if (!code || !state || state !== expected) throw new Error('Login failed: invalid state.');

  saveSession(await postToken({ code }));
}

export function hasSession(): boolean {
  return loadSession() !== null;
}

// Zwraca token, odświeżając go gdy zbliża się wygaśnięcie; null gdy nie ma sesji.
export async function getAccessToken(): Promise<string | null> {
  let session = loadSession();
  if (!session) return null;
  if (session.expires_at - Date.now() / 1000 < REFRESH_MARGIN_S) {
    session = await postToken({ refresh_token: session.refresh_token });
    saveSession(session);
  }
  return session.access_token;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// Najpierw czyścimy lokalnie, żeby wylogowanie zawsze działało; błąd odwołania zgłaszamy do UI.
export async function logout(): Promise<void> {
  const session = loadSession();
  clearSession();
  if (!session) return;
  const res = await fetch('https://www.strava.com/oauth/deauthorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: session.access_token }),
  }).catch(() => null);
  if (!res?.ok) {
    throw new Error('Logged out here, but Strava access was not revoked. Revoke it in Strava settings.');
  }
}

async function postToken(body: { code: string } | { refresh_token: string }): Promise<Session> {
  const res = await fetch('/api/strava/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status}).`);
  return (await res.json()) as Session;
}

function saveSession(session: Session): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}
