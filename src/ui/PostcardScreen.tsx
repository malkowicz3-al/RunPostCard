import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
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
  const has3d = !!streams?.altitude;
  const is3d = view === '3d' && has3d;
  // W 3D mapa się nie rysuje, więc też nie pobieramy kafelków.
  const isMap = !is3d && look !== 'gradient' && look !== 'transparent';
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  const map = useMapLayers(fit?.projection ?? null, SIZE, POSTCARD, isMap);
  const mapLoading = isMap && !map.layers;

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

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

  const chooseView = (value: 'flat' | '3d') => {
    if (value === '3d' && look !== 'gradient' && look !== 'transparent') choose('gradient');
    setView(value);
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
          className={`postcard-frame${look === 'transparent' ? ' checkerboard' : ''}`}
          ref={previewRef}
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
            mapDisabled={is3d}
          />
          {streams && (
            <div className="toggle-row">
              {has3d && (
                <div className="toggle-group" role="group" aria-label="View">
                  <button className="toggle" aria-pressed={!is3d} onClick={() => chooseView('flat')}>
                    Flat
                  </button>
                  <button className="toggle" aria-pressed={is3d} onClick={() => chooseView('3d')}>
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
