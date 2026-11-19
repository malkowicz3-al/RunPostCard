import { describe, expect, it, vi } from 'vitest';

vi.mock('@mediapipe/tasks-vision', () => ({ ImageSegmenter: {} }));
vi.mock('@mediapipe/tasks-vision/vision_wasm_internal.js?url', () => ({ default: '' }));
vi.mock('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url', () => ({ default: '' }));

const { withoutTelemetry } = await import('./segment');

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
