import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import type { Activity } from '../strava/api';
import {
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatElevation,
  formatHeartRate,
  formatPace,
} from '../lib/format';
import { RouteThumb } from './RouteThumb';
import { Select } from './Select';

// Sumy dla nagłówka listy; longestId tylko przy co najmniej 2 biegach (przy jednym odznaka nic nie mówi).
export function summarize(runs: Activity[]) {
  let distance = 0;
  let time = 0;
  let elevation = 0;
  let longest: Activity | undefined;
  for (const a of runs) {
    distance += a.distance;
    time += a.moving_time;
    elevation += a.total_elevation_gain ?? 0;
    if (!longest || a.distance > longest.distance) longest = a;
  }
  return { count: runs.length, distance, time, elevation, longestId: runs.length > 1 ? longest?.id : undefined };
}

// Widok „Together”: od 2 do 50 biegów naraz.
export const MAX_TOGETHER = 50;
export const canAnimateTogether = (count: number) => count >= 2 && count <= MAX_TOGETHER;
export const toggleId = (ids: number[], id: number) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

// Strona dopisana do listy: bez powtórek id (nowy bieg w trakcie przesuwa strony), najwyżej max biegów.
export function mergePage(base: Activity[], more: Activity[], done: boolean, max: number) {
  const seen = new Set(base.map((r) => r.id));
  const runs = [...base, ...more.filter((r) => !seen.has(r.id))].slice(0, max);
  return { runs, hasMore: !done && runs.length < max };
}

// Styl okładek na liście; wybór zapamiętany w przeglądarce (tylko wygoda, bez wpływu na dane).
export type Cover = 'newspaper' | 'comic' | 'bib';
const COVERS: { id: Cover; label: string; masthead: string }[] = [
  { id: 'newspaper', label: 'Newspaper', masthead: 'The Daily Run' },
  { id: 'comic', label: 'Comic', masthead: 'Run Tales' },
  { id: 'bib', label: 'Race bib', masthead: 'Finisher' },
];
const COVER_KEY = 'runpostcard.cover';

function readCover(): Cover {
  try {
    const v = localStorage.getItem(COVER_KEY);
    return COVERS.some((c) => c.id === v) ? (v as Cover) : 'newspaper';
  } catch {
    return 'newspaper';
  }
}

function saveCover(c: Cover) {
  try {
    localStorage.setItem(COVER_KEY, c);
  } catch {
    // prywatne okno: wybór tylko do zamknięcia karty
  }
}

function Skeleton({ cover }: { cover: Cover }) {
  return (
    <div className="loading" role="status">
      <span className="sr-only">Loading runs</span>
      <ul className="runs skeleton" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className={`run-tile cover-${cover}`}>
              <div className="skeleton-bar short" />
              <div className="skeleton-bar" />
              <div className="route-thumb" />
              <div className="skeleton-bar" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ s }: { s: ReturnType<typeof summarize> }) {
  const items: [string, string, string][] = [
    ['Runs', String(s.count), ''],
    ['Distance', formatDistanceKm(s.distance), 'km'],
    ['Moving time', formatDuration(s.time), ''],
    ['Elevation', formatElevation(s.elevation), 'm'],
  ];
  return (
    <dl className="runs-summary">
      {items.map(([label, value, unit]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {value}
            {unit && <span className="unit"> {unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Runs({
  runs,
  onSelect,
  selection,
  onToggle,
  cover,
}: {
  runs: Activity[];
  onSelect: (activity: Activity) => void;
  selection: number[] | null;
  onToggle: (id: number) => void;
  cover: Cover;
}) {
  if (runs.length === 0)
    return (
      <div className="empty">
        <p>No runs with a route yet.</p>
        <p>Runs recorded with GPS will appear here.</p>
      </div>
    );
  const s = summarize(runs);
  const masthead = COVERS.find((c) => c.id === cover)!.masthead;
  return (
    <>
      <Summary s={s} />
      <ul className="runs">
        {runs.map((a, i) => {
          const checked = selection?.includes(a.id) ?? false;
          return (
            <li key={a.id} style={{ '--i': i } as CSSProperties}>
              <button
                className={`run-tile cover-${cover}`}
                role={selection ? 'checkbox' : undefined}
                aria-checked={selection ? checked : undefined}
                onClick={() => (selection ? onToggle(a.id) : onSelect(a))}
              >
                {/* Okładka: winieta z datą, nagłówek = nazwa biegu, mapa jako zdjęcie, dane; układ i wygląd wg stylu w CSS. */}
                <span className="run-masthead">
                  <span aria-hidden="true">{masthead}</span>
                  <span>{formatDate(a.start_date_local)}</span>
                </span>
                <span className="run-name">{a.name}</span>
                <span className="run-thumb">
                  <RouteThumb polyline={a.map.summary_polyline} height={75} />
                  {a.id === s.longestId && <span className="run-badge">Longest</span>}
                  {selection && (
                    <span className="run-check" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                  )}
                </span>
                <span className="run-stats">
                  <span className="run-distance">
                    {formatDistanceKm(a.distance)}
                    <span className="unit"> km</span>
                  </span>
                  <span className="run-pace">{formatPace(a.distance, a.moving_time)} /km</span>
                  <span className="run-time">{formatDuration(a.moving_time)}</span>
                  <span className="run-elev">{formatElevation(a.total_elevation_gain)} m up</span>
                  {a.average_heartrate ? <span className="run-hr">{formatHeartRate(a.average_heartrate)} bpm</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function ActivityList({
  runs,
  loading,
  onSelect,
  onLogout,
  onRefresh,
  hasMore,
  loadingMore,
  onLoadMore,
  selection,
  onSelection,
  onTogether,
}: {
  runs: Activity[];
  loading: boolean;
  onSelect: (activity: Activity) => void;
  onLogout: () => void;
  onRefresh: () => void; // lista od nowa ze Stravy (nowy bieg)
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  selection: number[] | null; // null = zwykły tryb (kafelek otwiera pocztówkę)
  onSelection: Dispatch<SetStateAction<number[] | null>>;
  onTogether: (all?: boolean) => void; // all = wszystkie wczytane biegi, kolory Heat
}) {
  const selecting = selection !== null;
  const [cover, setCover] = useState(readCover);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onSelection(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, onSelection]);

  return (
    <div className="screen list-screen">
      <div className="top-bar">
        <h1 className="screen-title">Your runs</h1>
        <div className="toggle-row">
          {!loading && runs.length > 1 && (
            <button className="toggle" aria-pressed={selecting} onClick={() => onSelection(selecting ? null : [])}>
              Select
            </button>
          )}
          {!loading && runs.length > 1 && (
            <button className="toggle" onClick={() => onTogether(true)}>
              All together
            </button>
          )}
          <Select
            label="Cover style"
            className="cover-select"
            value={cover}
            options={COVERS}
            onChange={(c) => {
              setCover(c);
              saveCover(c);
            }}
          />
          <button className="text-button" disabled={loading} onClick={onRefresh}>
            Refresh
          </button>
          <button className="text-button" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
      {loading ? (
        <Skeleton cover={cover} />
      ) : (
        <Runs runs={runs} onSelect={onSelect} selection={selection} onToggle={(id) => onSelection((s) => toggleId(s ?? [], id))} cover={cover} />
      )}
      {!loading && hasMore && (
        <button className="load-more" disabled={loadingMore} onClick={onLoadMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
      {selection && (
        <div className="select-bar">
          <span role="status">
            {selection.length} selected
            {selection.length > MAX_TOGETHER && ` (up to ${MAX_TOGETHER})`}
          </span>
          <button className="text-button" disabled={selection.length === 0} onClick={() => onSelection([])}>
            Clear
          </button>
          <button className="primary" disabled={!canAnimateTogether(selection.length)} onClick={() => onTogether()}>
            Animate together
          </button>
        </div>
      )}
    </div>
  );
}
