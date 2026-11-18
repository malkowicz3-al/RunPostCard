import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard, type PostcardBackground } from '../postcard/Postcard';
import { ROUTE_BOX } from '../postcard/Route';
import { exportPng, exportSvg } from '../lib/exportPng';
import { loadFontCss } from '../lib/fonts';
import { fitRoute } from '../lib/routePath';
import { THEMES, shownTheme, type ThemeId } from '../postcard/themes';
import { useMapLayers } from './useMapLayers';

const BACKGROUNDS: [PostcardBackground, string][] = [
  ['gradient', 'Gradient'],
  ['transparent', 'Transparent'],
  ['map', 'Map'],
];
const SIZE: [number, number] = [1080, 1920];

export function PostcardScreen({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fontCss, setFontCss] = useState<string>();
  const [exportFailed, setExportFailed] = useState(false);
  const [background, setBackground] = useState<PostcardBackground>('gradient');
  const [mapFailed, setMapFailed] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('minimal');
  const [renderedTheme, setRenderedTheme] = useState<ThemeId>('minimal');
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  const map = useMapLayers(fit?.projection ?? null, SIZE, THEMES[theme].profile, background === 'map');
  const mapData = useMemo(
    () => (map.layers && map.objects ? { layers: map.layers, objects: map.objects } : undefined),
    [map.layers, map.objects],
  );
  // Przy zmianie motywu rysujemy poprzedni na starych danych, aż przyjdą dane nowego profilu (bez migotania).
  const shown = shownTheme(theme, renderedTheme, map.profile);
  if (shown !== renderedTheme) setRenderedTheme(shown);
  const mapLoading = background === 'map' && !mapData;
  // Nie eksportujemy starego motywu, gdy nowy jeszcze się ładuje.
  const exportBlocked = mapLoading || (background === 'map' && shown !== theme);

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

  // Przy błędzie mapy wracamy do gradientu.
  useEffect(() => {
    if (!map.failed) return;
    setMapFailed(true);
    setBackground('gradient');
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

  const choose = (value: PostcardBackground) => {
    setMapFailed(false);
    setBackground(value);
  };

  return (
    <div className="screen postcard-screen">
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{activity.name}</h1>
      </div>
      {/* Szachownica tylko na otoczce podglądu, żeby nie trafiła do eksportu. */}
      <div
        className={`postcard-frame${background === 'transparent' ? ' checkerboard' : ''}`}
        ref={previewRef}
      >
        <Postcard
          activity={activity}
          fontCss={fontCss}
          background={mapLoading ? 'gradient' : background}
          map={mapData}
          theme={shown}
        />
      </div>
      <div className="segmented" role="group" aria-label="Background">
        {/* Bez trasy nie ma projekcji, więc nie ma też mapy. */}
        {BACKGROUNDS.filter(([value]) => value !== 'map' || fit).map(([value, label]) => (
          <button key={value} aria-pressed={background === value} onClick={() => choose(value)}>
            {label}
          </button>
        ))}
      </div>
      {background === 'map' && (
        <div className="segmented" role="group" aria-label="Map theme">
          {(Object.keys(THEMES) as ThemeId[]).map((id) => (
            <button key={id} aria-pressed={theme === id} onClick={() => setTheme(id)}>
              {THEMES[id].label}
            </button>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="primary" onClick={downloadPng} disabled={exportBlocked}>
          Download PNG
        </button>
        <button aria-label="Download SVG" onClick={downloadSvg} disabled={exportBlocked}>
          SVG
        </button>
      </div>
      {mapLoading && (
        <p className="hint" role="status">
          Loading map…
        </p>
      )}
      {mapFailed && <p className="error">Could not load the map.</p>}
      {exportFailed && <p className="error">Could not create the PNG.</p>}
    </div>
  );
}
