import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { FONTS, fontStack, type FontId } from '../lib/fonts';
import { SlotNumber } from '../postcard/SlotNumber';
import { CHARTS, DATA, fitted, slotMenu, type ChartForm, type LayoutItem, type SlotData, type SlotPick } from '../postcard/slots';
import { moveIndex } from './Select';

const NUMBERS: SlotPick[] = (Object.keys(DATA) as SlotData[]).map((data) => ({ data, form: 'number' }));
const CHART_FORMS = Object.keys(CHARTS) as ChartForm[];

type Props = {
  slot: LayoutItem | null;
  activity: Activity;
  font: FontId;
  scale: number;
  color: string;
  bg: CSSProperties;
  streams?: RunStreams | null;
  onPick: (pick: SlotPick) => void;
  onClose: () => void;
};

// Osobny komponent na każde otwarcie, żeby podświetlenie startowało od bieżących danych.
export function DataModal(props: Props) {
  return props.slot ? <Dialog key={props.slot.slot.id} {...props} slot={props.slot} /> : null;
}

function Dialog({ slot, activity, font, scale, color, bg, streams, onPick, onClose }: Props & { slot: LayoutItem }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const current = slot.slot;
  const box = slot.box;
  // Wykresy tylko w slotach z box i tylko te, na które są strumienie.
  const charts: SlotPick[] =
    box && streams ? CHART_FORMS.filter((f) => CHARTS[f].has(streams)).map((form) => ({ data: CHARTS[form].data, form })) : [];
  const options = [...NUMBERS, ...charts];
  const isCurrent = (o: SlotPick) => o.data === current.data && o.form === current.form;
  const [active, setActive] = useState(() => Math.max(0, options.findIndex(isCurrent)));

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
      return onPick(options[active]);
    }
    const next = moveIndex(e.key, active, options.length);
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
        Change: {slotMenu(current)}
      </h2>
      <div className="data-list" role="listbox" aria-label="Data" onKeyDown={onKey}>
        {(
          [
            ['Numbers', NUMBERS],
            ['Charts', charts],
          ] as const
        ).map(
          ([group, list], g) =>
            list.length > 0 && (
              <div key={group} role="group" aria-label={group}>
                <p className="data-group-title">{group}</p>
                {list.map((o, j) => {
                  const i = g === 0 ? j : NUMBERS.length + j;
                  const value = DATA[o.data].value(activity);
                  const chart = o.form === 'number' ? null : CHARTS[o.form];
                  const props = {
                    className: chart ? 'data-preview wide' : 'data-preview',
                    style: bg,
                    color,
                    fontFamily: fontStack(font),
                    fontWeight: FONTS[font].weight,
                    'aria-hidden': true,
                  } as const;
                  return (
                    <div
                      key={`${o.form}:${o.data}`}
                      data-index={i}
                      role="option"
                      tabIndex={i === active ? 0 : -1}
                      aria-selected={isCurrent(o)}
                      aria-label={chart ? chart.menu : `${DATA[o.data].menu}: ${value}`}
                      className={chart ? 'data-option chart' : 'data-option'}
                      onClick={() => onPick(o)}
                      onFocus={() => setActive(i)}
                    >
                      <span>{chart ? chart.menu : DATA[o.data].menu}</span>
                      {chart && box && streams ? (
                        // Ten sam wykres co na pocztówce, viewBox = box slotu.
                        <svg viewBox={`${box.x0} ${box.y0} ${box.x1 - box.x0} ${box.y1 - box.y0}`} {...props}>
                          <chart.Component box={box} streams={streams} activity={activity} label={chart.label} value={value} scale={scale} />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 240 120" {...props}>
                          <NumberPreview data={o.data} value={value} scale={scale} />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            ),
        )}
      </div>
      <form method="dialog" className="toggle-row">
        <button className="toggle">Cancel</button>
      </form>
    </dialog>
  );
}

// Podgląd jak w slocie pocztówki, dopasowany do szerokości miniatury. est() szacuje szerokość dla wąskiego fontu,
// szerszy (mniejsza skala) zajmuje ok. 1/scale więcej, więc granica rośnie i maleje ze skalą; 0.9 to zapas.
function NumberPreview({ data, value, scale }: { data: SlotData; value: string; scale: number }) {
  const maxW = 220 * scale * 0.9;
  const preview: LayoutItem = { slot: { id: 'preview', data, form: 'number' }, x: 120, y: 50, size: 64, anchor: 'middle', maxW };
  const { size, labelSize, label } = fitted(preview, value, scale);
  return <SlotNumber x={120} y={50} size={size} scale={scale} labelSize={labelSize} label={label} value={value} />;
}
