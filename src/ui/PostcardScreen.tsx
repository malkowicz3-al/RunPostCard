import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
import { ROUTE_BOX } from '../postcard/Route';
import { CAMERA_CENTER, DEFAULT_CAMERA, clampCamera, keepCamera, type Camera } from '../lib/camera';
import { backdropArea, nextBackdropArea, type LoadedArea } from '../lib/backdrop';
import { exportPng, exportSvg } from '../lib/exportPng';
import { DEFAULT_FONT, FONTS, loadFontCss, type FontId } from '../lib/fonts';
import { loadPhoto } from '../lib/photo';
import { isoRoute } from '../lib/isoRoute';
import { fitRoute } from '../lib/routePath';
import { zoomRegion } from '../lib/zoomRegion';
import { POSTCARD_DETAILED } from '../lib/vectorMap';
import { DATA, resolveLayout, slotBox, slotMenu, swapSlot, type LayoutId, type Overrides, type SlotPick } from '../postcard/slots';
import { THEMES, type ThemeId } from '../postcard/themes';
import { DEFAULT_ACCENT } from '../postcard/themes/neon';
import { DataModal } from './DataModal';
import { DownloadMenu } from './DownloadMenu';
import { FontPicker } from './FontPicker';
import { LayoutPicker } from './LayoutPicker';
import { LookPicker, type Look } from './LookPicker';
import { MapBackdrop } from './MapBackdrop';
import { useMapLayers } from './useMapLayers';
import { useRegionLayers } from './useRegionLayers';
import { useRunStreams } from './useRunStreams';

const SIZE: [number, number] = [1080, 1920];
const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
const CANVAS: [number, number, number, number] = [0, 0, 1080, 1920];
const UNBOUNDED: [number, number, number, number] = [-Infinity, -Infinity, Infinity, Infinity];

type Point = { x: number; y: number };

// Czy puszczenie wskaźnika (albo klik) otwiera okno danych slotu: klawiatura zawsze, wskaźnik tylko bez przeciągania i szczypania.
export function shouldOpenSlot({
  down,
  up,
  multiTouch,
  keyboard,
}: {
  down: Point | null;
  up: Point;
  multiTouch: boolean;
  keyboard: boolean;
}): boolean {
  if (keyboard) return true;
  return !multiTouch && !!down && Math.hypot(up.x - down.x, up.y - down.y) <= 6;
}

// Kolory podglądu w oknie danych: to samo tło i kolor tekstu co pocztówka (bez ziarna i filtrów).
function previewColors(look: Look, accent: string, photo?: string): { color: string; bg: CSSProperties } {
  if (look in THEMES) {
    const theme = THEMES[look as ThemeId];
    return { color: theme.render({}, { accent }).text.color, bg: { background: theme.style({ accent }).background } };
  }
  if (look === 'photo' && photo) {
    return { color: '#ffffff', bg: { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' } };
  }
  if (look === 'transparent') {
    return { color: '#ffffff', bg: { background: 'conic-gradient(#3a3a3f 25%, #2c2c30 0 50%, #3a3a3f 0 75%, #2c2c30 0) 0 0 / 16px 16px' } };
  }
  return { color: '#ffffff', bg: { background: 'linear-gradient(#1e1b4b, #f97316)' } };
}

export function PostcardScreen({
  activity,
  onBack,
  onSessionExpired,
}: {
  activity: Activity;
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [font, setFont] = useState<FontId>(DEFAULT_FONT);
  // Stary CSS zostaje, dopóki nowy się nie wczyta; id mówi, dla którego fontu jest.
  const [fontCss, setFontCss] = useState<{ id: FontId; css?: string }>();
  const fontReady = fontCss?.id === font;
  const [photo, setPhoto] = useState<string>();
  const [dim, setDim] = useState(35);
  const [photoError, setPhotoError] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [look, setLook] = useState<Look>('gradient');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [mapFailed, setMapFailed] = useState(false);
  const [view, setView] = useState<'flat' | '3d'>('flat');
  const [layoutId, setLayoutId] = useState<LayoutId>('classic');
  const [overrides, setOverrides] = useState<Partial<Record<LayoutId, Overrides>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const items = useMemo(() => resolveLayout(layoutId, overrides[layoutId]), [layoutId, overrides]);
  const editingItem = items.find((i) => i.slot.id === editing) ?? null;
  // Miejsce wciśnięcia: przeciągnięcie (np. przesuwanie 3D) nie otwiera okna danych.
  const tap = useRef<{ x: number; y: number; id: string | null } | null>(null);
  // Drugi palec w trakcie gestu: aż do puszczenia wszystkich to szczypanie, nie dotknięcie.
  const multiTouch = useRef(false);
  const streams = useRunStreams(activity, onSessionExpired);
  const isMap = look in THEMES;
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  // 3D liczy się na płaskiej projekcji trasy, więc bez niej przycisk nie ma sensu.
  const has3d = !!streams?.altitude && fit !== null;
  const is3d = view === '3d' && has3d;
  const profile = POSTCARD_DETAILED;
  const map = useMapLayers(fit?.projection ?? null, SIZE, profile, isMap);
  const mapMissing = isMap && !map.layers;
  const mapLoading = isMap && (!map.layers || map.loading);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const moved = camera.zoom !== 1 || camera.x !== 0 || camera.y !== 0;
  // Aktywne wskaźniki nad podglądem (1 = przesuwanie, 2 = szczypanie).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Zmiany kamery z kółka i przeciągania zbieramy i stosujemy raz na klatkę (render długiego biegu jest drogi).
  const frame = useRef(0);
  const queued = useRef<((c: Camera) => Camera)[]>([]);
  const moveCamera = (fn: (c: Camera) => Camera) => {
    queued.current.push(fn);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const fns = queued.current;
      queued.current = [];
      setCamera((c) => keepCamera(c, fns.reduce((acc, f) => clampCamera(f(acc)), c)));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Ostrzejszą mapę doczytujemy dopiero, gdy kamera stoi (bez zapytań w trakcie przesuwania).
  const [settled, setSettled] = useState<Camera>(DEFAULT_CAMERA);
  useEffect(() => {
    const t = setTimeout(() => setSettled(camera), 300);
    return () => clearTimeout(t);
  }, [camera]);
  const iso = useMemo(
    () => (is3d && streams && fit ? isoRoute(streams, ROUTE_BOX, fit.projection) : null),
    [is3d, streams, fit],
  );
  // Płasko: macierz jednostkowa, fragment może wyjść poza płótno (przesunięta kamera); przy zoomie < 1,5 tylko obszar
  // widocznej ramki na poziomie pocztówki (loadRegionLayers zwraca null, gdy cały mieści się na płótnie).
  const regionArea = useRef<LoadedArea | null>(null);
  const region = useMemo(() => {
    if (!isMap) return null;
    const matrix = iso?.matrix ?? IDENTITY;
    // 3D: podłoga bez wygaszania, więc widoczną część poza płótnem doczytujemy zawsze (także przy kamerze domyślnej).
    if (!iso) {
      // Płasko: widok w całości na płótnie = mapa bazowa wystarcza (bez drugiej kopii w eksporcie).
      const [x0, y0, x1, y1] = backdropArea(CANVAS, settled, 0);
      if (settled.zoom < 1.5 && x0 >= 0 && y0 >= 0 && x1 <= SIZE[0] && y1 <= SIZE[1]) return null;
    }
    // Małe przesunięcie w doczytanym obszarze zostawia go (bez nowego zapytania), jak w tle ekranu.
    if (settled.zoom < 1.5) return (regionArea.current = nextBackdropArea(regionArea.current, CANVAS, settled, matrix));
    return zoomRegion(settled, matrix, CAMERA_CENTER, SIZE, 0.15, UNBOUNDED);
  }, [iso, isMap, settled]);
  const zoomed = useRegionLayers(fit?.projection ?? null, region, profile, isMap);
  const loading = mapLoading || zoomed.loading;

  useEffect(() => {
    let cancelled = false;
    loadFontCss(font).then((css) => {
      if (!cancelled) setFontCss({ id: font, css });
    });
    return () => {
      cancelled = true;
    };
  }, [font]);

  // settled razem z kamerą, żeby stary zoom nie doczytywał fragmentu przez 300 ms.
  useEffect(() => {
    setCamera(DEFAULT_CAMERA);
    setSettled(DEFAULT_CAMERA);
  }, [activity, is3d]);

  // Płasko przy zoomie 1 nie ma czego przesuwać: kółko i palec przewijają stronę (ctrl+kółko i szczypanie nadal przybliżają).
  const scrollsPage = !is3d && camera.zoom <= 1;
  // Listener nie-pasywny, żeby preventDefault blokował przewijanie strony; is3d w zależnościach przez scrollsPage.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!fit || (scrollsPage && !e.ctrlKey)) return;
      e.preventDefault();
      moveCamera((c) => ({ ...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.002) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [is3d, fit, scrollsPage]);

  useEffect(() => setEditing(null), [activity]);

  const opens = (e: { clientX: number; clientY: number }, keyboard = false) =>
    shouldOpenSlot({ down: tap.current, up: { x: e.clientX, y: e.clientY }, multiTouch: multiTouch.current, keyboard });

  const onPointerDown = (e: ReactPointerEvent) => {
    if (pointers.current.size > 0) multiTouch.current = true;
    const hit = (e.target as Element).closest?.('[data-slot]');
    tap.current = { x: e.clientX, y: e.clientY, id: hit?.getAttribute('data-slot') ?? null };
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const all = pointers.current;
    const prev = all.get(e.pointerId);
    const svg = currentSvg();
    if (!prev || !svg) return;
    const next = { x: e.clientX, y: e.clientY };
    const units = SIZE[0] / svg.getBoundingClientRect().width; // px ekranu -> jednostki SVG
    const other = [...all].find(([id]) => id !== e.pointerId)?.[1];
    if (all.size === 1) {
      moveCamera((c) => ({ ...c, x: c.x + (next.x - prev.x) * units, y: c.y + (next.y - prev.y) * units }));
    } else if (other) {
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) moveCamera((c) => ({ ...c, zoom: (c.zoom * after) / before }));
    }
    all.set(e.pointerId, next);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    // Ramka przechwytuje wskaźnik, więc klik może nie dojść do przycisku slotu; dotknięcie łapiemy tutaj.
    const id = tap.current?.id;
    if (e.type === 'pointerup' && id && opens(e)) setEditing(id);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) multiTouch.current = false;
  };

  // e.detail === 0: klawiatura (Enter/Spacja), bez wskaźnika.
  const onSlotClick = (e: ReactMouseEvent, id: string) => {
    if (opens(e, e.detail === 0)) setEditing(id);
  };

  const pick = (p: SlotPick) => {
    if (editing) setOverrides((o) => ({ ...o, [layoutId]: swapSlot(items, editing, p) }));
    setEditing(null);
  };
  const scale = FONTS[font].scale;
  // Bez wczytanej mapy pocztówka ma gradient, więc podgląd też.
  const preview = previewColors(mapMissing ? 'gradient' : look, accent, photo);

  // Przy błędzie mapy wracamy do gradientu.
  useEffect(() => {
    if (!map.failed) return;
    setMapFailed(true);
    setLook('gradient');
  }, [map.failed]);

  const currentSvg = () => previewRef.current?.querySelector('svg') ?? null;

  const downloadPng = () => {
    const svg = currentSvg();
    if (!svg) return;
    setExportFailed(false);
    exportPng(svg, `runpostcard-${activity.id}.png`).catch(() => setExportFailed(true));
  };

  const downloadSvg = () => {
    const svg = currentSvg();
    if (svg) exportSvg(svg, `runpostcard-${activity.id}.svg`);
  };

  const choose = (value: Look) => {
    setMapFailed(false);
    setLook(value);
    if (value in THEMES) setFont(THEMES[value as ThemeId].font);
  };

  // Przy błędzie zostaje poprzednie zdjęcie i wygląd.
  const choosePhoto = (file: File) => {
    setPhotoBusy(true);
    loadPhoto(file)
      .then((url) => {
        setPhoto(url);
        choose('photo');
        setPhotoError(false);
      })
      .catch(() => setPhotoError(true))
      .finally(() => setPhotoBusy(false));
  };

  // Tło ekranu tylko przy motywie mapy i po wczytaniu mapy pocztówki, płasko i w 3D (ADR 0007).
  const backdrop = isMap && !mapMissing && fit !== null;

  return (
    <div className={`screen postcard-screen${backdrop ? ' has-backdrop' : ''}`}>
      {backdrop && fit && (
        <MapBackdrop
          frameRef={previewRef}
          projection={fit.projection}
          route={fit.d}
          theme={look as ThemeId}
          accent={accent}
          profile={profile}
          camera={camera}
          settled={settled}
          iso={iso ?? undefined}
        />
      )}
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{activity.name}</h1>
      </div>
      <div className="postcard-layout">
        {/* Szachownica tylko na otoczce podglądu, żeby nie trafiła do eksportu. */}
        <div
          className={`postcard-frame${look === 'transparent' ? ' checkerboard' : ''}${fit ? ' pannable' : ''}${scrollsPage ? ' scrolls-page' : ''}`}
          ref={previewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // Klawiatura zamiast suwaka: +/- przybliża, strzałki przesuwają (kamera jak przy przeciąganiu).
          tabIndex={fit ? 0 : undefined}
          aria-label={fit ? 'Postcard preview. Plus and minus zoom, arrow keys move the map.' : undefined}
          onKeyDown={(e) => {
            if (!fit) return;
            const step = 60;
            const keys: Record<string, (c: Camera) => Camera> = {
              '+': (c) => ({ ...c, zoom: c.zoom * 1.25 }),
              '=': (c) => ({ ...c, zoom: c.zoom * 1.25 }),
              '-': (c) => ({ ...c, zoom: c.zoom / 1.25 }),
              ArrowLeft: (c) => ({ ...c, x: c.x + step }),
              ArrowRight: (c) => ({ ...c, x: c.x - step }),
              ArrowUp: (c) => ({ ...c, y: c.y + step }),
              ArrowDown: (c) => ({ ...c, y: c.y - step }),
            };
            const fn = keys[e.key];
            if (!fn) return;
            e.preventDefault();
            moveCamera(fn);
          }}
        >
          <Postcard
            activity={activity}
            fontCss={fontCss?.css}
            font={font}
            background={
              isMap && !mapMissing
                ? 'map'
                : look === 'photo' && photo
                  ? 'photo'
                  : look === 'transparent'
                    ? 'transparent'
                    : 'gradient'
            }
            map={map.layers}
            photo={photo ? { href: photo, dim: dim / 100 } : undefined}
            theme={isMap ? (look as ThemeId) : undefined}
            accent={accent}
            streams={streams}
            view={is3d ? '3d' : 'flat'}
            camera={camera}
            iso={iso}
            refined={zoomed.refined}
            layout={items}
          />
          {/* Nakładka w HTML obok <svg>, żeby nie trafiła do eksportu. */}
          {items.map((item) => {
            const b = slotBox(item, DATA[item.slot.data].value(activity), scale);
            return (
              <button
                key={item.slot.id}
                className="slot-hit"
                aria-haspopup="dialog"
                data-slot={item.slot.id}
                data-active={editing === item.slot.id}
                aria-label={`${slotMenu(item.slot)} – change`}
                style={{
                  left: `${b.x0 / 10.8}%`,
                  top: `${b.y0 / 19.2}%`,
                  width: `${(b.x1 - b.x0) / 10.8}%`,
                  height: `${(b.y1 - b.y0) / 19.2}%`,
                }}
                onClick={(e) => onSlotClick(e, item.slot.id)}
              />
            );
          })}
        </div>
        <div className="style-panel">
          <h2 className="panel-title">Style</h2>
          <div className="panel-pair">
            <LookPicker
              polyline={activity.map.summary_polyline}
              hasRoute={fit !== null}
              look={look}
              onLook={choose}
              accent={accent}
              onAccent={setAccent}
              photoHref={photo}
              onPhotoFile={choosePhoto}
              photoBusy={photoBusy}
            />
          </div>
          {photoError && <p className="error">Could not read this image. Try a JPEG or PNG.</p>}
          {look === 'photo' && (
            <div className="toggle-row">
              <label className="zoom-control">
                Dim
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={dim}
                  onChange={(e) => setDim(Number(e.target.value))}
                />
              </label>
            </div>
          )}
          <p className="panel-hint">
            Click a stat to change it.{fit && ' Drag, Ctrl + scroll or pinch to move and zoom the map.'}
          </p>
          {fit && (has3d || moved) && (
            <section className="panel-section">
              <h3 className="panel-heading">View</h3>
              <div className="toggle-row">
                {has3d && (
                  <div className="toggle-group" role="group" aria-label="View">
                    <button className="toggle" aria-pressed={!is3d} onClick={() => setView('flat')}>
                      Flat
                    </button>
                    <button className="toggle" aria-pressed={is3d} onClick={() => setView('3d')}>
                      3D
                    </button>
                  </div>
                )}
                {moved && (
                  <button className="text-button" onClick={() => setCamera((c) => keepCamera(c, DEFAULT_CAMERA))}>
                    Reset view
                  </button>
                )}
              </div>
            </section>
          )}
          <div className="panel-pair">
            <FontPicker font={font} onFont={setFont} />
            <LayoutPicker layout={layoutId} onLayout={setLayoutId} />
          </div>
          <DataModal
            slot={editingItem}
            activity={activity}
            font={font}
            scale={scale}
            color={preview.color}
            bg={preview.bg}
            streams={streams}
            onPick={pick}
            onClose={() => setEditing(null)}
          />
          <DownloadMenu disabled={loading || !fontReady} onPng={downloadPng} onSvg={downloadSvg} />
          {loading && (
            <p className="hint" role="status">
              Loading map…
            </p>
          )}
          {mapFailed && <p className="error">Could not load the map.</p>}
          {exportFailed && <p className="error">Could not create the PNG.</p>}
        </div>
      </div>
    </div>
  );
}
