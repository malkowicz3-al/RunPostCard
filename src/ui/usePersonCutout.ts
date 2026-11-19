import { useEffect, useState } from 'react';
import { cropSquare, cutoutPixels, personBox } from '../lib/cutout';
import type { Rect } from '../lib/mapTiles';

export type Person = { href: string; rect: Rect };

const W = 1080;
const H = 1920;
const PASS1: [number, number] = [270, 480];
const PASS2 = 256;

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

const free = (...cs: HTMLCanvasElement[]) => cs.forEach((c) => (c.width = c.height = 0));

// Wycinanka osoby (PNG z alfą) w prostokącie płótna 1080x1920; null gdy brak osoby.
async function cutout(href: string): Promise<Person | null> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const photo = canvas(W, H);
  const ctx = photo.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const small = canvas(...PASS1);
  const square = canvas(PASS2, PASS2);
  let out: HTMLCanvasElement | null = null;
  try {
    small.getContext('2d')!.drawImage(photo, 0, 0, ...PASS1);
    const { segmentPerson } = await import('../lib/segment');
    const first = await segmentPerson(small);
    const box = personBox(first.mask, first.w, first.h);
    if (!box) return null;
    const sx = W / first.w;
    const sy = H / first.h;
    const rect = cropSquare([box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy], W, H);
    const side = rect[2] - rect[0];
    // Przebieg 2 na samym kwadracie: 256 px maski na osobę zamiast ~100 px z całego zdjęcia.
    square.getContext('2d')!.drawImage(photo, rect[0], rect[1], side, side, 0, 0, PASS2, PASS2);
    const second = await segmentPerson(square);
    const pixels = ctx.getImageData(rect[0], rect[1], side, side);
    cutoutPixels(pixels.data, side, second.mask, second.w, second.h);
    out = canvas(side, side);
    out.getContext('2d')!.putImageData(pixels, 0, 0);
    return { href: out.toDataURL('image/png'), rect };
  } finally {
    free(photo, small, square, ...(out ? [out] : []));
  }
}

// href: dla jakiego zdjęcia jest wynik (stara wycinanka po zmianie zdjęcia nie wycieka ani na jeden render).
type Loaded = { person: Person | null; href: string };

export function usePersonCutout(photoHref: string | undefined, enabled: boolean): { person: Person | null; loading: boolean } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const active = enabled && !!photoHref;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    cutout(photoHref!).then(
      (person) => !cancelled && setLoaded({ person, href: photoHref! }),
      (e) => {
        console.warn('Person cutout failed', e);
        if (!cancelled) setLoaded({ person: null, href: photoHref! });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [photoHref, active]);

  if (!active) return { person: null, loading: false };
  return loaded?.href === photoHref ? { person: loaded.person, loading: false } : { person: null, loading: true };
}
