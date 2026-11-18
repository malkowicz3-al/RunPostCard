const pad = (n: number) => String(n).padStart(2, '0');

const EMPTY = '–';

// Dystans w metrach -> km z dwoma miejscami po przecinku.
export function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

// Sekundy -> m:ss, a od godziny h:mm:ss.
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 3600) {
    return `${Math.floor(total / 60)}:${pad(total % 60)}`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}:${pad(m)}:${pad(total % 60)}`;
}

// Tempo min/km; zaokrąglamy łączny wynik w sekundach, żeby nie wyszło "5:60".
export function formatPace(meters: number, seconds: number): string {
  if (!(meters > 0) || !(seconds > 0)) return EMPTY;
  const total = Math.round((seconds * 1000) / meters);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

// Data z start_date_local: Strava podaje czas lokalny z sufiksem Z, więc nie przeliczamy strefy.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatHeartRate(bpm: number | undefined): string {
  return bpm ? String(Math.round(bpm)) : EMPTY;
}
