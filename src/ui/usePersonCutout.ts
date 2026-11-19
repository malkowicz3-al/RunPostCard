import { useEffect, useState } from 'react';
import { cropSquare, cutoutPixels, gridFromCutout, personBox, type Cutout } from '../lib/cutout';

export type Tap = { x: number; y: number }; // punkt na zdjęciu, 0..1

const W = 1080;
const H = 1920;
const PASS1: [number, number] = [270, 480];
// Klik wskazuje dowolny, także mały obiekt: większy pierwszy przebieg.
const PASS1_TAP: [number, number] = [540, 960];
const PASS2 = 256;

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

const free = (...cs: HTMLCanvasElement[]) => cs.forEach((c) => (c.width = c.height = 0));

// Wycinanka osoby albo obiektu pod tap (PNG z alfą) w prostokącie płótna 1080x1920; null gdy nic nie znaleziono.
export async function cutout(href: string, tap: Tap | null): Promise<Cutout | null> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const photo = canvas(W, H);
  const ctx = photo.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const pass1 = tap ? PASS1_TAP : PASS1;
  const small = canvas(...pass1);
  const square = canvas(PASS2, PASS2);
  let out: HTMLCanvasElement | null = null;
  try {
    small.getContext('2d')!.drawImage(photo, 0, 0, ...pass1);
    const { segmentObject, segmentPerson } = await import('../lib/segment');
    const first = tap ? await segmentObject(small, tap.x, tap.y) : await segmentPerson(small);
    const box = personBox(first.mask, first.w, first.h);
    if (!box) return null;
    const sx = W / first.w;
    const sy = H / first.h;
    const rect = cropSquare([box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy], W, H);
    const side = rect[2] - rect[0];
    // Przebieg 2 na samym kwadracie: 256 px maski na osobę zamiast ~100 px z całego zdjęcia.
    square.getContext('2d')!.drawImage(photo, rect[0], rect[1], side, side, 0, 0, PASS2, PASS2);
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
    const second = tap
      ? await segmentObject(square, clamp01((tap.x * W - rect[0]) / side), clamp01((tap.y * H - rect[1]) / side))
      : await segmentPerson(square);
    const pixels = ctx.getImageData(rect[0], rect[1], side, side);
    cutoutPixels(pixels.data, side, second.mask, second.w, second.h);
    out = canvas(side, side);
    out.getContext('2d')!.putImageData(pixels, 0, 0);
    return { href: out.toDataURL('image/png'), rect, grid: gridFromCutout(pixels.data, rect) };
  } finally {
    free(photo, small, square, ...(out ? [out] : []));
  }
}

// none: na zdjęciu nie ma osoby; error: model lub obraz się nie wczytał (ponowne włączenie próbuje od nowa).
export type CutoutFailure = 'none' | 'error';
// href i tap: dla jakiego zdjęcia i punktu jest wynik (stara wycinanka nie wycieka ani na jeden render).
type Loaded = { person: Cutout | null; href: string; tap: Tap | null; failed?: CutoutFailure };

export function usePersonCutout(
  photoHref: string | undefined,
  enabled: boolean,
  tap: Tap | null,
): { person: Cutout | null; loading: boolean; failed?: CutoutFailure } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const active = enabled && !!photoHref;
  const tx = tap?.x;
  const ty = tap?.y;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoaded(null); // po wyłączeniu i włączeniu: znów „Finding runner…”, nie stary błąd
    const at = tx === undefined || ty === undefined ? null : { x: tx, y: ty };
    cutout(photoHref!, at).then(
      (person) => !cancelled && setLoaded({ person, href: photoHref!, tap: at, failed: person ? undefined : 'none' }),
      (e) => {
        console.warn('Person cutout failed', e);
        if (!cancelled) setLoaded({ person: null, href: photoHref!, tap: at, failed: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [photoHref, active, tx, ty]);

  if (!active) return { person: null, loading: false };
  return loaded?.href === photoHref && loaded.tap?.x === tx && loaded.tap?.y === ty
    ? { person: loaded.person, loading: false, failed: loaded.failed }
    : { person: null, loading: true };
}
