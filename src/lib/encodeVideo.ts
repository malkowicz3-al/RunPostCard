import { drawFrame, renderFrames, type FrameOptions, type Under } from './animate';

type Frame = FrameOptions['frame'];
type Progress = { onProgress?: (done: number) => void; signal?: AbortSignal; under?: Under };

const MP4 = { width: 1080, height: 1920, fps: 30, bitrate: 8e6 };
// 10 kl./s: opóźnienie GIF-a w setnych sekundy wychodzi równe (100 ms), a plik mniejszy do czatów.
const GIF = { width: 432, height: 768, fps: 10 };
const DRAW_S = 6;
const HOLD_S = 1.5;

const canvasOf = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// Bez ładowania Mediabunny: sam WebCodecs mówi, czy zakoduje H.264 w 1080x1920.
export async function canEncodeMp4(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const { supported } = await VideoEncoder.isConfigSupported({
      // H.264 High, poziom 4.0: najniższy, który mieści 1080x1920 (8160 makrobloków) przy 30 kl./s.
      codec: 'avc1.640028',
      width: MP4.width,
      height: MP4.height,
      bitrate: MP4.bitrate,
      framerate: MP4.fps,
    });
    return !!supported;
  } catch {
    return false;
  }
}

export async function encodeMp4(frame: Frame, { onProgress, signal, under }: Progress): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny');
  const canvas = canvasOf(MP4.width, MP4.height);
  const target = new BufferTarget();
  // fastStart: indeks na początku pliku, telefony i aplikacje odtwarzają od razu.
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: MP4.bitrate });
  output.addVideoTrack(source, { frameRate: MP4.fps });
  await output.start();
  try {
    await renderFrames({ frame, canvas, under, fps: MP4.fps, seconds: DRAW_S, holdSeconds: HOLD_S, onProgress, signal }, (i) =>
      source.add(i / MP4.fps, 1 / MP4.fps),
    );
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  } finally {
    canvas.width = 0; // pamięć płótna od razu, nie przy GC
  }
  return new Blob([target.buffer!], { type: 'video/mp4' });
}

// Jedna paleta z gotowej pocztówki (p = 1) dla wszystkich klatek; piksele bez zmian względem poprzedniej klatki
// idą jako przezroczysty indeks (dispose 1: zostaje poprzednia klatka), więc kolejne klatki to głównie rosnąca trasa.
// Pauza na końcu to jedna klatka z długim opóźnieniem.
export async function encodeGif(frame: Frame, { onProgress, signal, under }: Progress): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const canvas = canvasOf(GIF.width, GIF.height);
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const pixels = () => ctx.getImageData(0, 0, GIF.width, GIF.height).data;
    await drawFrame(frame(1), canvas, under && ((c) => under(c, 1)));
    const colors = quantize(pixels(), 255);
    const same = colors.length; // dodatkowy indeks „bez zmian”, poza kolorami, żeby applyPalette go nie wybrał
    const palette = [...colors, [0, 0, 0]];
    const gif = GIFEncoder();
    let prev: Uint8Array | null = null;
    await renderFrames({ frame, canvas, under, fps: GIF.fps, seconds: DRAW_S, holdSeconds: 0, onProgress, signal }, (i, count) => {
      const index = applyPalette(pixels(), colors);
      const out = prev ? index.map((v, k) => (v === prev![k] ? same : v)) : index;
      prev = index;
      gif.writeFrame(out, GIF.width, GIF.height, {
        palette: i === 0 ? palette : undefined,
        delay: 1000 / GIF.fps + (i === count - 1 ? HOLD_S * 1000 : 0),
        transparent: i > 0,
        transparentIndex: same,
        dispose: 1,
      });
    });
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } finally {
    canvas.width = 0;
  }
}
