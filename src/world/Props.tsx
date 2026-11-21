import type { IsoRoute } from '../lib/isoRoute';
import type { Prop } from './decorate';

const SHIP_LIFT = 60; // statki w 3D wiszą nad podłożem (px pocztówki)

// Pojazdy świata: auto i statek po najwyżej 3 elementy, wygląd z gatunku, jedna wspólna poświata na grupie (jeśli gatunek
// ją ma). Bez animacji.
// W 3D punkt rzutujemy ręcznie (bez grupy z macierzą), żeby kształty nie były pochylone; layer dzieli auta (pod bryłami)
// i statki (nad nimi). defs tylko w warstwie innej niż 'sky', więc dwie instancje w 3D nie dublują id.
export function Props({ props, matrix, layer }: { props: Prop[]; matrix?: IsoRoute['matrix']; layer?: 'ground' | 'sky' }) {
  if (!props.length) return null;
  const { look } = props[0];
  const glow = `world-${props[0].genre}-props-glow`;
  const shown = props.filter((p) => !layer || (layer === 'ground' ? p.kind === 'car' : p.kind === 'ship'));
  const place = ({ x, y, angle }: Prop): [number, number, number] => {
    if (!matrix) return [x, y, angle];
    const [a, b, c, d, e, f] = matrix;
    const rad = (angle * Math.PI) / 180;
    const [dx, dy] = [Math.cos(rad), Math.sin(rad)];
    return [a * x + c * y + e, b * x + d * y + f, Math.round((Math.atan2(b * dx + d * dy, a * dx + c * dy) * 180) / Math.PI)];
  };
  return (
    <>
      {layer !== 'sky' && look.glow && (
        <defs>
          {/* Domyślny obszar filtra (bbox grupy + 10%): duży obszar w przestrzeni płótna rósł z kwadratem zoomu i spowalniał MP4. */}
          <filter id={glow}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={2.5} result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <g className="world-props" filter={look.glow ? `url(#${glow})` : undefined}>
        {shown.map((p, k) => {
          const [x, y, angle] = place(p);
          if (p.kind === 'car')
            return (
              <g key={k} transform={`translate(${x} ${y}) rotate(${angle})`}>
                {look.trail && <line x1={-16} y1={0} x2={-5} y2={0} stroke={look.trail} strokeWidth={2} strokeLinecap="round" opacity={0.7} />}
                <rect x={-5} y={-2} width={10} height={4} rx={2} fill={look.cars[k % look.cars.length]} />
                {look.glow && <circle cx={5} cy={0} r={1.5} fill="#ffffff" />}
              </g>
            );
          const lift = matrix ? SHIP_LIFT : 0;
          return (
            <g key={k}>
              <ellipse cx={x} cy={y + 8} rx={12} ry={4} fill="#000000" opacity={0.35} />
              <g transform={`translate(${x} ${y - lift}) rotate(${angle})`}>
                <path d="M14 0L-10 -8L-6 0L-10 8Z" fill={look.ship} />
                <circle cx={-9} cy={0} r={3} fill={look.engine} />
              </g>
            </g>
          );
        })}
      </g>
    </>
  );
}
