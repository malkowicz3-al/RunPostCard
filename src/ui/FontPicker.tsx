import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { FONTS, fontFaceRule, fontStack, type FontId } from '../lib/fonts';

const IDS = Object.keys(FONTS) as FontId[];
// Podgląd fontów: zwykłe @font-face z plików (nie data URL), bo to tylko interfejs, nie eksport.
const face = (id: FontId) => fontFaceRule(id, '/fonts/' + FONTS[id].file);
const ALL_FACES = IDS.map(face).join('');
const SPACE_BELOW = 340;

// Indeks podświetlonej pozycji po klawiszu; null, gdy klawisz nie nawiguje.
export function moveIndex(key: string, i: number, count: number): number | null {
  if (key === 'ArrowDown') return Math.min(i + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(i - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

const sampleStyle = (id: FontId) => ({ fontFamily: fontStack(id), fontWeight: FONTS[id].weight });

// Lista fontów jako własny listbox: natywny <select> nie pokazuje opcji w ich fontach (zwłaszcza na telefonie).
export function FontPicker({ font, onFont }: { font: FontId; onFont: (font: FontId) => void }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(font);
  // Wszystkie fonty (ok. 2 MB) pobieramy dopiero przy pierwszym otwarciu listy.
  const [allFaces, setAllFaces] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = (focus: boolean) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus();
  };

  const show = () => {
    const r = buttonRef.current!.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < SPACE_BELOW && r.top > window.innerHeight - r.bottom);
    setActive(font);
    setAllFaces(true);
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
    if (open) rootRef.current?.querySelector<HTMLElement>(`[data-font="${active}"]`)?.focus();
  }, [open, active]);

  const choose = (id: FontId) => {
    close(true);
    onFont(id);
  };

  const onListKey = (e: ReactKeyboardEvent) => {
    // Tab zamyka listę; fokus wraca na przycisk, a domyślny Tab przenosi go dalej.
    if (e.key === 'Tab') return close(true);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return choose(active);
    }
    const next = moveIndex(e.key, IDS.indexOf(active), IDS.length);
    if (next === null) return;
    e.preventDefault();
    setActive(IDS[next]);
  };

  const onButtonKey = (e: ReactKeyboardEvent) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) {
      e.preventDefault();
      show();
    }
  };

  const groups = [...new Set(IDS.map((id) => FONTS[id].group))];

  return (
    <div className="font-picker" ref={rootRef}>
      <style>{allFaces ? ALL_FACES : face(font)}</style>
      <button
        ref={buttonRef}
        className="font-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Font: ${FONTS[font].label}`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={onButtonKey}
      >
        <span className="font-picker-name">{FONTS[font].label}</span>
        <span className="font-picker-sample" style={sampleStyle(font)} aria-hidden="true">
          21.3
        </span>
        <span className="font-picker-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          className={up ? 'font-list up' : 'font-list'}
          role="listbox"
          aria-label="Font"
          onKeyDown={onListKey}
        >
          {groups.map((group) => (
            <div key={group} role="group" aria-label={group}>
              <div className="font-group" aria-hidden="true">
                {group}
              </div>
              {IDS.filter((id) => FONTS[id].group === group).map((id) => (
                <div
                  key={id}
                  data-font={id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={id === font}
                  className="font-option"
                  onClick={() => choose(id)}
                  onFocus={() => setActive(id)}
                >
                  <span style={sampleStyle(id)}>{FONTS[id].label}</span>
                  <span className="font-option-sample" style={sampleStyle(id)} aria-hidden="true">
                    21.3
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
