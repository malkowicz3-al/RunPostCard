import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Activity } from '../strava/api';
import { FONTS, fontStack, type FontId } from '../lib/fonts';
import { SlotNumber } from '../postcard/SlotNumber';
import { DATA, fitted, type LayoutItem, type SlotData } from '../postcard/slots';
import { moveIndex } from './FontPicker';

const IDS = Object.keys(DATA) as SlotData[];

type Props = {
  slot: LayoutItem | null;
  activity: Activity;
  font: FontId;
  scale: number;
  color: string;
  bg: CSSProperties;
  onPick: (data: SlotData) => void;
  onClose: () => void;
};

// Osobny komponent na każde otwarcie, żeby podświetlenie startowało od bieżących danych.
export function DataModal(props: Props) {
  return props.slot ? <Dialog key={props.slot.slot.id} {...props} slot={props.slot} /> : null;
}

function Dialog({ slot, activity, font, scale, color, bg, onPick, onClose }: Props & { slot: LayoutItem }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const current = slot.slot.data;
  const [active, setActive] = useState(() => IDS.indexOf(current));

  // showModal nie istnieje w jsdom i przy renderze na serwerze. Okno znika przez odmontowanie (bez close()),
  // więc fokus sami oddajemy elementowi, który je otworzył.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.focus();
  }, [active]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      return onPick(IDS[active]);
    }
    const next = moveIndex(e.key, active, IDS.length);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  return (
    <dialog
      ref={ref}
      className="data-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <h2 id={titleId} className="data-modal-title">
        Change: {DATA[current].menu}
      </h2>
      <div className="data-list" role="listbox" aria-label="Data" onKeyDown={onKey}>
        {IDS.map((d, i) => {
          const value = DATA[d].value(activity);
          // Podgląd jak w slocie pocztówki, dopasowany do szerokości miniatury.
          const preview: LayoutItem = { slot: { id: 'preview', data: d, form: 'number' }, x: 120, y: 50, size: 64, anchor: 'middle', maxW: 220 };
          const { size, labelSize, label } = fitted(preview, value, scale);
          return (
            <div
              key={d}
              data-index={i}
              role="option"
              tabIndex={i === active ? 0 : -1}
              aria-selected={d === current}
              aria-label={`${DATA[d].menu}: ${value}`}
              className="data-option"
              onClick={() => onPick(d)}
              onFocus={() => setActive(i)}
            >
              <span>{DATA[d].menu}</span>
              <svg
                viewBox="0 0 240 120"
                className="data-preview"
                style={bg}
                color={color}
                fontFamily={fontStack(font)}
                fontWeight={FONTS[font].weight}
                aria-hidden="true"
              >
                <SlotNumber x={120} y={50} size={size} scale={scale} labelSize={labelSize} label={label} value={value} />
              </svg>
            </div>
          );
        })}
      </div>
      <form method="dialog" className="toggle-row">
        <button className="toggle">Cancel</button>
      </form>
    </dialog>
  );
}
