import { lazy, Suspense, useEffect, useState } from 'react';
import { fetchRuns, SessionExpiredError, type Activity } from './strava/api';
import { handleCallback, hasSession, logout } from './strava/auth';
import { MAP_ENABLED } from './lib/mapTiles';
import poweredByBlack from './assets/brand/strava/powered-by-strava-black.svg';
import poweredByWhite from './assets/brand/strava/powered-by-strava-white.svg';
import { ActivityList } from './ui/ActivityList';
import { LoginScreen } from './ui/LoginScreen';
import { PostcardScreen } from './ui/PostcardScreen';

type Screen = 'login' | 'list' | 'generating' | 'postcard' | 'debug';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// Narzędzia dev: w buildzie produkcyjnym import.meta.env.DEV = false, więc Vite wycina je razem z kodem.
const RawActivities = import.meta.env.DEV ? lazy(() => import('./dev/RawActivities')) : null;
const devParam = (name: string) => new URLSearchParams(location.search).has(name);

export function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [runs, setRuns] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Activity>();
  const [error, setError] = useState<string>();

  const loadRuns = async () => {
    setScreen('list');
    setLoading(true);
    setError(undefined);
    try {
      setRuns(await fetchRuns());
    } catch (e) {
      if (e instanceof SessionExpiredError) {
        setScreen('login');
        setError('Your Strava session has expired. Connect again.');
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  // Start: jeśli wracamy z Stravy, wymień kod; potem sesja decyduje o ekranie.
  useEffect(() => {
    (async () => {
      if (import.meta.env.DEV && devParam('mock')) {
        const { mockActivities } = await import('./dev/mockActivities');
        setRuns(mockActivities());
        setScreen('list');
        return;
      }
      try {
        await handleCallback();
      } catch (e) {
        setError(errorMessage(e));
      }
      if (import.meta.env.DEV && devParam('debug')) setScreen('debug');
      else if (hasSession()) await loadRuns();
    })();
  }, []);

  // Animacja "generuję" trwa krótko, potem pokazujemy pocztówkę (zapisana w historii, żeby Wstecz wracał do listy).
  useEffect(() => {
    if (screen !== 'generating') return;
    const timer = setTimeout(() => {
      history.pushState({ screen: 'postcard' }, '');
      setScreen('postcard');
    }, 700);
    return () => clearTimeout(timer);
  }, [screen]);

  // Wstecz w przeglądarce z pocztówki wraca do listy, zamiast do okna Stravy.
  useEffect(() => {
    const onPop = () => setScreen((s) => (s === 'postcard' ? 'list' : s));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onSelect = (activity: Activity) => {
    setSelected(activity);
    setScreen('generating');
  };

  const onLogout = async () => {
    setError(undefined);
    try {
      await logout();
    } catch (e) {
      setError(errorMessage(e));
    }
    setScreen('login');
  };

  return (
    <main className="app">
      {error && <p className="error">{error}</p>}
      {screen === 'login' && <LoginScreen />}
      {screen === 'debug' && RawActivities && (
        <Suspense fallback={<p>Loading…</p>}>
          <RawActivities />
        </Suspense>
      )}
      {screen === 'list' && (
        <ActivityList runs={runs} loading={loading} onSelect={onSelect} onLogout={onLogout} />
      )}
      {screen === 'generating' && (
        <div className="screen generating">
          <div className="postcard-frame" />
          <p>Creating your postcard…</p>
        </div>
      )}
      {screen === 'postcard' && selected && (
        <PostcardScreen activity={selected} onBack={() => history.back()} />
      )}
      <footer>
        {screen === 'list' && MAP_ENABLED && (
          <p className="map-attribution">Map data © OpenStreetMap contributors © CARTO</p>
        )}
        <picture>
          <source srcSet={poweredByBlack} media="(prefers-color-scheme: light)" />
          <img className="strava-mark" src={poweredByWhite} alt="Powered by Strava" />
        </picture>
      </footer>
    </main>
  );
}
