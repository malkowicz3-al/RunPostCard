import { useRef, type CSSProperties, type ReactNode } from 'react';
import { THEMES, type ThemeId } from '../postcard/themes';
import { NEON_ACCENTS } from '../postcard/themes/neon';
import { RouteThumb } from './RouteThumb';

export type Look = 'gradient' | 'transparent' | 'photo' | ThemeId;

const PLAIN: [Look, string][] = [
  ['gradient', 'Gradient'],
  ['transparent', 'Transparent'],
];

export function LookPicker({
  polyline,
  hasRoute,
  look,
  onLook,
  accent,
  onAccent,
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
  photoHref?: string;
  onPhotoFile: (file: File) => void;
  photoBusy?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const tile = (
    value: Look,
    label: string,
    preview: ReactNode,
    className = '',
    onClick = () => onLook(value),
    style?: CSSProperties,
  ) => (
    <button key={value} className="look-tile" aria-pressed={look === value} onClick={onClick}>
      <span className={`look-preview ${className}`} style={style}>
        {preview}
      </span>
      <span className="look-label">{label}</span>
    </button>
  );
  const custom = !NEON_ACCENTS.some(([c]) => c === accent);

  return (
    <>
      <div className="look-tiles" role="group" aria-label="Style">
        {PLAIN.map(([value, label]) =>
          tile(
            value,
            label,
            <RouteThumb polyline={polyline} style={null} route="#ffffff" />,
            value === 'gradient' ? 'look-gradient' : 'checkerboard',
          ),
        )}
        {/* Drugie kliknięcie w wybrane zdjęcie (albo pierwsze, gdy go brak) otwiera wybór pliku. */}
        {tile(
          'photo',
          photoBusy ? 'Loading…' : 'Photo',
          photoHref ? null : '+',
          photoHref ? 'look-photo' : 'look-photo font-sample',
          () => (look === 'photo' || !photoHref ? fileInput.current?.click() : onLook('photo')),
          photoHref ? { backgroundImage: `url(${photoHref})` } : undefined,
        )}
        {/* Bez trasy nie ma projekcji, więc nie ma też mapy. */}
        {hasRoute &&
          (Object.keys(THEMES) as ThemeId[]).map((id) => {
            const theme = THEMES[id];
            const route = theme.render({}, { accent }).route.stroke;
            return tile(id, theme.label, <RouteThumb polyline={polyline} style={theme.style({ accent })} route={route} />);
          })}
      </div>
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
            <input
              type="color"
              aria-label="Custom color"
              value={accent}
              onChange={(e) => onAccent(e.target.value)}
            />
          </label>
        </div>
      )}
    </>
  );
}
