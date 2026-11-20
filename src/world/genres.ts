import type { MapTheme } from '../postcard/themes';
import { fantasy } from './fantasy';
import { postapo } from './postapo';
import { scifi } from './scifi';

// Gatunki świata na prawdziwej mapie (ADR 0013): motyw poza THEMES, kolory brył (neon albo dach; bez koloru trasy),
// szyldy, gęstość zabudowy (keep), ruiny (ruin: odsetek brył z obciętą wysokością), pojazdy i ich wygląd.
export type GenreId = 'scifi' | 'fantasy' | 'postapo';
export type Genre = {
  label: string;
  theme: MapTheme;
  props: { cars: number; ships: number; look: { cars: string[]; trail?: string; ship: string; engine: string; glow: boolean } };
  accents: string[];
  signs: boolean;
  keep: number;
  ruin: number;
};

export const GENRES: Record<GenreId, Genre> = {
  scifi: {
    label: 'Sci-fi',
    theme: scifi,
    props: { cars: 48, ships: 6, look: { cars: ['#2ef2ff', '#ff2bd6'], trail: '#ff3fc8', ship: '#c8fbff', engine: '#ff3fc8', glow: true } },
    accents: ['#ff2bd6', '#2ef2ff', '#a45bff', '#5dff7a', '#ff8a3d'],
    signs: true,
    keep: 1,
    ruin: 0,
  },
  fantasy: {
    label: 'Fantasy',
    theme: fantasy,
    props: { cars: 0, ships: 0, look: { cars: [], ship: '#ffffff', engine: '#ffffff', glow: false } },
    accents: ['#b5442f', '#c9a24a', '#5d6b74', '#a35a3a', '#7a6a48'],
    signs: false,
    keep: 0.75,
    ruin: 0,
  },
  postapo: {
    label: 'Post-apo',
    theme: postapo,
    // Wraki aut w rdzy, bez smugi i poświaty.
    props: { cars: 20, ships: 0, look: { cars: ['#7a3e1e', '#5a4a3a'], ship: '#8a7a6a', engine: '#5a4a3a', glow: false } },
    accents: ['#8a4b2a', '#6e5a48', '#a0623a', '#59514a', '#7d6a3c'],
    signs: false,
    keep: 1,
    ruin: 0.5,
  },
};
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];
