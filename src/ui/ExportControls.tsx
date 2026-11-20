import { useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { download, pngBlob } from '../lib/exportPng';
import { canEncodeMp4, encodeMp4 } from '../lib/encodeVideo';

// Karta renderowana poza ekranem (odłączony div): frameAt(p) zwraca SVG klatki z postępem p.
export function offscreenFrames(render: (p: number) => ReactElement) {
  const host = document.createElement('div');
  const root = createRoot(host);
  const frameAt = (p: number) => {
    flushSync(() => root.render(render(p)));
    return host.querySelector('svg')!;
  };
  return { frameAt, unmount: () => root.unmount() };
}

// Download: PNG (zdjęcie) albo MP4 (animacja), jedyne formaty, które przyjmuje Strava; pasek postępu, Cancel i Share.
// Wspólne dla pocztówki i widoku „Together”. svg: podgląd na ekranie (PNG); frame: ta sama karta z postępem animacji, renderowana poza ekranem.
// resetKey: zmiana karty unieważnia plik do udostępnienia.
// iPhone i iPad: arkusz udostępniania zamiast pobrania, bo pobranie trafia do Plików, a z arkusza „Zachowaj obrazek/wideo”
// zapisuje prosto do Zdjęć (stamtąd dodaje się je do aktywności w Stravie). Android zostaje przy pobraniu (trafia do galerii),
// bo jego arkusz zwykle nie ma zapisu. iPadOS przedstawia się jak Mac, stąd maxTouchPoints.
export const savesViaShare = (ua: string, platform: string, touchPoints: number, canShare: boolean) =>
  canShare && (/iP(hone|ad|od)/.test(ua) || (platform === 'MacIntel' && touchPoints > 1));

export function ExportControls({
  name,
  svg,
  frame,
  resetKey,
  disabled,
  onBusy,
  mode,
}: {
  name: string; // nazwa pliku bez rozszerzenia
  svg: () => SVGSVGElement | null;
  frame: (p: number) => ReactElement;
  resetKey: unknown;
  disabled: boolean;
  onBusy?: (busy: boolean) => void; // MP4/GIF w trakcie
  mode: 'still' | 'animation'; // still: PNG; animation: MP4
}) {
  const [exportFailed, setExportFailed] = useState<string | null>(null); // format, którego nie udało się zrobić
  const [encoding, setEncoding] = useState<{ pct: number } | null>(null); // null = nie trwa
  const encodeAbort = useRef<AbortController | null>(null);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [mp4Ok, setMp4Ok] = useState(false);

  // Plik do udostępnienia dotyczy karty z chwili eksportu; po zmianie już nie.
  useEffect(() => setShareFile(null), [resetKey, mode]);

  // Po eksporcie fokus na Share, a bez niego z powrotem na Download (był wyłączony w trakcie).
  const shareRef = useRef<HTMLButtonElement>(null);
  const wasEncoding = useRef(false);
  useEffect(() => {
    if (encoding) wasEncoding.current = true;
    else if (wasEncoding.current) {
      wasEncoding.current = false;
      (shareRef.current ?? document.querySelector<HTMLButtonElement>('.download > button'))?.focus();
    }
  }, [encoding]);

  const busy = encoding !== null;
  useEffect(() => onBusy?.(busy), [busy]);

  useEffect(() => {
    canEncodeMp4().then(setMp4Ok);
  }, []);
  useEffect(() => () => encodeAbort.current?.abort(), []);

  const save = (file: File) => {
    if (!savesViaShare(navigator.userAgent, navigator.platform, navigator.maxTouchPoints, !!navigator.canShare?.({ files: [file] })))
      return download(file, file.name);
    setShareFile(file);
    // Arkusz od razu, póki przeglądarka uznaje kliknięcie (PNG jest szybkie); po długim MP4 zostaje przycisk Save or share.
    navigator.share({ files: [file] }).catch(() => {});
  };

  const downloadPng = () => {
    const el = svg();
    if (!el) return;
    setExportFailed(null);
    setShareFile(null);
    pngBlob(el)
      .then((blob) => save(new File([blob], `${name}.png`, { type: 'image/png' })))
      .catch(() => setExportFailed('PNG'));
  };

  // Klatki animacji: ta sama karta z postępem, renderowana poza ekranem (odłączony div).
  const downloadVideo = async () => {
    const frames = offscreenFrames(frame);
    const abort = new AbortController();
    encodeAbort.current = abort;
    setExportFailed(null);
    setShareFile(null);
    setEncoding({ pct: 0 });
    // Stan tylko przy zmianie pełnego procentu, nie w każdej klatce.
    const onProgress = (done: number) => {
      const pct = Math.floor(done * 100);
      setEncoding((e) => (e && e.pct !== pct ? { pct } : e));
    };
    try {
      const blob = await encodeMp4(frames.frameAt, { onProgress, signal: abort.signal });
      if (abort.signal.aborted) return; // Cancel w chwili domykania pliku
      save(new File([blob], `${name}.mp4`, { type: 'video/mp4' }));
    } catch {
      if (!abort.signal.aborted) setExportFailed('video');
    } finally {
      frames.unmount();
      if (encodeAbort.current === abort) {
        encodeAbort.current = null;
        setEncoding(null);
      }
    }
  };

  const share = () => {
    // Anulowanie arkusza udostępniania to też odrzucenie: bez komunikatu.
    if (shareFile) navigator.share({ files: [shareFile] }).catch(() => {});
  };

  const still = mode === 'still';
  return (
    <>
      <div className="download">
        <button className="primary" disabled={disabled || busy || (!still && !mp4Ok)} onClick={still ? downloadPng : downloadVideo}>
          {still ? 'Download image' : 'Download video'}
        </button>
      </div>
      {!still && !mp4Ok && <p className="hint">Video needs a browser that can encode H.264 (WebCodecs).</p>}
      {encoding !== null && (
        <div className="encoding">
          <span role="status">Creating video…</span>
          <progress value={encoding.pct} max={100} aria-label="Progress" />
          <span aria-hidden="true">{encoding.pct}%</span>
          <button autoFocus onClick={() => encodeAbort.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {shareFile && encoding === null && (
        <button ref={shareRef} onClick={share}>
          Save or share
        </button>
      )}
      {exportFailed && <p className="error">Could not create the {exportFailed}.</p>}
    </>
  );
}
