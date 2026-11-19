import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { DRAW_S, HOLD_S, easeInOutCubic } from '../lib/animate';
import { fetchStreams, SessionExpiredError, type Activity, type RunStreams } from '../strava/api';
import { DEFAULT_FONT, loadFontCss } from '../lib/fonts';
import { isoRoutes } from '../lib/isoRoute';
import { streamCache } from '../lib/streamCache';
import { POSTCARD_DETAILED } from '../lib/vectorMap';
import {
  TOGETHER_BOX,
  TogetherCard,
  nearRuns,
  togetherFit,
  type TogetherBackground,
  type TogetherColors,
  type TogetherLayout,
  type TogetherSync,
} from '../postcard/TogetherCard';
import { THEMES, type ThemeId } from '../postcard/themes';
import { DEFAULT_ACCENT } from '../postcard/themes/neon';
import { ExportControls, offscreenFrames } from './ExportControls';
import { canEncodeMp4, encodeMp4 } from '../lib/encodeVideo';
import { RouteThumb } from './RouteThumb';
import { Select } from './Select';
import { useMapLayers } from './useMapLayers';

const SIZE: [number, number] = [1080, 1920];
// Limit API Stravy to 100 zapytań na 15 min: 3D pobiera strumienie najwyżej 20 biegów, po 2 naraz.
export const MAX_3D = 20;
const PARALLEL = 2;
const THEME_OPTIONS = (Object.keys(THEMES) as ThemeId[]).map((id) => ({ id, label: THEMES[id].label }));

// Do 3D wystarczą latlng, dystans i wysokość; zapamiętane w pamięci karty (streamCache).
async function loadStreams(run: Activity): Promise<RunStreams | null> {
  if (streamCache.has(run.id)) return streamCache.get(run.id)!;
  let s: RunStreams | null;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('mock')) {
    const { mockStreams } = await import('../dev/mockActivities');
    s = mockStreams(run);
  } else {
    s = await fetchStreams(run.id);
  }
  const slim = s && { latlng: s.latlng, distance: s.distance, altitude: s.altitude };
  streamCache.set(run.id, slim);
  return slim;
}

export function TogetherScreen({
  runs,
  heat = false,
  onBack,
  onSessionExpired,
}: {
  runs: Activity[];
  heat?: boolean; // wszystkie biegi z listy: domyślnie kolory Heat
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<TogetherLayout>('geo');
  const [pickedBackground, setBackground] = useState<TogetherBackground>('map');
  // Overlay nie jest jednym światem, więc mapy nie ma; wybór Map wraca po przełączeniu na Geographic.
  const background = layout === 'overlay' && pickedBackground === 'map' ? 'gradient' : pickedBackground;
  const [theme, setTheme] = useState<ThemeId>('dark');
  const [colors, setColors] = useState<TogetherColors>(heat ? 'heat' : 'run');
  const [sync, setSync] = useState<TogetherSync>('real');
  const [view, setView] = useState<'flat' | '3d'>('3d');
  const [playing, setPlaying] = useState(true);
  const [mp4Ok, setMp4Ok] = useState(false);
  const [streams, setStreams] = useState<Record<number, RunStreams | null>>({});
  const [streamsError, setStreamsError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [fontCss, setFontCss] = useState<{ id: string; css?: string }>();
  const font = background === 'map' ? THEMES[theme].font : DEFAULT_FONT;
  const fontReady = fontCss?.id === font;
  const is3d = view === '3d';
  const near = useMemo(() => (layout === 'geo' ? nearRuns(runs) : { kept: runs, hidden: 0 }), [layout, runs]);
  const runs3d = useMemo(() => near.kept.slice(0, MAX_3D), [near]);
  const done = runs3d.filter((r) => r.id in streams).length;
  // Scena 3D dopiero ze wszystkimi strumieniami (albo po błędzie z tym, co jest), żeby dopasowanie nie skakało.
  const ready3d = is3d && (done === runs3d.length || !!streamsError);
  const shown = ready3d ? runs3d : near.kept;
  const fit = useMemo(() => togetherFit(shown, layout), [shown, layout]);
  const map = useMapLayers(fit?.projection ?? null, SIZE, POSTCARD_DETAILED, background === 'map');
  const isos = useMemo(
    () => (ready3d && fit ? isoRoutes(runs3d.map((r) => streams[r.id]), TOGETHER_BOX, fit.projection ?? fit.projections) : undefined),
    [ready3d, fit, runs3d, streams],
  );

  useEffect(() => {
    let cancelled = false;
    loadFontCss(font).then((css) => !cancelled && setFontCss({ id: font, css }));
    return () => {
      cancelled = true;
    };
  }, [font]);

  // Strumienie tylko po wyborze 3D, po 2 naraz; pierwszy błąd zatrzymuje resztę (Retry pobiera tylko brakujące).
  const loaded = useRef(streams);
  loaded.current = streams;
  useEffect(() => {
    if (!is3d) return;
    let cancelled = false;
    setStreamsError(undefined);
    const queue = runs3d.filter((r) => !(r.id in loaded.current));
    const worker = async () => {
      while (queue.length && !cancelled) {
        const run = queue.shift()!;
        const s = await loadStreams(run);
        if (!cancelled) setStreams((m) => ({ ...m, [run.id]: s }));
      }
    };
    Promise.all(Array.from({ length: PARALLEL }, worker)).catch((e) => {
      if (cancelled) return;
      cancelled = true;
      if (e instanceof SessionExpiredError) onSessionExpired();
      else setStreamsError(e instanceof Error ? e.message : 'Could not load elevation.');
    });
    return () => {
      cancelled = true;
    };
  }, [is3d, runs3d, retry, onSessionExpired]);

  const mapOn = background === 'map' && !!map.layers;
  const cardProps = useMemo(
    () => ({
      runs: shown,
      layout,
      background: mapOn ? ('map' as const) : background === 'map' ? ('gradient' as const) : background,
      map: map.layers,
      theme,
      accent: DEFAULT_ACCENT,
      font,
      fontCss: fontCss?.css,
      colors,
      sync,
      isos,
    }),
    [shown, layout, mapOn, background, map.layers, theme, font, fontCss?.css, colors, sync, isos],
  );
  const loading = (background === 'map' && (!map.layers || map.loading)) || (is3d && !ready3d);
  // Podgląd jako gotowe MP4 w pętli (rysowanie karty w każdej klatce przycinało); MP4 nie ma przezroczystości,
  // więc przy Transparent i bez H.264 zostaje animacja na żywo.
  const videoPreview = mp4Ok && background !== 'transparent';
  const preview = usePreviewVideo((p) => <TogetherCard {...cardProps} progress={p} />, cardProps, videoPreview && !loading && fontReady);
  const progress = usePreviewProgress(playing && !videoPreview);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (playing) videoRef.current?.play().catch(() => {});
    else videoRef.current?.pause();
  }, [playing, preview.url]);
  useEffect(() => {
    canEncodeMp4().then(setMp4Ok);
  }, []);
  const toggle = <T extends string>(label: string, value: T, set: (v: T) => void, options: [T, string, boolean?][]) => (
    <div className="toggle-group" role="group" aria-label={label}>
      {options.map(([id, text, disabled]) => (
        <button key={id} className="toggle" aria-pressed={value === id} disabled={disabled} onClick={() => set(id)}>
          {text}
        </button>
      ))}
    </div>
  );

  return (
    <div className="screen postcard-screen">
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{runs.length} runs together</h1>
      </div>
      <div className="postcard-layout">
        <div className={`postcard-frame${background === 'transparent' ? ' checkerboard' : ''}`} ref={previewRef}>
          <TogetherCard {...cardProps} progress={progress} />
          {preview.url && <video className="preview-video" ref={videoRef} src={preview.url} autoPlay={playing} loop muted playsInline />}
        </div>
        <div className="style-panel">
          <h2 className="panel-title">Style</h2>
          <section className="panel-section">
            <h3 className="panel-heading">Layout</h3>
            {toggle('Layout', layout, setLayout, [
              ['overlay', 'Overlay'],
              ['geo', 'Geographic'],
            ])}
            {near.hidden > 0 && (
              <p className="panel-hint">
                {near.hidden === 1 ? '1 run far away is hidden.' : `${near.hidden} runs far away are hidden.`}
              </p>
            )}
          </section>
          <section className="panel-section">
            <h3 className="panel-heading">Background</h3>
            {toggle('Background', background, setBackground, [
              ['gradient', 'Gradient'],
              ['transparent', 'Transparent'],
              ['map', 'Map', layout === 'overlay'],
            ])}
            {layout === 'overlay' && <p className="panel-hint">Map needs Geographic layout.</p>}
          </section>
          {background === 'map' && (
            <section className="panel-section">
              <h3 className="panel-heading">Map style</h3>
              <Select
                label="Map style"
                className="look-select"
                value={theme}
                options={THEME_OPTIONS}
                onChange={setTheme}
                preview={(id) => (
                  <RouteThumb
                    polyline={runs[0].map.summary_polyline}
                    style={THEMES[id].style({ accent: DEFAULT_ACCENT })}
                    route={THEMES[id].render({}, { accent: DEFAULT_ACCENT }).route.stroke}
                  />
                )}
              />
            </section>
          )}
          <section className="panel-section">
            <h3 className="panel-heading">View</h3>
            <div className="toggle-row">
              {toggle('View', view, setView, [
                ['flat', 'Flat'],
                ['3d', '3D'],
              ])}
              {toggle('Colors', colors, setColors, [
                ['run', 'Per run'],
                ['heat', 'Heat'],
              ])}
            </div>
            <div className="toggle-row">
              Animation
              <button className="toggle" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
                {playing ? 'Pause' : 'Play'}
              </button>
              {toggle('Animation timing', sync, setSync, [
                ['real', 'Real time'],
                ['together', 'Together'],
              ])}
            </div>
            {videoPreview && !preview.url && preview.pct !== null && (
              <p className="hint" role="status">
                Preparing preview {preview.pct}%
              </p>
            )}
            {is3d && near.kept.length > MAX_3D && <p className="panel-hint">3D shows the first {MAX_3D} runs.</p>}
            {is3d && !ready3d && !streamsError && (
              <p className="hint" role="status">
                Loading elevation {done}/{runs3d.length}
              </p>
            )}
            {is3d && streamsError && (
              <div className="toggle-row">
                <p className="error" role="status">
                  {streamsError} Showing {done}/{runs3d.length}.
                </p>
                <button className="toggle" onClick={() => setRetry((n) => n + 1)}>
                  Retry
                </button>
              </div>
            )}
          </section>
          <ExportControls
            name={`runpostcard-together-${runs.length}`}
            svg={() => previewRef.current?.querySelector('svg') ?? null}
            frame={(p) => <TogetherCard {...cardProps} progress={p} />}
            resetKey={cardProps}
            disabled={loading || !fontReady}
            videoOnly
            mp4={preview.blob}
          />
          {background === 'map' && map.failed && <p className="error">Could not load the map.</p>}
        </div>
      </div>
    </div>
  );
}

// MP4 z tej samej karty co eksport, liczone po chwili bez zmian (key = ustawienia karty); zmiana przerywa kodowanie.
function usePreviewVideo(frame: (p: number) => ReactElement, key: unknown, enabled: boolean) {
  const [video, setVideo] = useState<{ key: unknown; blob: Blob; url: string }>();
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      const { frameAt, unmount } = offscreenFrames(frame);
      setPct(0);
      try {
        const blob = await encodeMp4(frameAt, { signal: abort.signal, onProgress: (d) => setPct(Math.floor(d * 100)) });
        if (abort.signal.aborted) return;
        setVideo((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { key, blob, url: URL.createObjectURL(blob) };
        });
      } catch {
        // przerwane albo błąd: zostaje gotowa karta bez animacji
      } finally {
        unmount();
        if (!abort.signal.aborted) setPct(null);
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, enabled]); // frame zmienia się razem z key
  const urlRef = useRef<string | undefined>(undefined);
  urlRef.current = video?.url;
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const current = enabled && video?.key === key ? video : undefined;
  return { url: current?.url, blob: current?.blob, pct };
}

// Podgląd animacji na ekranie (bez pliku): ten sam przebieg co eksport, DRAW_S rysowania + HOLD_S pauzy, w pętli.
// Ok. 30 kl./s wystarcza; zatrzymany = gotowa karta (progress pominięty).
function usePreviewProgress(playing: boolean): number | undefined {
  const [p, setP] = useState<number>();
  useEffect(() => {
    if (!playing) return setP(undefined);
    const start = performance.now();
    let last = 0;
    let raf = requestAnimationFrame(function loop(now) {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      const t = ((now - start) / 1000) % (DRAW_S + HOLD_S);
      setP(t < DRAW_S ? easeInOutCubic(t / DRAW_S) : 1);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return p;
}
