const MAX_BYTES = 30 * 1024 * 1024;

export type FilterId = 'none' | 'bw' | 'noir' | 'vivid' | 'dramatic' | 'sepia' | 'warm' | 'cool' | 'fade';

export const FILTERS: Record<FilterId, { label: string; css: string }> = {
  none: { label: 'None', css: 'none' },
  bw: { label: 'B&W', css: 'grayscale(1) contrast(1.1)' },
  noir: { label: 'Noir', css: 'grayscale(1) contrast(1.6) brightness(0.9)' },
  vivid: { label: 'Vivid', css: 'saturate(1.8) contrast(1.15)' },
  dramatic: { label: 'Dramatic', css: 'contrast(1.4) saturate(1.2) brightness(0.9)' },
  sepia: { label: 'Sepia', css: 'sepia(0.8)' },
  warm: { label: 'Warm', css: 'sepia(0.3) saturate(1.3) hue-rotate(-10deg)' },
  cool: { label: 'Cool', css: 'saturate(0.9) hue-rotate(15deg) brightness(1.05)' },
  fade: { label: 'Fade', css: 'contrast(0.8) brightness(1.1) saturate(0.7)' },
};

// zoom 1..4 ponad "cover"; x, y od -1 do 1 jako ułamek zapasu (1 = lewa/górna krawędź zdjęcia przy krawędzi kadru).
export type PhotoEdit = { zoom: number; x: number; y: number; filter: FilterId };
export const NO_EDIT: PhotoEdit = { zoom: 1, x: 0, y: 0, filter: 'none' };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Dopasowanie "cover": obraz wypełnia całe płótno, nadmiar wycentrowany i ucięty.
export function coverRect(sw: number, sh: number, W = 1080, H = 1920) {
  if (sw <= 0 || sh <= 0) throw new Error('Invalid image size');
  const s = Math.max(W / sw, H / sh);
  const dw = sw * s;
  const dh = sh * s;
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

// "Cover" z przybliżeniem i przesunięciem; przesunięcie przycięte, więc zdjęcie zawsze wypełnia kadr.
export function editRect(sw: number, sh: number, edit: PhotoEdit, W = 1080, H = 1920) {
  const c = coverRect(sw, sh, W, H);
  const z = clamp(edit.zoom, 1, 4);
  const dw = c.dw * z;
  const dh = c.dh * z;
  const ox = (dw - W) / 2;
  const oy = (dh - H) / 2;
  return { dx: -ox + clamp(edit.x, -1, 1) * ox, dy: -oy + clamp(edit.y, -1, 1) * oy, dw, dh };
}

// Przesunięcie o piksele kadru W x H (np. przeciągnięcie w podglądzie): zdjęcie idzie za palcem.
export function panEdit(edit: PhotoEdit, ddx: number, ddy: number, sw: number, sh: number, W: number, H: number): PhotoEdit {
  const { dw, dh } = editRect(sw, sh, edit, W, H);
  const ox = (dw - W) / 2;
  const oy = (dh - H) / 2;
  return {
    ...edit,
    x: ox > 0 ? clamp(edit.x + ddx / ox, -1, 1) : edit.x,
    y: oy > 0 ? clamp(edit.y + ddy / oy, -1, 1) : edit.y,
  };
}

export const zoomEdit = (edit: PhotoEdit, factor: number): PhotoEdit => ({ ...edit, zoom: clamp(edit.zoom * factor, 1, 4) });

// Zdjęcie nie opuszcza przeglądarki. Ponowne zakodowanie do JPEG usuwa EXIF (w tym GPS).
// scale < 1: mniejszy obraz (kolaż logowania pokazuje karty po ~200 px), wciąż rysowany na całe 1080x1920.
export async function loadPhoto(file: Blob, scale = 1, edit: PhotoEdit = NO_EDIT): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('Image too large');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return drawPhoto(bitmap, scale, edit);
  } finally {
    bitmap.close();
  }
}

// Rysowanie z już zdekodowanego obrazu (okno edycji dekoduje oryginał raz); bitmapy nie zamyka.
export function drawPhoto(bitmap: ImageBitmap, scale = 1, edit: PhotoEdit = NO_EDIT): string {
  const canvas = document.createElement('canvas');
  const [W, H] = [Math.round(1080 * scale), Math.round(1920 * scale)];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  // Czarne tło pod przezroczystymi PNG, bo JPEG nie ma kanału alfa.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const { dx, dy, dw, dh } = editRect(bitmap.width, bitmap.height, edit, W, H);
  ctx.filter = FILTERS[edit.filter].css;
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  ctx.filter = 'none';
  return canvas.toDataURL('image/jpeg', 0.9);
}
