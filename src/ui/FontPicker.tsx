import { useState } from 'react';
import { FONTS, fontFaceRule, fontStack, type FontId } from '../lib/fonts';
import { Select } from './Select';

const IDS = Object.keys(FONTS) as FontId[];
// Podgląd fontów: zwykłe @font-face z plików (nie data URL), bo to tylko interfejs, nie eksport.
const face = (id: FontId) => fontFaceRule(id, '/fonts/' + FONTS[id].file);
const ALL_FACES = IDS.map(face).join('');

const sampleStyle = (id: FontId) => ({ fontFamily: fontStack(id), fontWeight: FONTS[id].weight });
const OPTIONS = IDS.map((id) => ({ id, label: FONTS[id].label, group: FONTS[id].group, style: sampleStyle(id) }));

export function FontPicker({ font, onFont }: { font: FontId; onFont: (font: FontId) => void }) {
  // Wszystkie fonty (ok. 2 MB) pobieramy dopiero przy pierwszym otwarciu listy.
  const [allFaces, setAllFaces] = useState(false);
  return (
    <section className="panel-section">
      <h3 className="panel-heading">Font</h3>
      <style>{allFaces ? ALL_FACES : face(font)}</style>
      <Select
        label="Font"
        className="font-select"
        value={font}
        options={OPTIONS}
        onChange={onFont}
        onOpen={() => setAllFaces(true)}
        preview={(id) => <span style={sampleStyle(id)}>21.3</span>}
      />
    </section>
  );
}
