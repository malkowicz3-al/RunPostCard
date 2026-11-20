import type { MapTheme } from '../postcard/themes';
import { fantasy } from './fantasy';
import { scifi } from './scifi';

// Gatunki świata na prawdziwej mapie (ADR 0013): motyw poza THEMES, kolory brył (neon albo dach; bez koloru trasy),
// szyldy, pojazdy i ich wygląd; flat: tylko widok płaski (ilustrowana mapa bez 3D).
export type GenreId = 'scifi' | 'fantasy';
export type Genre = {
  label: string;
  theme: MapTheme;
  props: { cars: number; ships: number; look: { cars: string[]; trail?: string; ship: string; engine: string; glow: boolean } };
  accents: string[];
  signs: boolean;
  flat?: boolean;
};

export const GENRES: Record<GenreId, Genre> = {
  scifi: {
    label: 'Sci-fi',
    theme: scifi,
    props: { cars: 48, ships: 6, look: { cars: ['#2ef2ff', '#ff2bd6'], trail: '#ff3fc8', ship: '#c8fbff', engine: '#ff3fc8', glow: true } },
    accents: ['#ff2bd6', '#2ef2ff', '#a45bff', '#5dff7a', '#ff8a3d'],
    signs: true,
  },
  fantasy: {
    label: 'Fantasy',
    theme: fantasy,
    // Statki rysuje sam motyw (z wody), więc bez pojazdów; accents = kolory dachów domków.
    props: { cars: 0, ships: 0, look: { cars: [], ship: '#ffffff', engine: '#ffffff', glow: false } },
    accents: ['#b5442f', '#a63d2a', '#c4512f', '#8f3a2a'],
    signs: false,
    flat: true,
  },
};
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];
