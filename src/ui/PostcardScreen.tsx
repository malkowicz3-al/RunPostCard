import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Activity } from '../strava/api';
import { CAMERA_CENTER, DEFAULT_CAMERA, Postcard, type Camera } from '../postcard/Postcard';
import { ROUTE_BOX } from '../postcard/Route';
import { exportPng, exportSvg } from '../lib/exportPng';
import { loadFontCss } from '../lib/fonts';
import { fitRoute } from '../lib/routePath';
import { POSTCARD } from '../lib/vectorMap';
import { DEFAULT_ACCENT } from '../postcard/themes/neon';
import { DownloadMenu } from './DownloadMenu';
import { LookPicker, type Look } from './LookPicker';
import { useMapLayers } from './useMapLayers';
import { useRunStreams } from './useRunStreams';

const SIZE: [number, number] = [1080, 1920];
const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const HALF_BOX: [number, number] = [(ROUTE_BOX[1][0] - ROUTE_BOX[0][0]) / 2, (ROUTE_BOX[1][1] - ROUTE_BOX[0][1]) / 2];
// Środek trasy nie wychodzi poza płótno, a przy zoomie każdy punkt pola trasy da się przesunąć na środek.
export const clampCamera = ({ zoom, x, y }: Camera): Camera => {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const lx = Math.max(CAMERA_CENTER[0], HALF_BOX[0] * z);
  const ly = HALF_BOX[1] * z;
  return {
    zoom: z,
    x: clamp(x, -lx, Math.max(SIZE[0] - CAMERA_CENTER[0], lx)),
    y: clamp(y, -Math.max(CAMERA_CENTER[1], ly), Math.max(SIZE[1] - CAMERA_CENTER[1], ly)),
  };
};

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
  const [fontCss, setFontCss] = useState<string>();
  const [exportFailed, setExportFailed] = useState(false);
  const [look, setLook] = useState<Look>('gradient');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [mapFailed, setMapFailed] = useState(false);
  const [view, setView] = useState<'flat' | '3d'>('flat');
  const [showHighlights, setShowHighlights] = useState(false);
  const streams = useRunStreams(activity, onSessionExpired);
  const isMap = look !== 'gradient' && look !== 'transparent';
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  // 3D liczy się na płaskiej projekcji trasy, więc bez niej przycisk nie ma sensu.
  const has3d = !!streams?.altitude && fit !== null;
  const is3d = view === '3d' && has3d;
  const map = useMapLayers(fit?.projection ?? null, SIZE, POSTCARD, isMap);
  const mapLoading = isMap && !map.layers;
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
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
      setCamera((c) => fns.reduce((acc, f) => clampCamera(f(acc)), c));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

  useEffect(() => setCamera(DEFAULT_CAMERA), [activity, is3d]);

  // Kółko myszy przybliża tylko w 3D; listener nie-pasywny, żeby preventDefault blokował przewijanie strony.
  useEffect(() => {
    const el = previewRef.current;
    if (!is3d || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      moveCamera((c) => ({ ...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.002) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [is3d]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!is3d) return;
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
    pointers.current.delete(e.pointerId);
  };

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
  };

  return (
    <div className="screen postcard-screen">
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{activity.name}</h1>
      </div>
      <div className="postcard-layout">
        {/* Szachownica tylko na otoczce podglądu, żeby nie trafiła do eksportu. */}
        <div
          className={`postcard-frame${look === 'transparent' ? ' checkerboard' : ''}${is3d ? ' pannable' : ''}`}
          ref={previewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Postcard
            activity={activity}
            fontCss={fontCss}
            background={isMap && !mapLoading ? 'map' : look === 'transparent' ? 'transparent' : 'gradient'}
            map={map.layers}
            theme={isMap ? look : undefined}
            accent={accent}
            streams={streams}
            view={is3d ? '3d' : 'flat'}
            highlights={showHighlights}
            camera={camera}
          />
        </div>
        <div className="style-panel">
          <h2 className="panel-title">Style</h2>
          <LookPicker
            polyline={activity.map.summary_polyline}
            hasRoute={fit !== null}
            look={look}
            onLook={choose}
            accent={accent}
            onAccent={setAccent}
          />
          {streams && (
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
              <button
                className="toggle"
                aria-pressed={showHighlights}
                onClick={() => setShowHighlights((v) => !v)}
              >
                Highlights
              </button>
            </div>
          )}
          {is3d && (
            <div className="toggle-row">
              <label className="zoom-control">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.1}
                  value={camera.zoom}
                  onChange={(e) => setCamera((c) => clampCamera({ ...c, zoom: Number(e.target.value) }))}
                />
              </label>
              <button className="toggle" onClick={() => setCamera(DEFAULT_CAMERA)}>
                Reset
              </button>
            </div>
          )}
          <DownloadMenu disabled={mapLoading} onPng={downloadPng} onSvg={downloadSvg} />
          {mapLoading && (
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
