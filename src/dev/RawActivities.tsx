// Tylko dev (?debug=1): surowa odpowiedź Stravy po redakcji, z przyciskiem kopiowania.
import { useEffect, useState } from 'react';
import { fetchActivitiesRaw, SessionExpiredError } from '../strava/api';
import { hasSession } from '../strava/auth';
import { redactActivities } from './redact';

export default function RawActivities() {
  const [json, setJson] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!hasSession()) {
      setError('Log in first');
      return;
    }
    fetchActivitiesRaw()
      .then((raw) => setJson(JSON.stringify(redactActivities(raw), null, 2)))
      .catch((e) => setError(e instanceof SessionExpiredError ? 'Log in first' : String(e.message)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!json) return <p>Loading…</p>;
  return (
    <div className="screen">
      <button onClick={() => navigator.clipboard.writeText(json)}>Copy JSON</button>
      <pre className="raw-json">{json}</pre>
    </div>
  );
}
