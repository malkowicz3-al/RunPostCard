import { buildAuthUrl } from '../strava/auth';

export function LoginScreen() {
  return (
    <div className="screen login">
      <button className="strava" onClick={() => (location.href = buildAuthUrl())}>
        Connect with Strava
      </button>
    </div>
  );
}
