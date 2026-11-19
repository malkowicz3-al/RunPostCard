import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRuns, SessionExpiredError, type Activity } from './strava/api';
import { handleCallback, hasSession, logout } from './strava/auth';
import poweredByBlack from './assets/brand/strava/powered-by-strava-black.svg';
import poweredByWhite from './assets/brand/strava/powered-by-strava-white.svg';
import { clearStreamCache } from './lib/streamCache';
import { ActivityList, mergePage } from './ui/ActivityList';
import { LoginScreen } from './ui/LoginScreen';
import { PostcardScreen } from './ui/PostcardScreen';

type Screen = 'login' | 'list' | 'generating' | 'postcard' | 'together' | 'debug';

const PER_PAGE = 50;
const MOCK_PER_PAGE = 15; // mniejsze strony w ?mock=1, żeby było widać „Load more”
const MAX_RUNS = 200;

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

// Narzędzia dev: w buildzie produkcyjnym import.meta.env.DEV = false, więc Vite wycina je razem z kodem.
const RawActivities = import.meta.env.DEV ? lazy(() => import('./dev/RawActivities')) : null;
const devParam = (name: string) => new URLSearchParams(location.search).has(name);
const TogetherScreen = lazy(() => import('./ui/TogetherScreen').then((m) => ({ default: m.TogetherScreen })));
const EMPTY_LIST = { runs: [] as Activity[], page: 0, hasMore: false }; // page: ostatnia wczytana strona

export function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [list, setList] = useState(EMPTY_LIST);
  const runs = list.runs;
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Activity>();
  const [error, setError] = useState<string>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [selection, setSelection] = useState<number[] | null>(null); // null = bez trybu Select
  const [heat, setHeat] = useState(false); // Together ze wszystkimi biegami: kolory Heat

  const together = useMemo(() => runs.filter((r) => selection?.includes(r.id)), [runs, selection]);

  // Pokolenie listy: wczytanie od nowa albo wylogowanie unieważnia strony, które jeszcze idą.
  const gen = useRef(0);

  // Stała funkcja (same settery), bo jest w zależnościach efektu pobierania strumieni.
  const onSessionExpired = useCallback(() => {
    gen.current++;
    clearStreamCache();
    setSelection(null);
    setScreen('login');
    setError('Your Strava session has expired. Connect again.');
  }, []);

  // Kolejna strona dopisana do listy; wynik starszego pokolenia albo nie po kolei jest pomijany.
  const loadPage = async (next: number, g: number) => {
    const mock = import.meta.env.DEV && devParam('mock');
    const { runs: more, done } = mock
      ? await (await import('./dev/mockActivities')).mockPage(next, MOCK_PER_PAGE)
      : await fetchRuns(next, PER_PAGE);
    if (g !== gen.current) return;
    setList((l) =>
      next > 1 && l.page !== next - 1 ? l : { ...mergePage(next === 1 ? [] : l.runs, more, done, MAX_RUNS), page: next },
    );
  };

  const loadRuns = async () => {
    const g = ++gen.current;
    setScreen('list');
    setLoading(true);
    setError(undefined);
    try {
      await loadPage(1, g);
    } catch (e) {
      if (g !== gen.current) return;
      if (e instanceof SessionExpiredError) {
        onSessionExpired();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      if (g === gen.current) setLoading(false);
    }
  };

  const loadMore = async () => {
    const g = gen.current;
    setLoadingMore(true);
    setError(undefined);
    try {
      await loadPage(list.page + 1, g);
    } catch (e) {
      if (g !== gen.current) return;
      if (e instanceof SessionExpiredError) onSessionExpired();
      else setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  // Start: jeśli wracamy z Stravy, wymień kod; potem sesja decyduje o ekranie.
  useEffect(() => {
    (async () => {
      if (import.meta.env.DEV && devParam('mock')) {
        await loadRuns();
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
    const onPop = () => setScreen((s) => (s === 'postcard' || s === 'together' ? 'list' : s));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onSelect = (activity: Activity) => {
    setSelected(activity);
    setScreen('generating');
  };

  const onTogether = (all = false) => {
    if (all) setSelection(runs.map((r) => r.id));
    setHeat(all);
    history.pushState({ screen: 'together' }, '');
    setScreen('together');
  };

  const onLogout = async () => {
    setError(undefined);
    gen.current++;
    clearStreamCache();
    setSelection(null);
    setList(EMPTY_LIST);
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
        <ActivityList
          runs={runs}
          loading={loading}
          onSelect={onSelect}
          onLogout={onLogout}
          hasMore={list.hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          selection={selection}
          onSelection={setSelection}
          onTogether={onTogether}
        />
      )}
      {screen === 'generating' && (
        <div className="screen generating">
          <div className="postcard-frame" />
          <p>Creating your postcard…</p>
        </div>
      )}
      {screen === 'postcard' && selected && (
        <PostcardScreen activity={selected} onBack={() => history.back()} onSessionExpired={onSessionExpired} />
      )}
      {screen === 'together' && selection && (
        <Suspense fallback={<p>Loading…</p>}>
          <TogetherScreen runs={together} heat={heat} onBack={() => history.back()} onSessionExpired={onSessionExpired} />
        </Suspense>
      )}
      <footer>
        {screen === 'list' && (
          <p className="map-attribution">
            Map: <a href="https://openfreemap.org">OpenFreeMap</a>{' '}
            <a href="https://openmaptiles.org">© OpenMapTiles</a>{' '}
            <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
          </p>
        )}
        <picture>
          <source srcSet={poweredByBlack} media="(prefers-color-scheme: light)" />
          <img className="strava-mark" src={poweredByWhite} alt="Powered by Strava" />
        </picture>
      </footer>
    </main>
  );
}
