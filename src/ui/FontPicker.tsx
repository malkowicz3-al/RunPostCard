import { FONTS, fontFaceRule, fontStack, type FontId } from '../lib/fonts';

// Podgląd fontów: zwykłe @font-face z plików (nie data URL), bo to tylko interfejs, nie eksport.
const FACES = (Object.keys(FONTS) as FontId[]).map((id) => fontFaceRule(id, '/fonts/' + FONTS[id].file)).join('');

export function FontPicker({ font, onFont }: { font: FontId; onFont: (font: FontId) => void }) {
  return (
    <>
      {/* Poza .look-tiles, bo :first-child centruje rząd kafelków. */}
      <style>{FACES}</style>
      <div className="look-tiles" role="group" aria-label="Font">
        {(Object.keys(FONTS) as FontId[]).map((id) => (
          <button key={id} className="look-tile" aria-pressed={font === id} onClick={() => onFont(id)}>
            <span
              className="look-preview font-sample"
              style={{ fontFamily: fontStack(id), fontWeight: FONTS[id].weight }}
              aria-hidden="true"
            >
              21.3
            </span>
            <span className="look-label">{FONTS[id].label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
