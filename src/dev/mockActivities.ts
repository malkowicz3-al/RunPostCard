// Tylko dev (?mock=1): fałszywe biegi do podglądu listy i pocztówki. Dane są wymyślone.
import type { Activity } from '../strava/api';

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

const RUNS: { name: string; shape: keyof typeof SHAPES; km: number; minutes: number; hr?: number; date: string }[] = [
  { name: 'Morning loop', shape: 'loop', km: 5.0, minutes: 27, hr: 152, date: '2026-11-10T07:12:00Z' },
  { name: 'Intervals at the park', shape: 'zigzag', km: 8.2, minutes: 40, hr: 168, date: '2026-11-12T17:30:00Z' },
  { name: 'Long run by the river', shape: 'line', km: 20.1, minutes: 120, hr: 141, date: '2026-11-14T09:00:00Z' },
  { name: 'Lunch 🏃🏻‍♀️ figure eight', shape: 'eight', km: 3.1, minutes: 19, date: '2026-11-15T12:45:00Z' },
  { name: 'Hill repeats', shape: 'zigzag', km: 6.4, minutes: 38, hr: 161, date: '2026-11-16T18:05:00Z' },
  { name: 'A very long title to check how the tile wraps onto two lines', shape: 'loop', km: 12.0, minutes: 66, hr: 135, date: '2026-11-17T06:50:00Z' },
];

export function mockActivities(): Activity[] {
  return RUNS.map((r, i) => ({
    id: 1000000001 + i,
    name: r.name,
    sport_type: 'Run',
    distance: r.km * 1000,
    moving_time: r.minutes * 60,
    average_heartrate: r.hr,
    start_date_local: r.date,
    map: { summary_polyline: route(r.shape) },
  }));
}
