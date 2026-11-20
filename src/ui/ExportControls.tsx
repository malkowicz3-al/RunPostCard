import { useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { download, exportPng, exportSvg } from '../lib/exportPng';
import { canEncodeMp4, encodeGif, encodeMp4 } from '../lib/encodeVideo';
import { DownloadMenu } from './DownloadMenu';

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

// Download (PNG, SVG, MP4, GIF) z paskiem postępu, Cancel i Share; wspólne dla pocztówki i widoku „Together”.
// svg: podgląd na ekranie (PNG i SVG); frame: ta sama karta z postępem animacji, renderowana poza ekranem.
// resetKey: zmiana karty unieważnia plik do udostępnienia.
// pov: eksport POV (ADR 0011), tylko plik MP4; povNote: powód, czemu go nie ma (pozycja nieaktywna).
type Format = 'mp4' | 'gif' | 'pov';
const STATUS: Record<Format, string> = { mp4: 'Creating video…', gif: 'Creating GIF…', pov: 'Creating POV video…' };
const FAILED: Record<Format, string> = { mp4: 'video', gif: 'GIF', pov: 'POV video' };

export function ExportControls({
  name,
  svg,
  frame,
  resetKey,
  disabled,
  pov,
  povNote,
  onBusy,
  mode,
}: {
  name: string; // nazwa pliku bez rozszerzenia
  svg: () => SVGSVGElement | null;
  frame: (p: number) => ReactElement;
  resetKey: unknown;
  disabled: boolean;
  pov?: (o: { onProgress: (done: number) => void; signal: AbortSignal }) => Promise<Blob>;
  povNote?: string;
  onBusy?: (busy: boolean) => void; // MP4/GIF w trakcie
  mode: 'still' | 'animation'; // still: PNG i SVG; animation: MP4 i GIF
}) {
  const [exportFailed, setExportFailed] = useState<string | null>(null); // format, którego nie udało się zrobić
  const [encoding, setEncoding] = useState<{ format: Format; pct: number } | null>(null); // null = nie trwa
  const encodeAbort = useRef<AbortController | null>(null);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const [mp4Ok, setMp4Ok] = useState(false);

  // Plik do udostępnienia dotyczy karty z chwili eksportu; po zmianie już nie.
  useEffect(() => setShareFile(null), [resetKey]);

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

  const downloadPng = () => {
    const el = svg();
    if (!el) return;
    setExportFailed(null);
    exportPng(el, `${name}.png`).catch(() => setExportFailed('PNG'));
  };

  const downloadSvg = () => {
    const el = svg();
    if (el) exportSvg(el, `${name}.svg`);
  };

  // Klatki animacji: ta sama karta z postępem, renderowana poza ekranem (odłączony div); POV składa klatki sam.
  const downloadAnimation = async (format: Format) => {
    const frames = format === 'pov' ? null : offscreenFrames(frame);
    const abort = new AbortController();
    encodeAbort.current = abort;
    setExportFailed(null);
    setShareFile(null);
    setEncoding({ format, pct: 0 });
    // Stan tylko przy zmianie pełnego procentu, nie w każdej klatce.
    const onProgress = (done: number) => {
      const pct = Math.floor(done * 100);
      setEncoding((e) => (e && e.pct !== pct ? { ...e, pct } : e));
    };
    try {
      const opts = { onProgress, signal: abort.signal };
      const blob = !frames ? await pov!(opts) : format === 'mp4' ? await encodeMp4(frames.frameAt, opts) : await encodeGif(frames.frameAt, opts);
      if (abort.signal.aborted) return; // Cancel w chwili domykania pliku
      const file = new File([blob], format === 'pov' ? `${name}-pov.mp4` : `${name}.${format}`, { type: blob.type });
      download(file, file.name);
      if (navigator.canShare?.({ files: [file] })) setShareFile(file);
    } catch {
      if (!abort.signal.aborted) setExportFailed(FAILED[format]);
    } finally {
      frames?.unmount();
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

  return (
    <>
      <DownloadMenu
        disabled={disabled || encoding !== null}
        onPng={downloadPng}
        onSvg={downloadSvg}
        onMp4={() => downloadAnimation('mp4')}
        onGif={() => downloadAnimation('gif')}
        onPov={() => downloadAnimation('pov')}
        mp4Supported={mp4Ok}
        povSupported={!!pov}
        povNote={povNote}
        mode={mode}
      />
      {encoding !== null && (
        <div className="encoding">
          <span role="status">{STATUS[encoding.format]}</span>
          <progress value={encoding.pct} max={100} aria-label="Progress" />
          <span aria-hidden="true">{encoding.pct}%</span>
          <button autoFocus onClick={() => encodeAbort.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {shareFile && encoding === null && (
        <button ref={shareRef} onClick={share}>
          Share
        </button>
      )}
      {exportFailed && <p className="error">Could not create the {exportFailed}.</p>}
    </>
  );
}
