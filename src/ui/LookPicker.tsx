import { useRef } from 'react';
import { THEMES, type ThemeId } from '../postcard/themes';
import { NEON_ACCENTS } from '../postcard/themes/neon';
import { GRADIENTS, GRADIENT_IDS, gradientCss, type GradientId } from '../postcard/Background';
import { RouteThumb } from './RouteThumb';
import { Select } from './Select';

export type Look = 'gradient' | 'transparent' | 'photo' | ThemeId;
type Background = 'gradient' | 'transparent' | 'photo' | 'map';

const THEME_IDS = Object.keys(THEMES) as ThemeId[];
const THEME_OPTIONS = THEME_IDS.map((id) => ({ id, label: THEMES[id].label }));
const GRADIENT_OPTIONS = GRADIENT_IDS.map((id) => ({ id, label: GRADIENTS[id].label }));
const isTheme = (look: Look): look is ThemeId => look in THEMES;

export function LookPicker({
  polyline,
  hasRoute,
  look,
  onLook,
  accent,
  onAccent,
  gradient,
  onGradient,
  photoHref,
  onPhotoFile,
  photoBusy,
}: {
  polyline: string;
  hasRoute: boolean;
  look: Look;
  onLook: (look: Look) => void;
  accent: string;
  onAccent: (accent: string) => void;
  gradient: GradientId;
  onGradient: (id: GradientId) => void;
  photoHref?: string;
  onPhotoFile: (file: File) => void;
  photoBusy?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // „Map” wraca do ostatnio wybranego motywu.
  const lastTheme = useRef<ThemeId>('dark');
  if (isTheme(look)) lastTheme.current = look;
  const background: Background = isTheme(look) ? 'map' : look;
  const custom = !NEON_ACCENTS.some(([c]) => c === accent);

  const themeThumb = (id: ThemeId) => (
    <RouteThumb
      polyline={polyline}
      style={THEMES[id].style({ accent })}
      route={THEMES[id].render({}, { accent }).route.stroke}
    />
  );

  const backgrounds: { id: Background; label: string }[] = [
    { id: 'gradient', label: 'Gradient' },
    { id: 'transparent', label: 'Transparent' },
    { id: 'photo', label: photoBusy ? 'Loading…' : 'Photo' },
    // Bez trasy nie ma projekcji, więc nie ma też mapy.
    ...(hasRoute ? [{ id: 'map' as const, label: 'Map' }] : []),
  ];

  const backgroundPreview = (id: Background) => {
    if (id === 'map') return themeThumb(lastTheme.current);
    if (id === 'photo')
      return photoHref ? (
        <span className="look-preview look-photo" style={{ backgroundImage: `url(${photoHref})` }} />
      ) : (
        <span className="look-preview font-sample">+</span>
      );
    return (
      <span
        className={`look-preview${id === 'gradient' ? '' : ' checkerboard'}`}
        style={id === 'gradient' ? { background: gradientCss(gradient) } : undefined}
      >
        <RouteThumb polyline={polyline} style={null} route="#ffffff" />
      </span>
    );
  };

  const chooseBackground = (id: Background) => {
    if (id === 'map') onLook(lastTheme.current);
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
        {look === 'photo' && (
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
      {look === 'gradient' && (
        <section className="panel-section">
          <h3 className="panel-heading">Gradient</h3>
          <Select
            label="Gradient"
            className="look-select"
            value={gradient}
            options={GRADIENT_OPTIONS}
            onChange={onGradient}
            preview={(id) => <span className="look-preview" style={{ background: gradientCss(id) }} />}
          />
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
