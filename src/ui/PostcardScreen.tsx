import { useEffect, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
import { exportPng, exportSvg } from '../lib/exportPng';
import { loadFontCss } from '../lib/fonts';

export function PostcardScreen({
  activity,
  onBack,
  onLogout,
}: {
  activity: Activity;
  onBack: () => void;
  onLogout: () => void;
}) {
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
      <div className="preview" ref={previewRef}>
        <Postcard activity={activity} fontCss={fontCss} transparent={transparent} />
      </div>
      <div className="actions">
        <button aria-pressed={transparent} onClick={() => setTransparent((t) => !t)}>
          Background: {transparent ? 'transparent' : 'gradient'}
        </button>
      </div>
      <div className="actions">
        <button className="primary" onClick={downloadPng}>
          Download PNG
        </button>
        <button onClick={downloadSvg}>Download SVG</button>
        <button onClick={onBack}>Back</button>
        <button onClick={onLogout}>Log out</button>
      </div>
      {exportFailed && <p className="error">Could not create the PNG.</p>}
    </div>
  );
}
