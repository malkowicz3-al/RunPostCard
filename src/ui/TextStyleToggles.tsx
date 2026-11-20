import type { ReactNode } from 'react';
import type { TextStyle } from '../postcard/SlotNumber';

// Ikony jako ścieżki (bez <text>), żeby nie zależały od fontu.
const ICONS: [keyof TextStyle, string, ReactNode][] = [
  ['bold', 'Bold', <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />],
  ['italic', 'Italic', <path d="M10 5h8M6 19h8M14 5l-4 14" />],
  ['outline', 'Outline', <path d="M6 19L12 5l6 14M8.5 13h7" strokeDasharray="2 2" />],
  [
    'shadow',
    'Shadow',
    <>
      <path d="M9 8h8v8H9z" fill="currentColor" stroke="none" opacity={0.35} />
      <path d="M6 5h8v8H6z" fill="currentColor" stroke="none" />
    </>,
  ],
];

export function TextStyleToggles({ value, onChange }: { value: TextStyle; onChange: (v: TextStyle) => void }) {
  return (
    <div className="toggle-row">
      Text
      <div className="toggle-group" role="group" aria-label="Text style">
        {ICONS.map(([k, label, icon]) => (
          <button
            key={k}
            className="toggle icon-toggle"
            aria-label={label}
            title={label}
            aria-pressed={!!value[k]}
            onClick={() => onChange({ ...value, [k]: !value[k] })}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icon}
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
