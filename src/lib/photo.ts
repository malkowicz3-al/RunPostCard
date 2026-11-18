const MAX_BYTES = 30 * 1024 * 1024;

// Dopasowanie "cover": obraz wypełnia całe płótno, nadmiar wycentrowany i ucięty.
export function coverRect(sw: number, sh: number, W = 1080, H = 1920) {
  if (sw <= 0 || sh <= 0) throw new Error('Invalid image size');
  const s = Math.max(W / sw, H / sh);
  const dw = sw * s;
  const dh = sh * s;
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

// Zdjęcie nie opuszcza przeglądarki. Ponowne zakodowanie do JPEG usuwa EXIF (w tym GPS).
export async function loadPhoto(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('Image too large');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable');
  }
  // Czarne tło pod przezroczystymi PNG, bo JPEG nie ma kanału alfa.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 1080, 1920);
  const { dx, dy, dw, dh } = coverRect(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}
