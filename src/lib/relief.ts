import { hexToRgb, mix } from './color';
import { sampleGrid, type Dem } from './dem';
import type { IsoRoute } from './isoRoute';
import type { Rect } from './mapTiles';

// Obraz bez DOM (canvas dopiero w useTerrain), ADR 0008.
export type Pixels = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };

const HILLSHADE_Z = 2;
const SUN_ELEVATION = Math.PI / 4;
// Światło z NW: na płótnie x rośnie na wschód, y na południe.
const LIGHT = [-Math.cos(SUN_ELEVATION) / Math.SQRT2, -Math.cos(SUN_ELEVATION) / Math.SQRT2, Math.sin(SUN_ELEVATION)];
export const FLAT_SHADE = Math.sin(SUN_ELEVATION);

// Cieniowanie Horna: iloczyn normalnej ze światłem, 0..1 (płasko = FLAT_SHADE).
export function hillshade(dem: Dem): Float32Array {
  const { w, h, z } = dem;
  const cs = 8 * dem.cell * dem.mPerUnit;
  const at = (i: number, j: number) => z[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dzdx =
        (at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1) - at(i - 1, j - 1) - 2 * at(i - 1, j) - at(i - 1, j + 1)) / cs;
      const dzdy =
        (at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1) - at(i - 1, j - 1) - 2 * at(i, j - 1) - at(i + 1, j - 1)) / cs;
      const nx = -HILLSHADE_Z * dzdx;
      const ny = -HILLSHADE_Z * dzdy;
      const dot = (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / Math.hypot(nx, ny, 1);
      out[j * w + i] = Math.max(0, Math.min(1, dot));
    }
  return out;
}

// Widok płaski: cień = czarny z alfą, światło = biały z alfą, płasko = przezroczyste; 1 px na komórkę.
export function shadeOverlay(dem: Dem, shade: Float32Array): Pixels {
  const data = new Uint8ClampedArray(dem.w * dem.h * 4);
  shade.forEach((s, k) => {
    const light = s > FLAT_SHADE;
    const v = light ? 255 : 0;
    data.set([v, v, v, light ? ((s - FLAT_SHADE) / (1 - FLAT_SHADE)) * 140 : ((FLAT_SHADE - s) / FLAT_SHADE) * 190], k * 4);
  });
  return { width: dem.w, height: dem.h, data };
}

// Widok 3D: relief „voxel” jako obraz w jednostkach płótna przed kamerą. iso.matrix = [a, b, -a, b, e, f] (tylko azymut 0,
// PostcardScreen nie obraca sceny z terenem), więc kolumna
// ekranu to stałe u = x − y, a głębokość v = x + y: każdą kolumnę idziemy od przodu (duże v) do tyłu i rysujemy pionowy
// odcinek od wierzchołka próbki do najwyższego dotąd narysowanego piksela (zasłanianie bez sortowania).
export function reliefImage(
  dem: Dem,
  shade: Float32Array,
  iso: IsoRoute,
  colors: { background: string },
  maxPixels = 8e6,
): Pixels & { rect: Rect } {
  const [a, b, , , e, f] = iso.matrix;
  const lift = iso.pxPerM * iso.exaggeration;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const v of dem.z) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
  }
  // Obszar siatki (środki skrajnych komórek) na płótnie i jego rzut z zapasem na wysokości.
  const X0 = dem.x0 + dem.cell / 2;
  const Y0 = dem.y0 + dem.cell / 2;
  const X1 = dem.x0 + (dem.w - 0.5) * dem.cell;
  const Y1 = dem.y0 + (dem.h - 0.5) * dem.cell;
  const rx0 = a * (X0 - Y1) + e;
  const rx1 = a * (X1 - Y0) + e;
  const ry0 = b * (X0 + Y0) + f - Math.max(0, zMax - iso.baseM) * lift;
  const ry1 = b * (X1 + Y1) + f + Math.max(0, iso.baseM - zMin) * lift;
  const d = Math.min(2, Math.sqrt(maxPixels / ((rx1 - rx0) * (ry1 - ry0))));
  const width = Math.max(1, Math.floor((rx1 - rx0) * d));
  const height = Math.max(1, Math.floor((ry1 - ry0) * d));

  // Płasko = tło (bez szwu z prostokątem tła); światło mocniejsze na ciemnym tle (cień do czerni prawie tam nie widać).
  const bg = hexToRgb(colors.background);
  const luminance = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const light = hexToRgb(mix(colors.background, '#ffffff', 0.4 + 0.3 * (1 - luminance)));
  const dark = hexToRgb(mix(colors.background, '#000000', 0.5));
  const side = hexToRgb(mix(colors.background, '#000000', 0.35)); // ściana przedniego brzegu, jednolita (bez pionowych smug)
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (k: number, r: number, g: number, bl: number) => {
    data[k] = r;
    data[k + 1] = g;
    data[k + 2] = bl;
    data[k + 3] = 255;
  };
  for (let k = 0; k < width * height; k++) put(k * 4, bg[0], bg[1], bg[2]);

  const dv = 1 / (b * d); // krok głębokości: podłoże schodzi o ~1 px wyjścia
  for (let col = 0; col < width; col++) {
    const u = (rx0 + (col + 0.5) / d - e) / a;
    const vFrom = Math.min(2 * X1 - u, 2 * Y1 + u);
    const vTo = Math.max(2 * X0 - u, 2 * Y0 + u);
    let top = Infinity; // najwyższy narysowany wiersz w tej kolumnie
    for (let v = vFrom; v >= vTo; v -= dv) {
      const x = (u + v) / 2;
      const y = (v - u) / 2;
      const row = Math.floor((b * v + f - (sampleGrid(dem.z, dem, x, y) - iso.baseM) * lift - ry0) * d);
      if (row >= top) continue;
      const s = sampleGrid(shade, dem, x, y);
      const [to, t] = s > FLAT_SHADE ? [light, (s - FLAT_SHADE) / (1 - FLAT_SHADE)] : [dark, (FLAT_SHADE - s) / FLAT_SHADE];
      const cr = bg[0] + (to[0] - bg[0]) * t;
      const cg = bg[1] + (to[1] - bg[1]) * t;
      const cb = bg[2] + (to[2] - bg[2]) * t;
      if (top === Infinity) {
        // Pierwsza próbka kolumny (przedni brzeg obszaru): pod nią ściana boku do poziomu baseM, nie do dołu obrazu.
        const wallEnd = Math.min(height, Math.floor((b * v + f - ry0) * d) + 1);
        for (let r = Math.max(0, row + 1); r < wallEnd; r++) put((r * width + col) * 4, side[0], side[1], side[2]);
      }
      const end = Math.min(height, top === Infinity ? row + 1 : top);
      for (let r = Math.max(0, row); r < end; r++) put((r * width + col) * 4, cr, cg, cb);
      top = Math.max(0, row);
    }
  }
  return { width, height, data, rect: [rx0, ry0, rx0 + width / d, ry0 + height / d] };
}
