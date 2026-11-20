import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { loadFontCss } from '../lib/fonts';
import { POSTCARD_DETAILED } from '../lib/vectorMap';
import { TogetherCard, nearRuns, togetherFit, type TogetherColors, type TogetherSync } from '../postcard/TogetherCard';
import { THEMES, type ThemeId } from '../postcard/themes';
import { DEFAULT_ACCENT } from '../postcard/themes/neon';
import { ExportControls } from './ExportControls';
import { StyleSheet } from './StyleSheet';
import { RouteThumb } from './RouteThumb';
import { Select } from './Select';
import { useMapLayers } from './useMapLayers';
import { usePreviewProgress } from './usePreviewProgress';

const SIZE: [number, number] = [1080, 1920];
const THEME_OPTIONS = (Object.keys(THEMES) as ThemeId[]).map((id) => ({ id, label: THEMES[id].label }));

// Together: płasko, wszystkie trasy na jednej mapie, żeby było widać, ile biegów i gdzie się powtarzają.
export function TogetherScreen({ runs, heat = false, onBack }: { runs: Activity[]; heat?: boolean; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeId>('dark');
  const [colors, setColors] = useState<TogetherColors>(heat ? 'heat' : 'run');
  const [sync, setSync] = useState<TogetherSync>('real');
  const [playing, setPlaying] = useState(true);
  const progress = usePreviewProgress(playing);
  const [fontCss, setFontCss] = useState<{ id: string; css?: string }>();
  const font = THEMES[theme].font;
  const fontReady = fontCss?.id === font;
  const near = useMemo(() => nearRuns(runs), [runs]);
  const fit = useMemo(() => togetherFit(near.kept), [near]);
  const map = useMapLayers(fit?.projection ?? null, SIZE, POSTCARD_DETAILED, true);

  useEffect(() => {
    let cancelled = false;
    loadFontCss(font).then((css) => !cancelled && setFontCss({ id: font, css }));
    return () => {
      cancelled = true;
    };
  }, [font]);

  const cardProps = useMemo(
    () => ({ runs: near.kept, map: map.layers, theme, accent: DEFAULT_ACCENT, font, fontCss: fontCss?.css, colors, sync }),
    [near, map.layers, theme, font, fontCss?.css, colors, sync],
  );
  const loading = !map.layers || map.loading;
  const toggle = <T extends string>(label: string, value: T, set: (v: T) => void, options: [T, string][]) => (
    <div className="toggle-group" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} className="toggle" aria-pressed={value === id} onClick={() => set(id)}>
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
        <div className="postcard-frame" ref={previewRef}>
          <TogetherCard {...cardProps} progress={progress} />
        </div>
        <StyleSheet>
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
            {near.hidden > 0 && (
              <p className="panel-hint">
                {near.hidden === 1 ? '1 run far away is hidden.' : `${near.hidden} runs far away are hidden.`}
              </p>
            )}
          </section>
          <section className="panel-section">
            <h3 className="panel-heading">Lines</h3>
            <div className="toggle-row">
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
          </section>
          <ExportControls
            name={`runpostcard-together-${runs.length}`}
            svg={() => previewRef.current?.querySelector('svg') ?? null}
            frame={(p) => <TogetherCard {...cardProps} progress={p} />}
            resetKey={cardProps}
            disabled={loading || !fontReady}
            mode="animation"
          />
          {map.failed && <p className="error">Could not load the map.</p>}
        </StyleSheet>
      </div>
    </div>
  );
}

