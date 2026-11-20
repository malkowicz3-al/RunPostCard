import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const ITEMS = '[role="menuitem"]:not(:disabled)';

// Jeden przycisk „Download” z menu formatów; zamyka się po wyborze, Escape i kliknięciu obok.
export function DownloadMenu({
  disabled,
  onPng,
  onSvg,
  onMp4,
  onGif,
  mp4Supported,
  svgNote,
  mode,
}: {
  disabled: boolean;
  onPng: () => void;
  onSvg: () => void;
  onMp4: () => void;
  onGif: () => void;
  mp4Supported: boolean; // WebCodecs H.264; bez niego pozycja MP4 nieaktywna
  svgNote?: string; // powód braku SVG (pozycja nieaktywna)
  mode: 'still' | 'animation'; // still: PNG i SVG; animation: MP4 i GIF
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = (focus: boolean) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>(ITEMS)?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Strzałki przenoszą fokus między pozycjami menu.
  const onMenuKey = (e: ReactKeyboardEvent) => {
    // Tab zamyka menu; fokus wraca na przycisk, a domyślny Tab przenosi go dalej.
    if (e.key === 'Tab') return close(true);
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

  const choose = (action: () => void) => {
    close(true);
    action();
  };

  return (
    <div className="download" ref={rootRef}>
      <button
        ref={buttonRef}
        className="primary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        Download
      </button>
      {open && (
        <div className="download-menu" role="menu" aria-label="Download format" onKeyDown={onMenuKey}>
          <DownloadItems
            mode={mode}
            mp4Supported={mp4Supported}
            svgNote={svgNote}
            onPick={(f) => choose({ png: onPng, svg: onSvg, mp4: onMp4, gif: onGif }[f])}
          />
        </div>
      )}
    </div>
  );
}

// Pozycje menu: zdjęcie (PNG, SVG) albo animacja (MP4, GIF), wg trybu podglądu.
export function DownloadItems({
  mode,
  mp4Supported,
  svgNote,
  onPick,
}: {
  mode: 'still' | 'animation';
  mp4Supported: boolean;
  svgNote?: string;
  onPick: (format: 'png' | 'svg' | 'mp4' | 'gif') => void;
}) {
  return mode === 'still' ? (
    <>
      <button role="menuitem" tabIndex={-1} onClick={() => onPick('png')}>
        PNG image
      </button>
      <button role="menuitem" tabIndex={-1} disabled={!!svgNote} onClick={() => onPick('svg')}>
        SVG (vector){svgNote && ` (${svgNote})`}
      </button>
    </>
  ) : (
    <>
      <button role="menuitem" tabIndex={-1} disabled={!mp4Supported} onClick={() => onPick('mp4')}>
        Video (MP4){!mp4Supported && ' (not supported in this browser)'}
      </button>
      <button role="menuitem" tabIndex={-1} onClick={() => onPick('gif')}>
        GIF (animated)
      </button>
    </>
  );
}
