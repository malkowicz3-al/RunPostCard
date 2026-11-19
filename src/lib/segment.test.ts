import { describe, expect, it, vi } from 'vitest';

const touch = vi.hoisted(() => {
  const close = vi.fn();
  const segment = vi.fn(() => ({
    confidenceMasks: [{ width: 2, height: 1, getAsFloat32Array: () => new Float32Array([0.1, 0.9]) }],
    close,
  }));
  return { close, segment, create: vi.fn(async () => ({ segment })) };
});
vi.mock('@mediapipe/tasks-vision', () => ({
  ImageSegmenter: {},
  InteractiveSegmenterLegacy: { createFromOptions: touch.create },
}));
vi.mock('@mediapipe/tasks-vision/vision_wasm_internal.js?url', () => ({ default: '' }));
vi.mock('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url', () => ({ default: '' }));

const { segmentObject, withTimeout, withoutTelemetry } = await import('./segment');

describe('withTimeout', () => {
  it('wynik przed limitem przechodzi, zawieszona obietnica kończy się błędem', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timeout');
  });
});

describe('withoutTelemetry', () => {
  it('odrzuca tylko metryki MediaPipe, resztę przepuszcza', async () => {
    const f = vi.fn(async () => new Response('ok'));
    const g = withoutTelemetry(f as unknown as typeof fetch);
    await expect(g('https://odml.pa.googleapis.com/v1/log', { method: 'POST' })).rejects.toThrow('telemetry');
    await expect(g(new Request('https://odml.pa.googleapis.com/v1/log'))).rejects.toThrow();
    await g('/models/selfie_multiclass_256x256.tflite');
    await g('https://www.strava.com/api/v3/athlete');
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('segmentObject', () => {
  it('model magic_touch, punkt jako keypoint, maska skopiowana, wynik zamknięty', async () => {
    const img = {} as HTMLCanvasElement;
    const out = await segmentObject(img, 0.25, 0.75);
    expect(out).toEqual({ mask: new Float32Array([0.1, 0.9]), w: 2, h: 1 });
    const [, options] = touch.create.mock.calls[0] as unknown as [unknown, { baseOptions: { modelAssetPath: string }; runningMode: string }];
    expect(options.baseOptions.modelAssetPath).toContain('magic_touch.tflite');
    expect(options.runningMode).toBe('IMAGE');
    expect(touch.segment).toHaveBeenCalledWith(img, { keypoint: { x: 0.25, y: 0.75 } });
    expect(touch.close).toHaveBeenCalled();
  });
});
