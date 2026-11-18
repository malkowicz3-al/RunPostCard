import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard, type PostcardBackground } from '../postcard/Postcard';
import { ROUTE_BOX } from '../postcard/Route';
import { exportPng, exportSvg } from '../lib/exportPng';
import { loadFontCss } from '../lib/fonts';
import { fitRoute } from '../lib/routePath';
import { POSTCARD } from '../lib/vectorMap';
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
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  const map = useMapLayers(fit?.projection ?? null, SIZE, POSTCARD, background === 'map');
  const mapLoading = background === 'map' && !map.layers;

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
          map={map.layers}
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
      <div className="actions">
        <button className="primary" onClick={downloadPng} disabled={mapLoading}>
          Download PNG
        </button>
        <button aria-label="Download SVG" onClick={downloadSvg} disabled={mapLoading}>
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
