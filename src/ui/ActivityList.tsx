import type { Activity } from '../strava/api';
import { formatDate, formatDistanceKm } from '../lib/format';
import { RouteThumb } from './RouteThumb';

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

function Runs({ runs, onSelect }: { runs: Activity[]; onSelect: (activity: Activity) => void }) {
  if (runs.length === 0)
    return (
      <div className="empty">
        <p>No runs with a route yet.</p>
        <p>Runs recorded with GPS will appear here.</p>
      </div>
    );
  return (
    <ul className="runs">
      {runs.map((a) => (
        <li key={a.id}>
          <button className="run-tile" onClick={() => onSelect(a)}>
            <RouteThumb polyline={a.map.summary_polyline} />
            <span className="run-name">{a.name}</span>
            <span className="run-meta">
              {formatDistanceKm(a.distance)} km · {formatDate(a.start_date_local)}
            </span>
          </button>
        </li>
      ))}
    </ul>
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
