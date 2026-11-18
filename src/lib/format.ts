const pad = (n: number) => String(n).padStart(2, '0');

export const EMPTY = '–';

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
  if (Number.isNaN(Date.parse(iso))) return EMPTY;
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

const ok = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function formatElapsed(seconds: number | undefined): string {
  return ok(seconds) && seconds > 0 ? formatDuration(seconds) : EMPTY;
}

// Przewyższenie 0 m (bieżnia, płasko) jest prawdziwą wartością, więc go nie ukrywamy.
export function formatElevation(meters: number | undefined): string {
  return ok(meters) && meters >= 0 ? String(Math.round(meters)) : EMPTY;
}

export function formatSpeedKmh(mps: number | undefined): string {
  return ok(mps) && mps > 0 ? (mps * 3.6).toFixed(1) : EMPTY;
}

// Strava podaje kadencję biegu na jedną nogę; kroki obu nóg to ×2.
export function formatCadence(cadence: number | undefined): string {
  return ok(cadence) && cadence > 0 ? String(Math.round(cadence * 2)) : EMPTY;
}

// Godzina startu z start_date_local, bez przeliczania strefy (jak formatDate).
export function formatTime(iso: string): string {
  if (Number.isNaN(Date.parse(iso))) return EMPTY;
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
}

const NAME_MAX = 28;

// Liczymy znaki jako punkty kodowe, żeby nie przeciąć emoji w połowie.
export function formatName(name: string): string {
  const chars = Array.from(name.trim());
  if (chars.length === 0) return EMPTY;
  return chars.length > NAME_MAX ? chars.slice(0, NAME_MAX - 1).join('').trimEnd() + '…' : chars.join('');
}
