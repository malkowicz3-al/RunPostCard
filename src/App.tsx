import { useEffect, useState } from 'react';
import { fetchRuns, SessionExpiredError, type Activity } from './strava/api';
import { handleCallback, hasSession, logout } from './strava/auth';
import { StravaMark } from './postcard/StravaMark';
import { ActivityList } from './ui/ActivityList';
import { LoginScreen } from './ui/LoginScreen';
import { PostcardScreen } from './ui/PostcardScreen';

type Screen = 'login' | 'list' | 'generating' | 'postcard';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

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
      try {
        await handleCallback();
      } catch (e) {
        setError(errorMessage(e));
      }
      if (hasSession()) await loadRuns();
    })();
  }, []);

  // Animacja "generuję" trwa krótko, potem pokazujemy pocztówkę.
  useEffect(() => {
    if (screen !== 'generating') return;
    const timer = setTimeout(() => setScreen('postcard'), 1200);
    return () => clearTimeout(timer);
  }, [screen]);

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
      {screen === 'list' && <ActivityList runs={runs} loading={loading} onSelect={onSelect} />}
      {screen === 'generating' && (
        <div className="screen generating">
          <div className="pulse" />
          <p>Generating…</p>
        </div>
      )}
      {screen === 'postcard' && selected && (
        <PostcardScreen
          activity={selected}
          onBack={() => setScreen('list')}
          onLogout={onLogout}
        />
      )}
      <footer>
        <svg className="strava-mark" viewBox="0 0 260 36">
          <StravaMark x={0} y={26} />
        </svg>
        {screen === 'list' && <button onClick={onLogout}>Log out</button>}
      </footer>
    </main>
  );
}
