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
// scale < 1: mniejszy obraz (kolaż logowania pokazuje karty po ~200 px), wciąż rysowany na całe 1080x1920.
export async function loadPhoto(file: Blob, scale = 1): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('Image too large');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  const [W, H] = [Math.round(1080 * scale), Math.round(1920 * scale)];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable');
  }
  // Czarne tło pod przezroczystymi PNG, bo JPEG nie ma kanału alfa.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const { dx, dy, dw, dh } = coverRect(bitmap.width, bitmap.height, W, H);
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.9);
}
