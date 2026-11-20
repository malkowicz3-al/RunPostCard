import type { IsoRoute } from '../lib/isoRoute';
import type { Prop } from './decorate';

const SHIP_LIFT = 60; // statki w 3D wiszą nad podłożem (px pocztówki)
const GLOW = 'world-scifi-props-glow';
const BEAM = 'world-scifi-beam';
// shortcut: kolory Sci-fi na sztywno, bo jest jeden gatunek; przy drugim przenieść je do Genre.
const CARS = ['#2ef2ff', '#ff2bd6'];
const TRAIL = '#ff3fc8';
const SHIP = '#c8fbff';
const ENGINE = '#ff3fc8';
const HULL = '#1a1030';
const CAR_RUN = 120; // droga auta przez całą animację (px)
const SHIP_RUN = 250; // droga statku przez całą animację (px)
const DRONE_EXIT = 0.92; // od tego ułamka dron odlatuje w górę poza kadr

// Auto w animacji jedzie po swoim odcinku ulicy bez zawijania (krótki odcinek = krótsza droga, bez skoków)
// i przy progress = 1 stoi w miejscu statycznym.
export function carAt(p: Prop, progress: number): [number, number] {
  if (progress >= 1 || !p.len || !p.dir || p.x0 === undefined || p.y0 === undefined) return [p.x, p.y];
  const at = Math.max(0, Math.min(p.len, (p.x - p.x0) * p.dir[0] + (p.y - p.y0) * p.dir[1]));
  const s = at - (1 - Math.max(0, progress)) * Math.min(CAR_RUN, p.len * 0.8, at);
  return [p.x0 + p.dir[0] * s, p.y0 + p.dir[1] * s];
}

// Pojazdy świata: auto i statek po najwyżej 4 elementy, jedna wspólna poświata na grupie. progress < 1 (animacja): auta jadą,
// statki lecą, sterowiec przelatuje, dron (head = czoło trasy w px płótna) leci przy biegaczu; przy 1 obraz statyczny.
// W 3D punkt rzutujemy ręcznie (bez grupy z macierzą), żeby kształty nie były pochylone; layer dzieli auta (pod bryłami)
// i resztę (nad nimi). defs tylko w warstwie innej niż 'sky', więc dwie instancje w 3D nie dublują id.
export function Props({
  props,
  matrix,
  layer,
  progress = 1,
  head,
}: {
  props: Prop[];
  matrix?: IsoRoute['matrix'];
  layer?: 'ground' | 'sky';
  progress?: number;
  head?: [number, number];
}) {
  const shown = props.filter((p) => p.kind !== 'airship' && (!layer || (layer === 'ground') === (p.kind === 'car')));
  const airships = progress < 1 && layer !== 'ground' ? props.filter((p) => p.kind === 'airship') : [];
  const place = (x: number, y: number, angle: number): [number, number, number] => {
    if (!matrix) return [x, y, angle];
    const [a, b, c, d, e, f] = matrix;
    const rad = (angle * Math.PI) / 180;
    const [dx, dy] = [Math.cos(rad), Math.sin(rad)];
    return [a * x + c * y + e, b * x + d * y + f, Math.round((Math.atan2(b * dx + d * dy, a * dx + c * dy) * 180) / Math.PI)];
  };
  const lift = matrix ? SHIP_LIFT : 0;
  const light = Math.sin(progress * 200) > 0 ? '#ff3355' : CARS[0]; // migające światło drona i sterowca
  return (
    <>
      {layer !== 'sky' && (
        <defs>
          {/* Domyślny obszar filtra (bbox grupy + 10%): duży obszar w przestrzeni płótna rósł z kwadratem zoomu i spowalniał MP4. */}
          <filter id={GLOW}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={2.5} result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {progress < 1 && (
            <linearGradient id={BEAM} x1={0} y1={0} x2={0} y2={1}>
              <stop offset="0" stopColor={CARS[0]} stopOpacity={0.5} />
              <stop offset="1" stopColor={CARS[0]} stopOpacity={0.05} />
            </linearGradient>
          )}
        </defs>
      )}
      <g className="world-props" filter={`url(#${GLOW})`}>
        {shown.map((p, k) => {
          if (p.kind === 'car') {
            const [x, y, angle] = place(...carAt(p, progress), p.angle);
            return (
              <g key={k} transform={`translate(${x} ${y}) rotate(${angle})`}>
                <line x1={-16} y1={0} x2={-5} y2={0} stroke={TRAIL} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
                <rect x={-5} y={-2} width={10} height={4} rx={2} fill={CARS[k % 2]} />
                <circle cx={5} cy={0} r={1.5} fill="#ffffff" />
              </g>
            );
          }
          const rad = (p.angle * Math.PI) / 180;
          const off = (1 - progress) * SHIP_RUN;
          const [x, y, angle] = place(p.x - Math.cos(rad) * off, p.y - Math.sin(rad) * off, p.angle);
          return (
            <g key={k}>
              <ellipse cx={x} cy={y + 8} rx={12} ry={4} fill="#000000" opacity={0.35} />
              <g transform={`translate(${x} ${y - lift}) rotate(${angle})`}>
                {progress < 1 && (
                  <line x1={-9} y1={0} x2={-21 - 30 * (1 - progress)} y2={0} stroke={ENGINE} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
                )}
                <path d="M14 0L-10 -8L-6 0L-10 8Z" fill={SHIP} />
                <circle cx={-9} cy={0} r={3} fill={ENGINE} />
              </g>
            </g>
          );
        })}
      </g>
      {/* Sterowiec i dron poza grupą z poświatą: ich przelot i odlot rozdmuchałby obszar filtra w każdej klatce MP4. */}
      {airships.map((p, k) => {
        // Przelot w px płótna (bez macierzy): od wlotu x do lustrzanego wylotu 1080 − x, oba tuż za krawędzią.
        const ax = p.x + (1080 - 2 * p.x) * progress;
        return (
          <g key={k} transform={`translate(${ax.toFixed(1)} ${p.y}) scale(${p.angle === 180 ? -1 : 1} 1)`}>
            <path d="M-100 0L-135 -26L-125 0L-135 26Z" fill={HULL} stroke={SHIP} strokeWidth={2} />
            <ellipse cx={0} cy={0} rx={110} ry={30} fill={HULL} stroke={SHIP} strokeWidth={2} />
            <rect x={-55} y={-18} width={110} height={36} rx={4} fill={CARS[1]} opacity={0.9} />
            <line x1={-42} y1={0} x2={42} y2={0} stroke={CARS[0]} strokeWidth={5} strokeLinecap="round" />
            <circle cx={106} cy={0} r={4} fill={light} />
          </g>
        );
      })}
      {head && progress < 1 && layer !== 'ground' && <Drone head={head} progress={progress} lift={lift} light={light} />}
    </>
  );
}

// Dron kamery: nad i obok czoła trasy, lekko się kołysze, stożek reflektora na biegacza; od DRONE_EXIT odlatuje w górę.
function Drone({ head: [hx, hy], progress, lift, light }: { head: [number, number]; progress: number; lift: number; light: string }) {
  const exit = Math.max(0, (progress - DRONE_EXIT) / (1 - DRONE_EXIT));
  const x = hx + 100 + 18 * Math.sin(progress * 40);
  const y = hy - 150 - lift + 8 * Math.sin(progress * 55) - exit * exit * (hy + 400); // tuż nad górną krawędź
  const [bx, by] = [hx - x, (hy - y).toFixed(1)];
  const rotors = [-9, 9].flatMap((cx) => [-6, 6].map((cy) => `M${cx - 4} ${cy}a4 4 0 1 0 8 0a4 4 0 1 0 -8 0`)).join('');
  // Kształt ×2,5: w skali pocztówki (na telefonie ok. 1/3) mniejszy dron był tylko kropką.
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <path d={`M-12 10L12 10L${(bx + 30).toFixed(1)} ${by}L${(bx - 30).toFixed(1)} ${by}Z`} fill={`url(#${BEAM})`} opacity={1 - exit} />
      <g transform="scale(2.5)">
        <path d={rotors} fill="none" stroke={SHIP} strokeWidth={1.5} />
        <rect x={-6} y={-3} width={12} height={6} rx={2} fill={SHIP} />
        <circle cx={0} cy={4} r={2} fill={light} />
      </g>
    </g>
  );
}
