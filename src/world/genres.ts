import type { MapTheme } from '../postcard/themes';
import { scifi } from './scifi';

// Gatunki świata generowanego (ADR 0012): motyw poza THEMES, bok kwartału w px płótna, wysokości brył w m, limity pojazdów,
// neony brył (okna, krawędzie, szyldy; bez żółci trasy).
export type GenreId = 'scifi';
export type Genre = {
  label: string;
  theme: MapTheme;
  block: number;
  heights: [number, number];
  props: { cars: number; ships: number };
  accents: string[];
};

export const GENRES: Record<GenreId, Genre> = {
  scifi: {
    label: 'Sci-fi',
    theme: scifi,
    block: 84,
    heights: [40, 220],
    props: { cars: 48, ships: 6 },
    accents: ['#ff2bd6', '#2ef2ff', '#a45bff', '#5dff7a', '#ff8a3d'],
  },
};
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];
