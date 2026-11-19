// Jedyne miejsce z @mediapipe/tasks-vision; ładowane przez import() dopiero po włączeniu „Behind” (ADR 0009).
import { ImageSegmenter, InteractiveSegmenterLegacy } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';

const MODEL = `${import.meta.env.BASE_URL}models/selfie_multiclass_256x256.tflite`;
const TOUCH_MODEL = `${import.meta.env.BASE_URL}models/magic_touch.tflite`;
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

// Wczytanie modelu potrafi zawisnąć (np. karta w tle); po limicie błąd, a kolejna próba zaczyna od nowa.
const LOAD_MS = 30_000;
export const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Model load timeout')), ms))]);

let segmenter: Promise<ImageSegmenter> | null = null;

function load(): Promise<ImageSegmenter> {
  segmenter ??= withTimeout(ImageSegmenter.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
    },
  ), LOAD_MS).catch((e) => {
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

let touch: Promise<InteractiveSegmenterLegacy> | null = null;

// Drugi model ładowany dopiero przy pierwszym „Pick object” (ADR 0009, decyzja 6).
function loadTouch(): Promise<InteractiveSegmenterLegacy> {
  touch ??= withTimeout(InteractiveSegmenterLegacy.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: TOUCH_MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
    },
  ), LOAD_MS).catch((e) => {
    touch = null;
    throw e;
  });
  return touch;
}

// Obiekt pod punktem (x, y w 0..1 obrazu); maska [0] to pewność „obiekt” (do sprawdzenia na prawdziwym zdjęciu).
export async function segmentObject(
  img: HTMLCanvasElement,
  x: number,
  y: number,
): Promise<{ mask: Float32Array; w: number; h: number }> {
  const result = (await loadTouch()).segment(img, { keypoint: { x, y } });
  try {
    const fg = result.confidenceMasks?.[0];
    if (!fg) throw new Error('No confidence mask');
    return { mask: fg.getAsFloat32Array().slice(), w: fg.width, h: fg.height }; // slice kopiuje przed close()
  } finally {
    result.close();
  }
}
