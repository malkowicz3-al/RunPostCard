import type { MapTheme } from '../postcard/themes';
import { scifi } from './scifi';

// Gatunki świata generowanego (ADR 0012): motyw poza THEMES, bok kwartału w px płótna, wysokości brył w m, limity pojazdów.
export type GenreId = 'scifi';
export type Genre = { label: string; theme: MapTheme; block: number; heights: [number, number]; props: { cars: number; ships: number } };

export const GENRES: Record<GenreId, Genre> = {
  scifi: { label: 'Sci-fi', theme: scifi, block: 84, heights: [40, 220], props: { cars: 48, ships: 6 } },
};
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];
