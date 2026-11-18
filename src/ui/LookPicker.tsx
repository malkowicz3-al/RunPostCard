import type { ReactNode } from 'react';
import { THEMES, type ThemeId } from '../postcard/themes';
import { NEON_ACCENTS } from '../postcard/themes/neon';
import { RouteThumb } from './RouteThumb';

export type Look = 'gradient' | 'transparent' | ThemeId;

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
}: {
  polyline: string;
  hasRoute: boolean;
  look: Look;
  onLook: (look: Look) => void;
  accent: string;
  onAccent: (accent: string) => void;
}) {
  const tile = (value: Look, label: string, preview: ReactNode, className = '') => (
    <button
      key={value}
      className="look-tile"
      aria-pressed={look === value}
      onClick={() => onLook(value)}
    >
      <span className={`look-preview ${className}`}>{preview}</span>
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
        {/* Bez trasy nie ma projekcji, więc nie ma też mapy. */}
        {hasRoute &&
          (Object.keys(THEMES) as ThemeId[]).map((id) => {
            const theme = THEMES[id];
            const route = theme.render({}, { accent }).route.stroke;
            return tile(id, theme.label, <RouteThumb polyline={polyline} style={theme.style({ accent })} route={route} />);
          })}
      </div>
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
