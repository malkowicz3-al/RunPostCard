import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { FILTERS, NO_EDIT, drawPhoto, panEdit, zoomEdit, type FilterId, type PhotoEdit } from '../lib/photo';

const FILTER_IDS = Object.keys(FILTERS) as FilterId[];

type Props = {
  file: Blob | null;
  initial: PhotoEdit;
  onApply: (edit: PhotoEdit) => void;
  onClose: () => void;
};

// Osobny komponent na każde otwarcie, żeby edycja startowała od bieżącej.
export function PhotoEditor(props: Props) {
  return props.file ? <Dialog {...props} file={props.file} /> : null;
}

function Dialog({ file, initial, onApply, onClose }: Props & { file: Blob }) {
  const ref = useRef<HTMLDialogElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [edit, setEdit] = useState(initial);
  const [preview, setPreview] = useState<string>();
  const [thumb, setThumb] = useState<string>();
  const [bitmap, setBitmap] = useState<ImageBitmap>();
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Jak w DataModal: showModal brak w jsdom; fokus oddajemy sami, bo okno znika przez odmontowanie.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
    return () => opener?.focus?.();
  }, []);

  // Oryginał dekodowany raz na otwarcie: z niego podgląd, wymiary do przeciągania i miniatura kafelków (filtr w CSS).
  useEffect(() => {
    let live = true;
    let bmp: ImageBitmap | undefined;
    createImageBitmap(file, { imageOrientation: 'from-image' })
      .then((b) => {
        if (!live) return b.close();
        bmp = b;
        setBitmap(b);
        setThumb(drawPhoto(b, 0.12));
      })
      .catch(() => {});
    return () => {
      live = false;
      bmp?.close();
    };
  }, [file]);

  // Podgląd tą samą funkcją co wynik, nie częściej niż co ~80 ms, zawsze z ostatnią edycją.
  // drawPhoto jest synchroniczne, więc kolejne rysowanie nie zacznie się przed końcem poprzedniego.
  const latest = useRef(edit);
  const timer = useRef<number>(undefined);
  useEffect(() => {
    latest.current = edit;
    if (!bitmap || timer.current !== undefined) return;
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      try {
        setPreview(drawPhoto(bitmap, 0.35, latest.current));
      } catch {
        // brak canvas: zostaje poprzedni podgląd
      }
    }, 80);
  }, [bitmap, edit]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Kółko bez Ctrl też przybliża; passive: false, żeby nie przewijać okna.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setEdit((ed) => zoomEdit(ed, Math.exp(-e.deltaY * 0.002)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) setEdit((ed) => zoomEdit(ed, after / before));
    } else if (ps.size === 1) {
      pan(next.x - prev.x, next.y - prev.y);
    }
    ps.set(e.pointerId, next);
  };

  const pan = (ddx: number, ddy: number) => {
    const r = previewRef.current?.getBoundingClientRect();
    if (bitmap && r) setEdit((ed) => panEdit(ed, ddx, ddy, bitmap.width, bitmap.height, r.width, r.height));
  };

  const onKey = (e: ReactKeyboardEvent) => {
    const step: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    pan(...d);
  };

  // Zamknięcie klikiem w tło tylko, gdy i wciśnięcie, i klik były poza oknem (nie koniec przeciągania, nie margines okna).
  const downOnBackdrop = useRef(false);
  const outside = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  return (
    <dialog
      ref={ref}
      className="data-modal photo-editor"
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget && outside(e))}
      onClick={(e) => e.target === e.currentTarget && downOnBackdrop.current && outside(e) && onClose()}
    >
      <h2 id={titleId} className="data-modal-title">
        Edit photo
      </h2>
      <div
        ref={previewRef}
        className="photo-editor-preview"
        role="group"
        tabIndex={0}
        aria-label="Photo position, use arrow keys to move. Drag to move, scroll or pinch to zoom."
        onKeyDown={onKey}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {preview && <img src={preview} alt="" draggable={false} />}
      </div>
      <label className="zoom-control">
        Zoom
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={edit.zoom}
          onChange={(e) => setEdit((ed) => ({ ...ed, zoom: Number(e.target.value) }))}
        />
      </label>
      <div className="photo-filters" role="group" aria-label="Color preset">
        {FILTER_IDS.map((f) => (
          <button
            key={f}
            type="button"
            className="photo-filter"
            aria-pressed={edit.filter === f}
            onClick={() => setEdit((ed) => ({ ...ed, filter: f }))}
          >
            <span className="photo-filter-thumb" aria-hidden="true">
              {thumb && <img src={thumb} alt="" style={{ filter: FILTERS[f].css }} />}
            </span>
            {FILTERS[f].label}
          </button>
        ))}
      </div>
      <form method="dialog" className="toggle-row">
        <button type="button" className="toggle" onClick={() => setEdit(NO_EDIT)}>
          Reset
        </button>
        <button className="toggle">Cancel</button>
        <button type="button" className="primary" onClick={() => onApply(edit)}>
          Apply
        </button>
      </form>
    </dialog>
  );
}
