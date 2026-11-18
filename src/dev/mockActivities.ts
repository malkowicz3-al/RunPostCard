// Tylko dev (?mock=1): fałszywe biegi do podglądu listy i pocztówki. Dane są wymyślone.
import type { Activity, RunStreams } from '../strava/api';
import { decodePolyline } from '../lib/polyline';

// Koder Google encoded polyline (odwrotność src/lib/polyline.ts).
function encodeValue(value: number): string {
  let n = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(points: [number, number][]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = '';
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    out += encodeValue(latE5 - prevLat) + encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}

// Kształty w przedziale [-1, 1] x [-1, 1]; t od 0 do 1.
const SHAPES = {
  loop: (t: number): [number, number] => [Math.cos(2 * Math.PI * t), Math.sin(2 * Math.PI * t)],
  eight: (t: number): [number, number] => [Math.sin(2 * Math.PI * t), Math.sin(4 * Math.PI * t) / 2],
  line: (t: number): [number, number] => [2 * t - 1, 0],
  zigzag: (t: number): [number, number] => [2 * t - 1, Math.abs(((t * 6) % 2) - 1) * 2 - 1],
};

const CENTER: [number, number] = [50.0647, 19.945];
const POINTS = 80;

function route(shape: keyof typeof SHAPES): string {
  const points = Array.from({ length: POINTS }, (_, i) => {
    const [x, y] = SHAPES[shape](i / (POINTS - 1));
    return [CENTER[0] + y * 0.01, CENTER[1] + x * 0.015] as [number, number];
  });
  return encodePolyline(points);
}

const RUNS: {
  name: string;
  shape: keyof typeof SHAPES;
  km: number;
  minutes: number;
  hr?: number;
  elev: number;
  cad?: number;
  date: string;
}[] = [
  { name: 'Morning loop', shape: 'loop', km: 5.0, minutes: 27, hr: 152, elev: 32, cad: 86, date: '2026-11-10T07:12:00Z' },
  { name: 'Intervals at the park', shape: 'zigzag', km: 8.2, minutes: 40, hr: 168, elev: 18, cad: 89, date: '2026-11-12T17:30:00Z' },
  { name: 'Long run by the river', shape: 'line', km: 20.1, minutes: 120, hr: 141, elev: 64, cad: 84, date: '2026-11-14T09:00:00Z' },
  { name: 'Lunch 🏃🏻‍♀️ figure eight', shape: 'eight', km: 3.1, minutes: 19, elev: 7, date: '2026-11-15T12:45:00Z' },
  { name: 'Hill repeats', shape: 'zigzag', km: 6.4, minutes: 38, hr: 161, elev: 240, cad: 85, date: '2026-11-16T18:05:00Z' },
  { name: 'A very long title to check how the tile wraps onto two lines', shape: 'loop', km: 12.0, minutes: 66, hr: 135, elev: 41, cad: 87, date: '2026-11-17T06:50:00Z' },
];

export function mockActivities(): Activity[] {
  return RUNS.map((r, i) => {
    const speed = (r.km * 1000) / (r.minutes * 60);
    return {
      id: 1000000001 + i,
      name: r.name,
      sport_type: 'Run',
      distance: r.km * 1000,
      moving_time: r.minutes * 60,
      elapsed_time: r.minutes * 60 + 90,
      total_elevation_gain: r.elev,
      average_heartrate: r.hr,
      max_heartrate: r.hr && r.hr + 20,
      average_speed: speed,
      max_speed: speed * 1.3,
      average_cadence: r.cad,
      start_date_local: r.date,
      map: { summary_polyline: route(r.shape) },
    };
  });
}

function haversine([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

// Syntetyczne strumienie (deterministyczne): wzgórze z sinusa, wolniej i wyższe tętno pod górę.
export function mockStreams(activity: Activity): RunStreams {
  const latlng = decodePolyline(activity.map.summary_polyline);
  const n = latlng.length;
  const D = activity.distance;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + haversine(latlng[i - 1], latlng[i]));
  const total = cum[n - 1];
  // Zdegenerowana trasa (wszystkie punkty w jednym miejscu): dystans liniowo.
  const distance = cum.map((c, i) => (total > 0 ? (c / total) * D : (i / Math.max(1, n - 1)) * D));
  const halves = /hill repeats/i.test(activity.name) ? 6 : 1;
  const altitude = distance.map((d) => 200 + 40 * Math.sin((halves * Math.PI * d) / D));
  // Nachylenie z pochodnej sinusa i jego maksimum (do normalizacji tętna).
  const maxGrade = (40 * halves * Math.PI) / D;
  const grade = distance.map((d) => maxGrade * Math.cos((halves * Math.PI * d) / D));
  const time = distance.map((d) => (d / D) * activity.moving_time);
  const speed = D / activity.moving_time;
  const velocity = grade.map((g) => Math.max(0.5, speed * (1 - 3 * g)));
  const streams: RunStreams = { latlng, distance, time, altitude, velocity };
  const hr = activity.average_heartrate;
  if (hr) streams.heartrate = distance.map((d, i) => Math.round(hr + 25 * (grade[i] / maxGrade) + 10 * (d / D - 0.5)));
  return streams;
}
