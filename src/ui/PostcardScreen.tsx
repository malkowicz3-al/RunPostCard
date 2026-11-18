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

const SIZE: [number, number] = [1080, 1920];

export function PostcardScreen({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fontCss, setFontCss] = useState<string>();
  const [exportFailed, setExportFailed] = useState(false);
  const [look, setLook] = useState<Look>('gradient');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [mapFailed, setMapFailed] = useState(false);
  const isMap = look !== 'gradient' && look !== 'transparent';
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
