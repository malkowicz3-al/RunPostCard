import { buildAuthUrl } from '../strava/auth';
import connectWithStrava from '../assets/brand/strava/connect-with-strava-orange.svg';

export function LoginScreen() {
  return (
    <div className="screen login">
      <h1>RunPostcard</h1>
      <p>Turn a run into a postcard you can share.</p>
      <button className="strava-connect" onClick={() => (location.href = buildAuthUrl())}>
        <img src={connectWithStrava} alt="Connect with Strava" height={48} />
      </button>
      <p className="login-note">Read-only access. Nothing is stored on a server.</p>
    </div>
  );
}
