import { buildAuthUrl } from '../strava/auth';

export function LoginScreen() {
  return (
    <div className="screen login">
      <h1>RunPostcard</h1>
      <p>Turn a run into a postcard you can share.</p>
      <button className="strava" onClick={() => (location.href = buildAuthUrl())}>
        Connect with Strava
      </button>
      <p className="login-note">Read-only access. Nothing is stored on a server.</p>
    </div>
  );
}
