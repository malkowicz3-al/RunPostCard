// Jedyne miejsce z @mediapipe/tasks-vision; ładowane przez import() dopiero po włączeniu „Behind” (ADR 0009).
import { ImageSegmenter } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const MODEL = `${import.meta.env.BASE_URL}models/selfie_multiclass_256x256.tflite`;
const BACKGROUND = 0; // indeks klasy „tło” w selfie_multiclass

// MediaPipe wysyła metryki użycia (nie obrazy) fetch-em na ten adres i nie da się tego wyłączyć opcją.
// Odrzucone żądanie = biblioteka sama wyłącza logowanie; aplikacja nic nie wysyła poza Stravą (decyzja właściciela).
const TELEMETRY_HOST = 'odml.pa.googleapis.com';

export function withoutTelemetry(f: typeof fetch): typeof fetch {
  return (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (URL.canParse(url) && new URL(url).hostname === TELEMETRY_HOST) {
      return Promise.reject(new TypeError('Blocked MediaPipe telemetry'));
    }
    return f(input, init);
  };
}

// Flaga: HMR w dev ładuje moduł ponownie i nie powinien owijać fetch drugi raz.
const g = globalThis as { __noMediapipeTelemetry?: true };
if (!g.__noMediapipeTelemetry) {
  globalThis.fetch = withoutTelemetry(globalThis.fetch.bind(globalThis));
  g.__noMediapipeTelemetry = true;
}

let segmenter: Promise<ImageSegmenter> | null = null;

function load(): Promise<ImageSegmenter> {
  segmenter ??= ImageSegmenter.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
    },
  ).catch((e) => {
    segmenter = null; // kolejna próba może się udać (np. przerwane pobieranie modelu)
    throw e;
  });
  return segmenter;
}

// Pewność „osoba” = 1 − pewność tła, więc ubranie i akcesoria też wchodzą do sylwetki.
export async function segmentPerson(img: HTMLCanvasElement): Promise<{ mask: Float32Array; w: number; h: number }> {
  const result = (await load()).segment(img);
  try {
    const bg = result.confidenceMasks?.[BACKGROUND];
    if (!bg) throw new Error('No confidence mask');
    const mask = bg.getAsFloat32Array().map((p) => 1 - p); // map kopiuje przed close()
    return { mask, w: bg.width, h: bg.height };
  } finally {
    result.close();
  }
}
