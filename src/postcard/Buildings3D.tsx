import { Fragment, memo, useMemo } from 'react';
import { mix } from '../lib/color';
import type { IsoRoute } from '../lib/isoRoute';
import type { Building } from '../lib/vectorMap';

// W skali pocztówki 20 m to tylko kilka px; podbicie niezależne od przewyższenia trasy.
const BUILDING_EXAGGERATION = 1.5;

type Solid = { y: number; left: string; right: string; roof: string };

// Bryły w przestrzeni ekranu (pod kamerą, jak trasa): obrys przez macierz izometrii, dach wyżej o wysokość.
// Algorytm malarza: od tyłu (mniejsze y podstawy) do przodu; ściany tylko od strony widza. Bez <defs>, więc
// kilka pocztówek na stronie nie koliduje id.
export const Buildings3D = memo(function Buildings3D({
  buildings,
  matrix: [a, b, c, d, e, f],
  pxPerM,
  color,
  fill,
  filter,
}: {
  buildings: Building[];
  matrix: IsoRoute['matrix'];
  pxPerM: number;
  color: string; // colors.building (hex): z niego odcienie ścian
  fill?: string; // farba dachu (np. url(#kreskowanie)); domyślnie color
  filter?: string;
}) {
  const solids = useMemo(() => {
    const s = pxPerM * BUILDING_EXAGGERATION;
    const out: Solid[] = buildings.map(({ ring, h, min }) => {
      const base = ring.map(([x, y]): [number, number] => [a * x + c * y + e, b * x + d * y + f - min * s]);
      const lift = (h - min) * s;
      let area = 0;
      let maxY = -Infinity;
      for (let i = 0, j = base.length - 1; i < base.length; j = i++) {
        area += base[j][0] * base[i][1] - base[i][0] * base[j][1];
        if (base[i][1] > maxY) maxY = base[i][1];
      }
      const sign = Math.sign(area);
      let left = '';
      let right = '';
      for (let i = 0; i < base.length; i++) {
        const [x0, y0] = base[i];
        const [x1, y1] = base[(i + 1) % base.length];
        // Normalna na zewnątrz = sign · (dy, -dx); ściana widoczna, gdy skierowana w dół ekranu.
        if (sign * (x0 - x1) <= 0) continue;
        const quad = `M${p(x0)} ${p(y0)}L${p(x1)} ${p(y1)}L${p(x1)} ${p(y1 - lift)}L${p(x0)} ${p(y0 - lift)}Z`;
        if (sign * (y1 - y0) < 0) left += quad;
        else right += quad;
      }
      const roof = 'M' + base.map(([x, y]) => `${p(x)} ${p(y - lift)}`).join('L') + 'Z';
      // Klucz: najniższy punkt rzutu na podłoże + wysokość dołu, więc część na podium idzie po podium.
      return { y: maxY + 2 * min * s, left, right, roof };
    });
    return out.sort((u, v) => u.y - v.y);
  }, [buildings, a, b, c, d, e, f, pxPerM]);

  const leftColor = mix(color, '#000000', 0.45);
  const rightColor = mix(color, '#000000', 0.25);
  return (
    <g filter={filter}>
      {solids.map((s, i) => (
        <Fragment key={i}>
          {s.left && <path d={s.left} fill={leftColor} />}
          {s.right && <path d={s.right} fill={rightColor} />}
          <path d={s.roof} fill={fill ?? color} />
        </Fragment>
      ))}
    </g>
  );
});

const p = (v: number) => v.toFixed(1);
