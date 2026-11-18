import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard, type PostcardBackground } from '../postcard/Postcard';
import { postcardTileUrls } from '../postcard/MapBackground';
import { ROUTE_BOX } from '../postcard/Route';
import { exportPng, exportSvg } from '../lib/exportPng';
import { fetchDataUrl } from '../lib/dataUrl';
import { loadFontCss } from '../lib/fonts';
import { fitRoute } from '../lib/routePath';
import { MAP_ENABLED } from '../lib/mapTiles';

const BACKGROUNDS: [PostcardBackground, string][] = [
  ['gradient', 'Gradient'],
  ['transparent', 'Transparent'],
  ...(MAP_ENABLED ? [['map', 'Map'] as [PostcardBackground, string]] : []),
];

export function PostcardScreen({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fontCss, setFontCss] = useState<string>();
  const [exportFailed, setExportFailed] = useState(false);
  const [background, setBackground] = useState<PostcardBackground>('gradient');
  const [mapImages, setMapImages] = useState<Record<string, string>>();
  const [mapFailed, setMapFailed] = useState(false);
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  const mapLoading = background === 'map' && !mapImages;

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

  // Kafelki jako data URL, żeby trafiły do eksportu; przy błędzie wracamy do gradientu.
  useEffect(() => {
    if (!mapLoading) return;
    let cancelled = false;
    const failed = () => {
      if (cancelled) return;
      setMapFailed(true);
      setBackground('gradient');
    };
    if (!fit) {
      failed();
      return;
    }
    const urls = postcardTileUrls(fit.projection);
    Promise.all(urls.map((url) => fetchDataUrl(url).then((data) => [url, data] as const)))
      .then((entries) => {
        if (!cancelled) setMapImages(Object.fromEntries(entries));
      })
      .catch(failed);
    return () => {
      cancelled = true;
    };
  }, [mapLoading, fit]);

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
          mapImages={mapImages}
        />
      </div>
      <div className="segmented" role="group" aria-label="Background">
        {BACKGROUNDS.map(([value, label]) => (
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
