import { useRef } from 'react';
import { THEMES, type ThemeId } from '../postcard/themes';
import { NEON_ACCENTS } from '../postcard/themes/neon';
import { GENRES, GENRE_IDS, type GenreId } from '../world/genres';
import { gradientCss } from '../postcard/Background';
import { RouteThumb } from './RouteThumb';
import { Select } from './Select';

export type Look = 'gradient' | 'transparent' | 'photo' | 'world' | ThemeId;
// 'gradient' = tło awaryjne (bez trasy albo po błędzie mapy), na liście tylko wtedy.
type Background = 'gradient' | 'transparent' | 'photo' | 'map' | 'world';

const THEME_IDS = Object.keys(THEMES) as ThemeId[];
const THEME_OPTIONS = THEME_IDS.map((id) => ({ id, label: THEMES[id].label }));
const GENRE_OPTIONS = GENRE_IDS.map((id) => ({ id, label: GENRES[id].label }));
const isTheme = (look: Look): look is ThemeId => look in THEMES;

export function LookPicker({
  polyline,
  hasRoute,
  look,
  onLook,
  accent,
  onAccent,
  onPhotoFile,
  photoBusy,
  photoHref,
  worldGenre,
  onWorldGenre,
  worldVariant,
  onWorldVariant,
  onNewWorld,
}: {
  polyline: string;
  hasRoute: boolean;
  look: Look;
  onLook: (look: Look) => void;
  accent: string;
  onAccent: (accent: string) => void;
  onPhotoFile: (file: File) => void;
  photoBusy?: boolean;
  photoHref?: string;
  worldGenre: GenreId;
  onWorldGenre: (id: GenreId) => void;
  worldVariant: string;
  onWorldVariant: (id: string) => void;
  onNewWorld: () => void; // nowe ziarno świata
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // „Map” wraca do ostatnio wybranego motywu.
  const lastTheme = useRef<ThemeId>('dark');
  if (isTheme(look)) lastTheme.current = look;
  // Look 'gradient' (bez trasy albo po błędzie mapy) nie ma pozycji w liście, więc Select pokazuje pustą etykietę.
  const background: Background = isTheme(look) ? 'map' : look;
  const genre = GENRES[worldGenre];
  const custom = !NEON_ACCENTS.some(([c]) => c === accent);

  const themeThumb = (id: ThemeId) => (
    <RouteThumb
      polyline={polyline}
      style={THEMES[id].style({ accent })}
      route={THEMES[id].render({}, { accent }).route.stroke}
    />
  );

  // Miniatura bez mapy i dekoracji: tło i kolor trasy gatunku.
  const worldThumb = (id: GenreId) => (
    <span className="look-preview" style={{ background: GENRES[id].theme.style().background }}>
      <RouteThumb polyline={polyline} style={null} route={GENRES[id].theme.render({}).route.stroke} />
    </span>
  );

  const backgrounds: { id: Background; label: string }[] = [
    ...(!hasRoute || look === 'gradient' ? [{ id: 'gradient' as const, label: 'Plain' }] : []),
    { id: 'transparent', label: 'Transparent' },
    { id: 'photo', label: photoBusy ? 'Loading…' : 'Photo' },
    // Bez trasy nie ma projekcji, więc nie ma też mapy.
    ...(hasRoute ? [{ id: 'map' as const, label: 'Map' }, { id: 'world' as const, label: 'World' }] : []),
  ];

  const backgroundPreview = (id: Background) => {
    if (id === 'map') return themeThumb(lastTheme.current);
    if (id === 'world') return worldThumb(worldGenre);
    if (id === 'photo')
      return photoHref ? (
        <span className="look-preview look-photo" style={{ backgroundImage: `url(${photoHref})` }} />
      ) : (
        <span className="look-preview font-sample">+</span>
      );
    if (id === 'gradient')
      return (
        <span className="look-preview" style={{ background: gradientCss() }}>
          <RouteThumb polyline={polyline} style={null} route="#ffffff" />
        </span>
      );
    return (
      <span className="look-preview checkerboard">
        <RouteThumb polyline={polyline} style={null} route="#ffffff" />
      </span>
    );
  };

  const chooseBackground = (id: Background) => {
    if (id === 'map') onLook(lastTheme.current);
    else if (id === 'world') onLook('world');
    // Bez wgranego zdjęcia wybór „Photo” od razu otwiera wybór pliku.
    else if (id === 'photo' && !photoHref) fileInput.current?.click();
    else onLook(id);
  };

  return (
    <>
      <section className="panel-section">
        <h3 className="panel-heading">Background</h3>
        <Select
          label="Background"
          className="look-select"
          value={background}
          options={backgrounds}
          onChange={chooseBackground}
          preview={backgroundPreview}
        />
        {background === 'photo' && (
          <div className="toggle-row">
            <button className="toggle" onClick={() => fileInput.current?.click()}>
              Change photo
            </button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPhotoFile(file);
            e.target.value = '';
          }}
        />
      </section>
      {look === 'world' && (
        <section className="panel-section">
          <h3 className="panel-heading">World</h3>
          <Select
            label="World style"
            className="look-select"
            value={worldGenre}
            options={GENRE_OPTIONS}
            onChange={onWorldGenre}
            preview={worldThumb}
          />
          {genre.variants && (
            <div className="swatches" role="group" aria-label={`${genre.label} color`}>
              {genre.variants.map((v) => (
                <button
                  key={v.id}
                  className="swatch"
                  aria-label={v.label}
                  aria-pressed={worldVariant === v.id}
                  style={{ background: v.swatch }}
                  onClick={() => onWorldVariant(v.id)}
                />
              ))}
            </div>
          )}
          {genre.reseed && (
            <div className="toggle-row">
              <button className="toggle" onClick={onNewWorld}>
                New world
              </button>
            </div>
          )}
        </section>
      )}
      {isTheme(look) && (
        <section className="panel-section">
          <h3 className="panel-heading">Map style</h3>
          <Select
            label="Map style"
            className="look-select"
            value={look}
            options={THEME_OPTIONS}
            onChange={onLook}
            preview={themeThumb}
          />
          {look === 'neon' && (
            <div className="swatches" role="group" aria-label="Neon color">
              {NEON_ACCENTS.map(([color, name]) => (
                <button
                  key={color}
                  className="swatch"
                  aria-label={name}
                  aria-pressed={accent === color}
                  style={{ background: color }}
                  onClick={() => onAccent(color)}
                />
              ))}
              <label className="swatch swatch-custom" data-selected={custom} style={custom ? { background: accent } : undefined}>
                <input type="color" aria-label="Custom color" value={accent} onChange={(e) => onAccent(e.target.value)} />
              </label>
            </div>
          )}
        </section>
      )}
    </>
  );
}
