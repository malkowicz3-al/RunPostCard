import { memo, useEffect, useState } from 'react';
import { buildAuthUrl } from '../strava/auth';
import connectWithStrava from '../assets/brand/strava/connect-with-strava-orange.svg';
import { DEFAULT_FONT, loadFontCss, type FontId } from '../lib/fonts';
import { loadPhoto } from '../lib/photo';
import { Postcard } from '../postcard/Postcard';
import { resolveLayout, type LayoutId } from '../postcard/slots';
import { THEMES, type ThemeId } from '../postcard/themes';
import { demoRun } from './demoRuns';

// Bez motywu = tło gradientowe. Karta i = bieg i z demoRuns. font: lżejszy krój zamiast domyślnego motywu,
// bo każda karta osadza cały plik fontu (Lobster, Pacifico, Teko to 300–400 kB).
// photo: n-te zdjęcie z lokalnego folderu (jeśli jest) zamiast tła, z własnym układem i bez trasy, gdy route: false.
type Card = {
  layout: LayoutId;
  theme?: ThemeId;
  view?: '3d';
  font?: FontId;
  photo?: { n: number; layout: LayoutId; route?: false };
};

const COLUMNS: Card[][] = [
  [
    { layout: 'classic', theme: 'dark' },
    { layout: 'pulse', theme: 'neon', photo: { n: 0, layout: 'hero' } },
    { layout: 'hero', photo: { n: 2, layout: 'minimal', route: false } },
    { layout: 'climb', theme: 'dune', view: '3d' },
    { layout: 'magazine', theme: 'vintage', font: 'bebas', photo: { n: 5, layout: 'bigPair', route: false } },
    { layout: 'duo', theme: 'terminal' },
  ],
  [
    { layout: 'hud', theme: 'synthwave', photo: { n: 4, layout: 'stackLeft', route: false } },
    { layout: 'grid', theme: 'blueprint' },
    { layout: 'table', theme: 'arcademaze' },
    { layout: 'minimal', theme: 'pencil', photo: { n: 1, layout: 'poster' } },
    { layout: 'scoreboard', theme: 'kartrace' },
    { layout: 'strip', theme: 'cyberhud', view: '3d', font: 'orbitron', photo: { n: 7, layout: 'corners', route: false } },
  ],
  [
    { layout: 'poster', theme: 'watercolor', font: 'marker', photo: { n: 3, layout: 'classic', route: false } },
    { layout: 'splits', theme: 'light' },
    { layout: 'corners', theme: 'overworld' },
    { layout: 'dashboard', theme: 'riso', photo: { n: 6, layout: 'hero', route: false } },
    { layout: 'bigPair' },
    { layout: 'stackLeft', theme: 'spellbook', font: 'righteous' },
  ],
];

// Zdjęcia CC0 (autorzy w README), już przycięte do 9:16; brak pliku = karta z mapą/gradientem.
const PHOTOS = Object.entries(
  import.meta.glob('../assets/collage/*.jpg', { eager: true, query: '?url', import: 'default' }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url as string);

// Zdjęcie zmniejszone (karty mają ~200 px) i zakodowane od nowa jako JPEG (bez EXIF); błąd = karta bez zdjęcia.
async function photoFor(card: Card): Promise<string | undefined> {
  const url = card.photo && PHOTOS[card.photo.n];
  if (!url) return undefined;
  try {
    return await loadPhoto(await (await fetch(url)).blob(), 0.5);
  } catch {
    return undefined;
  }
}
const CARDS = COLUMNS.flat();
const PER_COLUMN = COLUMNS[0].length;
const fontOf = (card: Card): FontId => card.font ?? (card.theme ? THEMES[card.theme].font : DEFAULT_FONT);

// SVG kart liczone raz na sesję: powrót do logowania (po wylogowaniu) tylko odtwarza z nich adresy blob.
const svgCache: string[] = [];

// Każda pocztówka raz jako samodzielny SVG w <img>: kopie w pętli to te same obrazki, bez zdublowanych id w dokumencie.
// Między kartami oddajemy wątek, żeby przycisk logowania reagował; onColumn dostaje gotowe kolumny po kolei.
// react-dom/server (ok. 200 kB) w osobnym kawałku, ładowany tylko na ekranie logowania.
export async function collageSvgs(onColumn: (svgs: string[]) => void, alive = () => true): Promise<void> {
  const ready = svgCache.length - (svgCache.length % PER_COLUMN);
  if (ready) onColumn(svgCache.slice(0, ready));
  if (svgCache.length < CARDS.length) {
    const [{ renderToStaticMarkup }, fonts] = await Promise.all([
      import('react-dom/server'),
      // Fonty z lokalnego /fonts jako data URL w SVG (obrazek nie ładuje plików z zewnątrz); brak pliku = system-ui.
      Promise.all([...new Set(CARDS.map(fontOf))].map((id) => loadFontCss(id).then((css) => [id, css] as const))).then(
        (all): Partial<Record<FontId, string>> => Object.fromEntries(all),
      ),
    ]);
    for (let i = svgCache.length; i < CARDS.length; i++) {
      await new Promise((r) => setTimeout(r));
      if (!alive()) return;
      const card = CARDS[i];
      const { activity, streams, map } = demoRun(i);
      const photo = await photoFor(card);
      if (!alive()) return;
      svgCache.push(
        renderToStaticMarkup(
          <Postcard
            activity={activity}
            background={photo ? 'photo' : card.theme ? 'map' : 'gradient'}
            map={map}
            photo={photo ? { href: photo, dim: 0.3 } : undefined}
            theme={card.theme}
            font={fontOf(card)}
            fontCss={fonts[fontOf(card)]}
            streams={streams}
            view={photo ? undefined : card.view}
            layout={resolveLayout(photo ? card.photo!.layout : card.layout)}
            route={!photo || card.photo!.route !== false}
          />,
        ),
      );
      if ((i + 1) % PER_COLUMN === 0) onColumn(svgCache.slice(0, i + 1));
    }
  }
}

export function CollageColumns({ urls }: { urls: string[] }) {
  return (
    <div className="login-collage" aria-hidden="true">
      {COLUMNS.map((cards, c) => {
        const own = urls.slice(c * cards.length, (c + 1) * cards.length);
        return (
          <div className="login-column" key={c}>
            {/* Dwa razy te same karty: przesunięcie o -50% wraca do identycznego widoku (pętla bez szwu). */}
            {[...own, ...own].map((src, i) => (
              <img className="login-card" key={i} src={src} alt="" draggable={false} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Kolaż przykładowych pocztówek z wymyślonymi biegami i mapą (bez sieci); ruch tylko w CSS.
// Liczony po pierwszym malowaniu, kolumnami: renderToStaticMarkup nie może działać w trakcie renderu Reacta.
const Collage = memo(function Collage() {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const made: string[] = [];
    collageSvgs(
      (svgs) => {
        for (let i = made.length; i < svgs.length; i++) made.push(URL.createObjectURL(new Blob([svgs[i]], { type: 'image/svg+xml' })));
        setUrls(made.slice());
      },
      () => live,
    ).catch(() => {}); // ozdoba: bez kolażu ekran logowania dalej działa
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  return <CollageColumns urls={urls} />;
});

export function LoginScreen() {
  return (
    <div className="screen login">
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
