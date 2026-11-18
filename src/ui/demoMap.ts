import type { MapLayers } from '../lib/vectorMap';

// Wymyślony zarys miasta dla kolażu na ekranie logowania: bez sieci, zawsze ten sam (płótno 1080 x 1920).
const W = 1080;
const H = 1920;
const COLS = [0, 130, 250, 390, 520, 640, 780, 900, 1030];
const ROWS = [0, 150, 290, 440, 600, 760, 1360, 1500, 1650, 1790, 1920];
const RIVER_TOP = 900;
const RIVER_W = 150;

// Deterministyczny „szum” w [-1, 1].
const jitter = (i: number) => (Math.sin(i * 12.9898) * 43758.5453) % 1;
const n = (v: number) => Math.round(v);
const riverY = (x: number) => RIVER_TOP + 120 * Math.sin(x / 260);

// Pionowa ulica w dwóch odcinkach: nad rzeką i pod nią (rzeka faluje w pasie 780-1170).
const vertical = (x: number, i: number) =>
  `M${n(x + 12 * jitter(i))} 0L${n(x + 12 * jitter(i + 50))} 740` +
  `M${n(x + 12 * jitter(i + 99))} 1200L${n(x + 12 * jitter(i + 150))} ${H}`;
const horizontal = (y: number, i: number) => `M0 ${n(y + 10 * jitter(i + 200))}L${W} ${n(y + 14 * jitter(i + 300))}`;
const rect = (x: number, y: number, w: number, h: number) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;

function river(): string {
  const xs = Array.from({ length: 28 }, (_, i) => (i * W) / 27);
  const top = xs.map((x) => `${n(x)} ${n(riverY(x))}`);
  const bottom = xs.reverse().map((x) => `${n(x)} ${n(riverY(x) + RIVER_W)}`);
  return `M${top.join('L')}L${bottom.join('L')}Z`;
}

function buildings(): string {
  const out: string[] = [];
  for (let c = 0; c < COLS.length - 1; c++) {
    for (let r = 0; r < ROWS.length - 1; r++) {
      const park = ((r === 1 || r === 2) && c >= 2 && c <= 4) || ((r === 6 || r === 7) && (c === 6 || c === 7));
      if (park) continue;
      const [x0, x1, y0, y1] = [COLS[c], COLS[c + 1], ROWS[r], ROWS[r + 1]];
      const i = c * 31 + r;
      out.push(rect(x0 + 22, y0 + 22, (x1 - x0) * 0.4, (y1 - y0) * (0.35 + 0.1 * jitter(i))));
      out.push(rect(x0 + (x1 - x0) * 0.55, y0 + 22, (x1 - x0) * 0.3, (y1 - y0) * 0.6));
    }
  }
  return out.join('');
}

export const DEMO_MAP: MapLayers = {
  water: river(),
  green: rect(250, 150, 390, 290) + rect(780, 1360, 250, 290),
  building: buildings(),
  path: `M300 200Q445 120 590 220T420 400Z`,
  minor: [...COLS.map(vertical), ...ROWS.map(horizontal)].join(''),
  mid: `M0 ${RIVER_TOP - 200}L${W} ${RIVER_TOP - 150}M0 ${RIVER_TOP + RIVER_W + 200}L${W} ${RIVER_TOP + RIVER_W + 260}`,
  // Dwie arterie przecinają rzekę (mosty).
  major: `M320 0L${W / 2} ${H}M0 1450L${W} 300`,
};
