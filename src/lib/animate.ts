import { serialize } from './exportPng';

// Długość animacji (eksport MP4/GIF i podgląd na ekranie): rysowanie trasy i pauza na gotowej karcie.
export const DRAW_S = 6;
export const HOLD_S = 1.5;

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Podgląd na ekranie w pętli: DRAW_S rysowania z wygładzeniem, potem HOLD_S gotowej karty.
export function previewProgress(elapsedMs: number): number {
  const t = (elapsedMs / 1000) % (DRAW_S + HOLD_S);
  return t < DRAW_S ? easeInOutCubic(t / DRAW_S) : 1;
}

// Postęp w każdej klatce: rysowanie z wygładzeniem (ostatnia klatka = 1), potem pauza na gotowej pocztówce.
export function frameProgress(fps: number, seconds: number, holdSeconds: number): number[] {
  const draw = Math.max(1, Math.round(fps * seconds));
  const hold = Math.round(fps * holdSeconds);
  return [...Array.from({ length: draw }, (_, i) => easeInOutCubic(draw > 1 ? i / (draw - 1) : 1)), ...Array<number>(hold).fill(1)];
}

export type FrameOptions = {
  frame: (p: number) => SVGSVGElement | string; // pocztówka przy danym postępie
  canvas: HTMLCanvasElement; // tu ląduje każda klatka, w rozmiarze płótna
  fps: number;
  seconds: number;
  holdSeconds: number;
  onProgress?: (done: number) => void; // 0..1
  signal?: AbortSignal;
};

// SVG → Image → canvas, w rozmiarze płótna.
// shortcut: każda klatka to pełny SVG (z fontami i zdjęciami w data URL) serializowany i dekodowany od nowa; gdy będzie za wolno, rysować trasę wprost na canvas nad statycznym tłem.
export async function drawFrame(svg: SVGSVGElement | string, canvas: HTMLCanvasElement): Promise<void> {
  const xml = typeof svg === 'string' ? svg : serialize(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ctx = canvas.getContext('2d')!; // GIF bierze kontekst wcześniej, z willReadFrequently
    // Wideo i GIF nie mają przezroczystości: przezroczyste tło wychodzi czarne.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Klatka po klatce do canvas, potem onFrame (koder). Ta sama wartość postępu co poprzednio nie rysuje się od nowa.
export async function renderFrames(
  { frame, canvas, fps, seconds, holdSeconds, onProgress, signal }: FrameOptions,
  onFrame: (index: number, count: number) => Promise<void> | void,
): Promise<void> {
  const ps = frameProgress(fps, seconds, holdSeconds);
  let last = NaN;
  for (let i = 0; i < ps.length; i++) {
    signal?.throwIfAborted();
    if (ps[i] !== last) {
      last = ps[i];
      await drawFrame(frame(ps[i]), canvas);
    }
    await onFrame(i, ps.length);
    onProgress?.((i + 1) / ps.length);
  }
}
