import type { CSSProperties } from 'react';
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

function Skeleton() {
  return (
    <div className="loading" role="status">
      <span className="sr-only">Loading runs</span>
      <ul className="runs skeleton" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <div className="run-tile">
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

function Runs({ runs, onSelect }: { runs: Activity[]; onSelect: (activity: Activity) => void }) {
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
        {runs.map((a, i) => (
          <li key={a.id} style={{ '--i': i } as CSSProperties}>
            <button className="run-tile" onClick={() => onSelect(a)}>
              <span className="run-thumb">
                <RouteThumb polyline={a.map.summary_polyline} />
                {a.id === s.longestId && <span className="run-badge">Longest</span>}
              </span>
              <span className="run-distance">
                {formatDistanceKm(a.distance)}
                <span className="unit"> km</span>
              </span>
              <span className="run-name">{a.name}</span>
              <span className="run-stats">
                <span>{formatPace(a.distance, a.moving_time)} /km</span>
                <span>{formatDuration(a.moving_time)}</span>
                <span>{formatElevation(a.total_elevation_gain)} m up</span>
                {a.average_heartrate ? <span>{formatHeartRate(a.average_heartrate)} bpm</span> : null}
              </span>
              <span className="run-meta">{formatDate(a.start_date_local)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ActivityList({
  runs,
  loading,
  onSelect,
  onLogout,
}: {
  runs: Activity[];
  loading: boolean;
  onSelect: (activity: Activity) => void;
  onLogout: () => void;
}) {
  return (
    <div className="screen list-screen">
      <div className="top-bar">
        <h1 className="screen-title">Your runs</h1>
        <button className="text-button" onClick={onLogout}>
          Log Out
        </button>
      </div>
      {loading ? <Skeleton /> : <Runs runs={runs} onSelect={onSelect} />}
    </div>
  );
}
