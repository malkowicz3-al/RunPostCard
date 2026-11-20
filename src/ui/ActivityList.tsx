import { useEffect, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import type { Activity } from '../strava/api';
import {
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatElevation,
  formatHeartRate,
  formatPace,
} from '../lib/format';
import { RUN_TAGS, runKind, type RunKind } from '../lib/runType';
import { RouteThumb } from './RouteThumb';

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

// Wygląd numeru startowego wg typu biegu ze Stravy (workout_type: 1 zawody, 2 długi, 3 trening jakościowy).
export type BibKind = RunKind;
export type BibTier = 'marathon' | 'half' | '10k' | '5k' | 'race';
// Tolerancja w metrach: zegarki mierzą zawody trochę dłużej lub krócej niż oficjalny dystans.
// Krótkie etykiety, bo na telefonie pasek ma ok. 125 px; kolor paska i tak mówi, że to zawody.
const TIERS: [BibTier, number, number, string][] = [
  ['marathon', 40500, 43500, 'MARATHON'],
  ['half', 20500, 22000, 'HALF'],
  ['10k', 9500, 10600, '10K'],
  ['5k', 4800, 5300, '5K'],
];
const ULTRA_M = 43500;

export function bibStyle(a: Pick<Activity, 'workout_type' | 'sport_type' | 'distance'>) {
  const kind = runKind(a.workout_type);
  const trail = a.sport_type === 'TrailRun';
  // Zwykły bieg po szlaku: etykieta mówi więcej niż „TRAINING”.
  if (kind !== 'race') return { kind, trail, tier: undefined, tag: trail && kind === 'training' ? 'TRAIL' : RUN_TAGS[kind] };
  const t = TIERS.find(([, min, max]) => a.distance >= min && a.distance <= max);
  return { kind, trail, tier: t?.[0] ?? 'race', tag: t ? `RACE · ${t[3]}` : a.distance > ULTRA_M ? 'RACE · ULTRA' : 'RACE' };
}

function Skeleton() {
  return (
    <div className="loading" role="status">
      <span className="sr-only">Loading runs</span>
      <ul className="runs skeleton" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className="run-tile bib-training">
              <div className="skeleton-bar" />
              <div className="route-thumb" />
              <div className="skeleton-bar" />
              <div className="skeleton-bar short" />
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

const DRAW_MS = 900; // jak animacja route-draw w CSS

// Dystans i czas liczą się w górę razem z rysowaniem trasy (tekst końcowy zostaje w DOM dla czytników ekranu).
function countUp(tile: HTMLElement, a: Activity) {
  if (tile.dataset.counting || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const [dist, time] = tile.querySelectorAll<HTMLElement>('.bib-data > span');
  if (!dist || !time) return;
  tile.dataset.counting = '1';
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / DRAW_MS);
    const e = 1 - (1 - t) ** 2; // ease-out
    dist.textContent = `${formatDistanceKm(a.distance * e)} km`;
    time.textContent = formatDuration(Math.round(a.moving_time * e));
    if (t < 1) requestAnimationFrame(step);
    else delete tile.dataset.counting;
  };
  requestAnimationFrame(step);
}

function Runs({
  runs,
  onSelect,
  selection,
  onToggle,
}: {
  runs: Activity[];
  onSelect: (activity: Activity) => void;
  selection: number[] | null;
  onToggle: (id: number) => void;
}) {
  if (runs.length === 0)
    return (
      <div className="empty">
        <p>No runs with a route yet.</p>
        <p>Runs recorded with GPS will appear here.</p>
      </div>
    );
  const s = summarize(runs);
  return (
    <>
      <Summary s={s} />
      <ul className="runs">
        {runs.map((a, i) => {
          const checked = selection?.includes(a.id) ?? false;
          const b = bibStyle(a);
          return (
            <li key={a.id} style={{ '--i': i } as CSSProperties}>
              <button
                className={`run-tile bib-${b.kind}${b.trail ? ' bib-trail' : ''}`}
                data-tier={b.tier}
                role={selection ? 'checkbox' : undefined}
                aria-checked={selection ? checked : undefined}
                onClick={() => (selection ? onToggle(a.id) : onSelect(a))}
                onMouseEnter={(e) => countUp(e.currentTarget, a)}
                onFocus={(e) => countUp(e.currentTarget, a)}
              >
                {/* Numer startowy: pasek z nazwą i typem, mapa z trasą, dane; kolory wariantu w CSS. */}
                <span className="bib-band">
                  <span className="run-name">{a.name}</span>
                  <span className="bib-tag">{b.tag}</span>
                </span>
                <span className="run-thumb">
                  <RouteThumb polyline={a.map.summary_polyline} height={75} />
                  {a.id === s.longestId && <span className="run-badge">Longest</span>}
                  {b.kind === 'race' && <span className="bib-sticker">Race day</span>}
                  {selection && (
                    <span className="run-check" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                  )}
                </span>
                <span className="bib-data">
                  <span>{formatDistanceKm(a.distance)} km</span>
                  <span>{formatDuration(a.moving_time)}</span>
                  <span>{formatPace(a.distance, a.moving_time)} /km</span>
                </span>
                <span className="bib-meta">
                  {[
                    formatDate(a.start_date_local),
                    a.average_heartrate ? `${formatHeartRate(a.average_heartrate)} bpm` : null,
                    `${formatElevation(a.total_elevation_gain)} m up`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
          <button className="text-button" disabled={loading} onClick={onRefresh}>
            Refresh
          </button>
          <button className="text-button" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </div>
      {loading ? (
        <Skeleton />
      ) : (
        <Runs runs={runs} onSelect={onSelect} selection={selection} onToggle={(id) => onSelection((s) => toggleId(s ?? [], id))} />
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
