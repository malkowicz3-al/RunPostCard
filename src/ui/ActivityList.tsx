import type { Activity } from '../strava/api';
import { formatDate, formatDistanceKm } from '../lib/format';

export function ActivityList({
  runs,
  loading,
  onSelect,
}: {
  runs: Activity[];
  loading: boolean;
  onSelect: (activity: Activity) => void;
}) {
  if (loading) return <p>Loading runs…</p>;
  if (runs.length === 0) return <p>No runs with a GPS route found.</p>;
  return (
    <ul className="runs">
      {runs.map((a) => (
        <li key={a.id}>
          <button onClick={() => onSelect(a)}>
            <span className="run-name">{a.name}</span>
            <span className="run-meta">
              {formatDate(a.start_date_local)} · {formatDistanceKm(a.distance)} km
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
