import { useEffect, useRef, useState } from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
import { exportPng } from '../lib/exportPng';
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

  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

  const download = () => {
    const svg = previewRef.current?.querySelector('svg');
    if (!svg) return;
    setExportFailed(false);
    exportPng(svg, `runpostcard-${activity.id}.png`).catch(() => setExportFailed(true));
  };

  return (
    <div className="screen postcard-screen">
      <div className="preview" ref={previewRef}>
        <Postcard activity={activity} fontCss={fontCss} />
      </div>
      <div className="actions">
        <button className="primary" onClick={download}>
          Download PNG
        </button>
        <button onClick={onBack}>Back</button>
        <button onClick={onLogout}>Log out</button>
      </div>
      {exportFailed && <p className="error">Could not create the PNG.</p>}
    </div>
  );
}
