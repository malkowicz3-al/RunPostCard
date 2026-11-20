import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

// Escape zamyka arkusz tylko, gdy nie ma nad nim otwartego okna ani rozwiniętej listy/menu (te zamykają się same).
export const closesSheet = (key: string, dialogOpen: boolean, listOpen: boolean) => key === 'Escape' && !dialogOpen && !listOpen;

// Panel „Style”: od 900 px stała kolumna obok pocztówki; węższy ekran: arkusz od dołu otwierany pływającym przyciskiem (CSS).
export function StyleSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    // Fokus do arkusza po otwarciu i z powrotem na Style po zamknięciu (przycisk Style znika, arkusz chowa się visibility).
    if (open) done.current?.focus();
    else if (opened.current) fab.current?.focus();
    opened.current ||= open;
    if (!open) return;
    // Escape w otwartym oknie (Change, edycja zdjęcia), liście albo menu Download zamyka tylko je.
    const onKey = (e: KeyboardEvent) => {
      if (closesSheet(e.key, !!document.querySelector('dialog[open]'), !!panel.current?.querySelector('[aria-expanded="true"]')))
        setOpen(false);
    };
    // Faza przechwytywania: lista sprawdzana, zanim jej własny Escape ją zamknie.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <>
      <div className="style-panel" id={id} data-open={open} ref={panel} role="region" aria-labelledby={`${id}-title`}>
        <div className="panel-head">
          <h2 className="panel-title" id={`${id}-title`}>
            Style
          </h2>
          <button className="text-button sheet-close" ref={done} onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
        {children}
      </div>
      <button className="style-fab" ref={fab} aria-controls={id} aria-expanded={open} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        Style
      </button>
    </>
  );
}
