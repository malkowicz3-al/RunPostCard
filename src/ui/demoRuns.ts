// Przykładowe biegi do kolażu na ekranie logowania: wymyślone (stałe ziarno), bez sieci i bez danych użytkownika.
// Trasy powstają w układzie świata z demoMap.ts (1 jednostka = 1 m): po grafie ulic albo krzywe szlaków w lesie.
// Świat -> lat/lng odwrotnym Mercatorem; fitRoute daje Mercatora tylko innej skali i przesunięcia, więc
// złożenie obu (toCanvas) jest dokładne i ta sama funkcja rysuje mapę pod trasą.
import { geoMercator } from 'd3-geo';
import type { Activity, RunStreams } from '../strava/api';
import { decodePolyline } from '../lib/polyline';
import { fitRoute } from '../lib/routePath';
import type { MapLayers } from '../lib/vectorMap';
import { encodePolyline } from '../dev/mockActivities';
import { ROUTE_BOX } from '../postcard/Route';
import { FOREST_X, NORTH_ROW, SOUTH_ROW, demoMap, edges, gridAt, isPark, nodePos, type Pt } from './demoMap';

export type DemoRun = { activity: Activity; streams: RunStreams; map: MapLayers };

const LAT0 = 47.2;
const BASE = geoMercator()
  .center([8.4, LAT0])
  .scale(6371000 / Math.cos((LAT0 * Math.PI) / 180))
  .translate([0, 0]);
const POINTS = 600;

// mulberry32: mały deterministyczny PRNG.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const length = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

type Kind = 'wander' | 'outback' | 'park' | 'river' | 'trail';
type Spec = { name: string; kind: Kind; km: number; pace: number; hr: number; cad: number; date: string; intervals?: boolean };

// pace: s/km. Kolejność = kolejność kart w kolażu.
const SPECS: Spec[] = [
  { name: 'Morning 10K', kind: 'wander', km: 10, pace: 320, hr: 151, cad: 86, date: '2026-11-17T07:05:00' },
  { name: 'Intervals 6x800', kind: 'wander', km: 9, pace: 300, hr: 163, cad: 89, date: '2026-11-12T18:10:00', intervals: true },
  { name: 'Easy recovery', kind: 'park', km: 6, pace: 375, hr: 136, cad: 83, date: '2026-11-16T12:30:00' },
  { name: 'Ridge trail', kind: 'trail', km: 14, pace: 430, hr: 148, cad: 80, date: '2026-11-15T08:40:00' },
  { name: 'Sunday long run', kind: 'river', km: 21, pace: 340, hr: 145, cad: 85, date: '2026-11-09T08:00:00' },
  { name: 'Lunch run', kind: 'outback', km: 6, pace: 335, hr: 146, cad: 86, date: '2026-11-13T12:15:00' },
  { name: 'Tempo 10K', kind: 'wander', km: 10, pace: 268, hr: 168, cad: 90, date: '2026-11-11T17:45:00' },
  { name: 'Bridges loop', kind: 'river', km: 12, pace: 325, hr: 149, cad: 86, date: '2026-11-08T09:20:00' },
  { name: 'Progression run', kind: 'wander', km: 15, pace: 310, hr: 155, cad: 87, date: '2026-11-06T07:30:00' },
  { name: 'Forest trail', kind: 'trail', km: 9, pace: 410, hr: 150, cad: 81, date: '2026-11-02T10:00:00' },
  { name: 'Park loops', kind: 'park', km: 8, pace: 345, hr: 142, cad: 85, date: '2026-11-04T06:50:00' },
  { name: 'Night run', kind: 'wander', km: 8, pace: 330, hr: 147, cad: 86, date: '2026-11-05T21:10:00' },
  { name: 'Hill trail', kind: 'trail', km: 18, pace: 460, hr: 152, cad: 79, date: '2026-10-31T08:15:00' },
  { name: 'Recovery jog', kind: 'outback', km: 5, pace: 390, hr: 132, cad: 82, date: '2026-10-30T07:00:00' },
  { name: 'Riverside easy', kind: 'river', km: 9, pace: 355, hr: 140, cad: 84, date: '2026-10-28T18:30:00' },
  { name: 'Half marathon practice', kind: 'wander', km: 21, pace: 305, hr: 156, cad: 88, date: '2026-10-25T08:30:00' },
  { name: 'Fartlek', kind: 'wander', km: 12, pace: 300, hr: 158, cad: 88, date: '2026-10-22T17:20:00', intervals: true },
  { name: 'Long run', kind: 'wander', km: 25, pace: 345, hr: 146, cad: 85, date: '2026-10-18T07:45:00' },
];

// Przebieg po grafie ulic: pts gęste tylko w węzłach i na łukach bulwaru.
class Walk {
  pts: Pt[];
  len = 0;
  prev?: string;
  used = new Set<string>();
  constructor(public node: string) {
    this.pts = [nodePos(node)];
  }
  step(to: string) {
    const e = edges(this.node).find((x) => x.to === to)!;
    this.pts.push(...e.pts.slice(1));
    this.len += length(e.pts);
    this.used.add([this.node, to].sort().join('|'));
    this.prev = this.node;
    this.node = to;
  }
  // Najkrótsza (w krawędziach) droga BFS; graf jest spójny dzięki mostom.
  goTo(goal: string) {
    const from = new Map<string, string>([[this.node, '']]);
    const queue = [this.node];
    for (let i = 0; !from.has(goal); i++) {
      if (i >= queue.length || i > 50000) throw new Error(`No street path to ${goal}`);
      for (const { to } of edges(queue[i])) {
        if (!from.has(to)) {
          from.set(to, queue[i]);
          queue.push(to);
        }
      }
    }
    const path: string[] = [];
    for (let n = goal; n !== this.node; n = from.get(n)!) path.unshift(n);
    for (const n of path) this.step(n);
  }
  // Losowe skręty na skrzyżowaniach: najczęściej prosto, rzadko zawracanie, nowe ulice chętniej.
  // Koniec, gdy przebiegnięte + droga powrotu (w linii prostej z zapasem na kratkę) sięga celu.
  wander(target: number, rnd: () => number, home?: Pt) {
    while (this.len + (home ? 1.3 * dist(home, nodePos(this.node)) : 0) < target) {
      const here = nodePos(this.node);
      const back = this.prev && nodePos(this.prev);
      const options = edges(this.node).filter((e) => e.to !== this.prev);
      const weights = options.map((e) => {
        const next = e.pts[1];
        const straight = back
          ? ((here[0] - back[0]) * (next[0] - here[0]) + (here[1] - back[1]) * (next[1] - here[1])) /
            (dist(back, here) * dist(here, next))
          : 0;
        const fresh = this.used.has([this.node, e.to].sort().join('|')) ? 0.2 : 1;
        return (straight > 0.7 ? 6 : 1.2) * fresh;
      });
      let r = rnd() * weights.reduce((a, b) => a + b, 0);
      const pick = options.find((_, i) => (r -= weights[i]) <= 0) ?? options[0];
      this.step(pick.to);
    }
  }
}

function cityRoute(spec: Spec, rnd: () => number): Pt[] {
  const k = Math.floor(rnd() * 24) - 6;
  const j = rnd() < 0.5 ? Math.floor(rnd() * 8) - 4 : SOUTH_ROW + Math.floor(rnd() * 8);
  const start = `g:${k}:${j}`;
  const w = new Walk(start);
  const target = spec.km * 1000;
  if (spec.kind === 'wander') {
    w.wander(target, rnd, nodePos(start));
    w.goTo(start);
  } else if (spec.kind === 'outback') {
    w.wander(target / 2, rnd);
    return [...w.pts, ...w.pts.slice(0, -1).reverse()];
  } else if (spec.kind === 'park') {
    // Kawałek miasta, kilka okrążeń najbliższego parku, powrót.
    w.wander(target * 0.45, rnd);
    const [nk, nj] = w.node.startsWith('g') ? w.node.split(':').slice(1).map(Number) : [k, j];
    const cells = Array.from({ length: 17 * 17 }, (_, c) => [nk - 8 + (c % 17), nj - 8 + Math.floor(c / 17)]);
    const [pk, pj] = cells.filter(([a, b]) => isPark(a, b)).sort((a, b) => dist(a as Pt, [nk, nj]) - dist(b as Pt, [nk, nj]))[0];
    const corners = [`g:${pk}:${pj}`, `g:${pk + 1}:${pj}`, `g:${pk + 1}:${pj + 1}`, `g:${pk}:${pj + 1}`];
    w.goTo(corners[0]);
    const laps = 3 + Math.floor(rnd() * 2);
    for (let l = 0; l < laps; l++) for (const c of [...corners.slice(1), corners[0]]) w.goTo(c);
    w.goTo(start);
  } else {
    // Kawałek miasta, bulwarem na wschód, mostem na drugi brzeg, z powrotem i do domu.
    w.wander(target * 0.15, rnd);
    const bridge = (x: number) => 3 * Math.round(x / 3);
    const k0 = bridge(+w.node.split(':')[1]);
    const span = Math.max(3, bridge((target * 0.32) / 130));
    const side = w.node.startsWith('s') || +w.node.split(':')[2] >= SOUTH_ROW ? 's' : 'n';
    const other = side === 'n' ? 's' : 'n';
    w.goTo(`${side}:${k0}`);
    for (let x = k0 + 1; x <= k0 + span; x++) w.step(`${side}:${x}`);
    w.step(`${other}:${k0 + span}`);
    for (let x = k0 + span - 1; x >= k0; x--) w.step(`${other}:${x}`);
    w.step(`${side}:${k0}`);
    w.goTo(start);
  }
  return w.pts;
}

// Krzywa Catmulla-Roma przez punkty kontrolne (gładki szlak zamiast łamanej).
function spline(ctrl: Pt[], per = 24): Pt[] {
  const at = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  const out: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let t = 0; t < per; t++) {
      const u = t / per;
      const c = (d: 0 | 1) =>
        0.5 * (2 * p1[d] + (p2[d] - p0[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u * u + (3 * p1[d] - p0[d] - 3 * p2[d] + p3[d]) * u ** 3);
      out.push([c(0), c(1)]);
    }
  }
  return [...out, ctrl[ctrl.length - 1]];
}

// Szlak w lesie: „lizak” (dojście od skraju lasu, nieregularna pętla, powrót tą samą drogą).
function trailRoute(spec: Spec, rnd: () => number): Pt[] {
  const target = spec.km * 1000;
  const R = (target * 0.7) / (2 * Math.PI);
  const head: Pt = [FOREST_X - 80, gridAt(0, Math.floor(rnd() * 8) - 6)[1]];
  const center: Pt = [head[0] - R - 300 - rnd() * 600, head[1] + (rnd() - 0.5) * 800];
  const a0 = Math.atan2(head[1] - center[1], head[0] - center[0]);
  const n = 10;
  const loop = Array.from({ length: n }, (_, i): Pt => {
    const a = a0 + ((i + (rnd() - 0.5) * 0.5) / n) * 2 * Math.PI;
    const r = R * (0.7 + 0.45 * rnd());
    return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
  });
  const mid: Pt = [(head[0] + loop[0][0]) / 2 + (rnd() - 0.5) * 300, (head[1] + loop[0][1]) / 2 + (rnd() - 0.5) * 300];
  return spline([head, mid, ...loop, loop[0], mid, head]);
}

// Równe odstępy po długości (jak próbki zegarka).
function resample(pts: Pt[], n: number): Pt[] {
  const total = length(pts);
  const out: Pt[] = [pts[0]];
  let seg = 1;
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const want = (i / (n - 1)) * total;
    while (seg < pts.length - 1 && acc + dist(pts[seg - 1], pts[seg]) < want) acc += dist(pts[seg - 1], pts[seg++]);
    const d = dist(pts[seg - 1], pts[seg]) || 1;
    const t = Math.min(1, (want - acc) / d);
    out.push([pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t]);
  }
  return out;
}

// Wysokość [m]: łagodne fale w mieście, wzgórza na zachód od skraju lasu.
function altitude([x, y]: Pt): number {
  const hills = x < FOREST_X ? Math.min(1, (FOREST_X - x) / 1500) : 0;
  return 230 + 18 * Math.sin(x / 1100 + 1) + 14 * Math.cos(y / 900) + hills * (110 + 70 * Math.sin(y / 600) * Math.sin(x / 700));
}

function build(spec: Spec, i: number): DemoRun {
  const rnd = prng(1000 + i * 7919);
  const raw = spec.kind === 'trail' ? trailRoute(spec, rnd) : cityRoute(spec, rnd);
  const clean = resample(raw, POINTS).map((p, idx, a): Pt => {
    // Zegarek ścina zakręty: średnia z sąsiadów.
    const [p0, p2] = [a[Math.max(0, idx - 1)], a[Math.min(a.length - 1, idx + 1)]];
    return [(p0[0] + 2 * p[0] + p2[0]) / 4, (p0[1] + 2 * p[1] + p2[1]) / 4];
  });
  // Szum GPS: wolno błądzący błąd kilku metrów.
  let ex = 0;
  let ey = 0;
  const noisy = clean.map(([x, y]): Pt => {
    ex = 0.85 * ex + (rnd() - 0.5) * 2.4;
    ey = 0.85 * ey + (rnd() - 0.5) * 2.4;
    return [x + ex, y + ey];
  });
  const polyline = encodePolyline(noisy.map((p) => BASE.invert!(p)!).map(([lng, lat]): [number, number] => [lat, lng]));
  const latlng = decodePolyline(polyline);

  const distance = [0];
  for (let n = 1; n < clean.length; n++) distance.push(distance[n - 1] + dist(clean[n - 1], clean[n]));
  const D = distance[distance.length - 1];
  const alt = clean.map(altitude);
  const grade = alt.map((_, n) => {
    const [a, b] = [Math.max(0, n - 3), Math.min(alt.length - 1, n + 3)];
    return (alt[b] - alt[a]) / Math.max(1, distance[b] - distance[a]);
  });
  const v0 = 1000 / spec.pace;
  const velocity = distance.map((d, n) => {
    const rep = spec.intervals ? (Math.floor(d / 400) % 2 ? 0.82 : 1.18) : 1;
    const prog = spec.name.startsWith('Progression') ? 0.92 + 0.16 * (d / D) : 1;
    return Math.max(1, v0 * rep * prog * (1 - 3 * grade[n]) * (1 + 0.04 * Math.sin(n * 1.7) * Math.cos(n * 0.31)));
  });
  const time = [0];
  for (let n = 1; n < distance.length; n++) time.push(time[n - 1] + (distance[n] - distance[n - 1]) / velocity[n]);
  const T = time[time.length - 1];
  const vMean = D / T;
  let hrNow = spec.hr - 25;
  const heartrate = velocity.map((v, n) => {
    const want = spec.hr + 28 * (v / vMean - 1) + 150 * grade[n] + 8 * (distance[n] / D - 0.5);
    hrNow += 0.08 * (want - hrNow); // tętno dogania wysiłek z opóźnieniem
    return Math.round(hrNow);
  });
  const cadence = velocity.map((v, n) => Math.round(spec.cad + 5 * (v / vMean - 1) + Math.sin(n / 9)));
  const gain = alt.reduce((s, a, n) => (n ? s + Math.max(0, a - alt[n - 1]) : 0), 0);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

  const activity: Activity = {
    id: 2000000001 + i,
    name: spec.name,
    sport_type: spec.kind === 'trail' ? 'TrailRun' : 'Run',
    distance: Math.round(D),
    moving_time: Math.round(T),
    elapsed_time: Math.round(T) + 60 + Math.floor(rnd() * 240),
    total_elevation_gain: Math.round(gain),
    average_heartrate: Math.round(mean(heartrate) * 10) / 10,
    max_heartrate: Math.max(...heartrate),
    average_speed: vMean,
    max_speed: Math.max(...velocity),
    average_cadence: Math.round(mean(cadence) * 10) / 10,
    start_date_local: spec.date + 'Z',
    map: { summary_polyline: polyline },
  };
  const streams: RunStreams = { latlng, distance, time, altitude: alt, heartrate, velocity, cadence };
  return { activity, streams, map: mapFor(polyline) };
}

// Szlaki biegów leśnych są też ścieżkami na mapie (jak prawdziwe szlaki pod trasą); to samo ziarno co w build.
const TRAILS = SPECS.flatMap((s, i) => (s.kind === 'trail' ? [trailRoute(s, prng(1000 + i * 7919))] : []));

// Mapa pod trasą w tej samej projekcji, w której Postcard rysuje trasę; okno z zapasem na podłogę 3D.
function mapFor(polyline: string): MapLayers {
  const fit = fitRoute(polyline, ROUTE_BOX)!;
  const toCanvas = (p: Pt) => fit.projection(BASE.invert!(p)!)! as Pt;
  const toWorld = (c: Pt) => BASE(fit.projection.invert!(c)!)! as Pt;
  const [a, b] = [toWorld([-150, -150]), toWorld([1230, 2070])];
  const pxPerM = dist(toCanvas([0, 0]), toCanvas([100, 0])) / 100;
  return demoMap(toCanvas, [a[0], a[1], b[0], b[1]], TRAILS, pxPerM);
}

export const DEMO_RUN_COUNT = SPECS.length;
export const demoRun = (i: number): DemoRun => build(SPECS[i], i);
export const demoRuns = (): DemoRun[] => SPECS.map(build);
