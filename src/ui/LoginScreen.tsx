import { memo, useEffect, useState } from 'react';
import { buildAuthUrl } from '../strava/auth';
import connectWithStrava from '../assets/brand/strava/connect-with-strava-orange.svg';
import { mockActivities, mockStreams } from '../dev/mockActivities';
import { loadFontCss } from '../lib/fonts';
import { Postcard, type PostcardBackground } from '../postcard/Postcard';
import { resolveLayout, type LayoutId } from '../postcard/slots';
import type { ThemeId } from '../postcard/themes';
import { DEMO_MAP } from './demoMap';

type Card = { run: number; layout: LayoutId; theme?: ThemeId; background?: PostcardBackground; view?: '3d' };

// Każdy motyw i gradient najwyżej raz (oraz jeden widok 3D): id w <defs> muszą być unikalne w dokumencie.
const COLUMNS: Card[][] = [
  [
    { run: 2, layout: 'classic', theme: 'dark' },
    { run: 4, layout: 'pulse', theme: 'neon' },
    { run: 0, layout: 'hero', background: 'gradient' },
  ],
  [
    { run: 4, layout: 'hud', theme: 'synthwave', view: '3d' },
    { run: 1, layout: 'grid', theme: 'blueprint' },
    { run: 5, layout: 'magazine', theme: 'arcademaze' },
  ],
  [
    { run: 3, layout: 'minimal', theme: 'watercolor' },
    { run: 1, layout: 'splits', theme: 'galaxy' },
    { run: 0, layout: 'corners', theme: 'light' },
  ],
];

// Kolaż przykładowych pocztówek z wymyślonymi danymi i mapą (bez sieci); rysowany raz, ruch tylko w CSS.
const Collage = memo(function Collage() {
  const runs = mockActivities();
  return (
    <div className="login-collage" aria-hidden="true">
      {COLUMNS.map((cards, c) => (
        <div className="login-column" key={c}>
          {cards.map(({ run, layout, theme, background = 'map', view }) => (
            <div className="login-card" key={layout}>
              <Postcard
                activity={runs[run]}
                background={background}
                map={DEMO_MAP}
                theme={theme}
                streams={mockStreams(runs[run])}
                view={view}
                layout={resolveLayout(layout)}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});

export function LoginScreen() {
  const [fontCss, setFontCss] = useState<string>();
  // Lokalny plik fontu z /fonts; jedna reguła @font-face w dokumencie działa dla wszystkich pocztówek kolażu.
  useEffect(() => {
    loadFontCss().then(setFontCss);
  }, []);

  return (
    <div className="screen login">
      {fontCss && <style>{fontCss}</style>}
      <Collage />
      <div className="login-panel">
        <h1>RunPostcard</h1>
        <p>Turn a run into a postcard you can share.</p>
        <button className="strava-connect" onClick={() => (location.href = buildAuthUrl())}>
          <img src={connectWithStrava} alt="Connect with Strava" height={48} />
        </button>
        <p className="login-note">Read-only access. Nothing is stored on a server.</p>
      </div>
    </div>
  );
}
