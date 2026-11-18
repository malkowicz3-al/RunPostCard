import { useEffect, useState } from 'react';
import { fetchStreams, SessionExpiredError, type Activity, type RunStreams } from '../strava/api';

// Strumienie otwartego biegu, tylko w pamięci; null = ładowanie, brak danych albo błąd (pocztówka działa bez nich).
// Wyjątek: wygasła sesja (stravaGet już ją wyczyścił) idzie do onSessionExpired, żeby UI wróciło do logowania.
export function useRunStreams(activity: Activity, onSessionExpired: () => void): RunStreams | null {
  const [streams, setStreams] = useState<RunStreams | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStreams(null);
    const load = async (): Promise<RunStreams | null> => {
      // Ten sam warunek co w App.tsx: w buildzie produkcyjnym Vite wycina mock.
      if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
        const { mockStreams } = await import('../dev/mockActivities');
        return mockStreams(activity);
      }
      return fetchStreams(activity.id);
    };
    load().then(
      (s) => !cancelled && setStreams(s),
      (e) => {
        if (cancelled) return;
        setStreams(null);
        if (e instanceof SessionExpiredError) onSessionExpired();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  return streams;
}
