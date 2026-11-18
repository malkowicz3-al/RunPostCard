import { buildAuthUrl } from '../strava/auth';

export function LoginScreen() {
  return (
    <div className="screen login">
      <h1>RunPostcard</h1>
      <p>Turn one of your runs into a postcard.</p>
      <button className="strava" onClick={() => (location.href = buildAuthUrl())}>
        Connect with Strava
      </button>
    </div>
  );
}
