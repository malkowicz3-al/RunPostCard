import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

export type SelectOption<T extends string> = { id: T; label: string; group?: string; style?: CSSProperties };

const SPACE_BELOW = 340;

// Indeks podświetlonej pozycji po klawiszu; null, gdy klawisz nie nawiguje.
export function moveIndex(key: string, i: number, count: number): number | null {
  if (key === 'ArrowDown') return Math.min(i + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(i - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

// Własny listbox zamiast <select>: natywny nie pokaże podglądów opcji (zwłaszcza na telefonie).
// Podglądy opcji renderują się tylko przy otwartej liście.
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  preview,
  onOpen,
  className = '',
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (id: T) => void;
  preview?: (id: T) => ReactNode;
  onOpen?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  // Kolejność grup wg pierwszego wystąpienia; opcje bez grupy to jedna grupa bez nagłówka.
  const groups = [...new Set(options.map((o) => o.group))];
  // Strzałki idą w kolejności na ekranie, czyli po grupach.
  const ids = groups.flatMap((g) => options.filter((o) => o.group === g).map((o) => o.id));
  const current = options.find((o) => o.id === value);

  const close = (focus: boolean) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus();
  };

  const show = () => {
    const r = buttonRef.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < SPACE_BELOW && r.top > window.innerHeight - r.bottom);
    // Wartość spoza listy: podświetlenie od pierwszej pozycji.
    setActive(ids.includes(value) ? value : ids[0]);
    onOpen?.();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
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

  // Fokus idzie za podświetloną pozycją; focus() przewija ją też do widoku.
  useEffect(() => {
    if (open) rootRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[ids.indexOf(active)]?.focus();
  }, [open, active]);

  const choose = (id: T) => {
    close(true);
    onChange(id);
  };

  const onListKey = (e: ReactKeyboardEvent) => {
    // Tab zamyka listę; fokus wraca na przycisk, a domyślny Tab przenosi go dalej.
    if (e.key === 'Tab') return close(true);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return choose(active);
    }
    const next = moveIndex(e.key, ids.indexOf(active), ids.length);
    if (next === null) return;
    e.preventDefault();
    setActive(ids[next]);
  };

  const onButtonKey = (e: ReactKeyboardEvent) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault();
      show();
    }
  };

  const content = (o: SelectOption<T>) => (
    <>
      {preview && (
        <span className="select-preview" aria-hidden="true">
          {preview(o.id)}
        </span>
      )}
      <span className="select-label" style={o.style}>
        {o.label}
      </span>
    </>
  );

  return (
    <div className={`select ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        className="select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current?.label ?? ''}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKey}
      >
        {current && content(current)}
        <span className="select-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div id={listId} className={up ? 'select-list up' : 'select-list'} role="listbox" aria-label={label} onKeyDown={onListKey}>
          {groups.map((group) => {
            const list = options.filter((o) => o.group === group).map((o) => (
              <div
                key={o.id}
                role="option"
                tabIndex={-1}
                aria-selected={o.id === value}
                className="select-option"
                onClick={() => choose(o.id)}
                onFocus={() => setActive(o.id)}
              >
                {content(o)}
              </div>
            ));
            return group === undefined ? (
              list
            ) : (
              <div key={group} role="group" aria-label={group}>
                <div className="select-group" aria-hidden="true">
                  {group}
                </div>
                {list}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
