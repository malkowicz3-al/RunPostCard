import { DRAW_S, HOLD_S, drawFrame, renderFrames, type FrameOptions } from './animate';

type Frame = FrameOptions['frame'];
type Progress = { onProgress?: (done: number) => void; signal?: AbortSignal };

const MP4 = { width: 1080, height: 1920, fps: 30, bitrate: 8e6 };

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

export async function encodeMp4(frame: Frame, { onProgress, signal }: Progress): Promise<Blob> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny');
  const canvas = canvasOf(MP4.width, MP4.height);
  const target = new BufferTarget();
  // fastStart: indeks na początku pliku, telefony i aplikacje odtwarzają od razu.
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate: MP4.bitrate });
  output.addVideoTrack(source, { frameRate: MP4.fps });
  await output.start();
  try {
    await renderFrames({ frame, canvas, fps: MP4.fps, seconds: DRAW_S, holdSeconds: HOLD_S, onProgress, signal }, (i) =>
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
