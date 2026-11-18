import { useEffect, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
import { exportPng, exportSvg } from '../lib/exportPng';
import { loadFontCss } from '../lib/fonts';

export function PostcardScreen({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fontCss, setFontCss] = useState<string>();
  const [exportFailed, setExportFailed] = useState(false);
  const [transparent, setTransparent] = useState(false);

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

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

  return (
    <div className="screen postcard-screen">
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{activity.name}</h1>
      </div>
      {/* Szachownica tylko na otoczce podglądu, żeby nie trafiła do eksportu. */}
      <div className={`postcard-frame${transparent ? ' checkerboard' : ''}`} ref={previewRef}>
        <Postcard activity={activity} fontCss={fontCss} transparent={transparent} />
      </div>
      <div className="segmented" role="group" aria-label="Background">
        <button aria-pressed={!transparent} onClick={() => setTransparent(false)}>
          Gradient
        </button>
        <button aria-pressed={transparent} onClick={() => setTransparent(true)}>
          Transparent
        </button>
      </div>
      <div className="actions">
        <button className="primary" onClick={downloadPng}>
          Download PNG
        </button>
        <button aria-label="Download SVG" onClick={downloadSvg}>
          SVG
        </button>
      </div>
      {exportFailed && <p className="error">Could not create the PNG.</p>}
    </div>
  );
}
