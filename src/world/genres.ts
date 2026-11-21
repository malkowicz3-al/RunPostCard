import { shiftHue } from '../lib/color';
import type { MapTheme } from '../postcard/themes';
import { bright } from './bright';
import { fantasy } from './fantasy';
import { medieval } from './medieval';
import { postapo } from './postapo';
import { SCIFI_VARIANTS, scifi, scifiTheme } from './scifi';

// Gatunki świata na prawdziwej mapie (ADR 0013): motyw poza THEMES, kolory brył (neon albo dach; bez koloru trasy),
// szyldy, pojazdy i ich wygląd; flat: tylko widok płaski (ilustrowana mapa bez 3D); reseed: przycisk „New world”;
// variants: warianty koloru (obrót odcienia palety).
export type GenreId = 'scifi' | 'fantasy' | 'postapo' | 'bright' | 'medieval';
export type Variant = { id: string; label: string; swatch: string; hue: number; route: string };
export type Genre = {
  label: string;
  theme: MapTheme;
  props: { cars: number; ships: number; look: { cars: string[]; trail?: string; ship: string; engine: string; glow: boolean } };
  accents: string[];
  signs: boolean;
  flat?: boolean;
  reseed?: boolean;
  variants?: Variant[];
};

// Bez pojazdów (statki, jeśli są, rysuje sam motyw).
const NO_PROPS: Genre['props'] = { cars: 0, ships: 0, look: { cars: [], ship: '#ffffff', engine: '#ffffff', glow: false } };

export const GENRES: Record<GenreId, Genre> = {
  scifi: {
    label: 'Sci-fi',
    theme: scifi,
    props: { cars: 48, ships: 6, look: { cars: ['#2ef2ff', '#ff2bd6'], trail: '#ff3fc8', ship: '#c8fbff', engine: '#ff3fc8', glow: true } },
    accents: ['#ff2bd6', '#2ef2ff', '#a45bff', '#5dff7a', '#ff8a3d'],
    signs: true,
    reseed: true,
    variants: SCIFI_VARIANTS,
  },
  fantasy: {
    label: 'Fantasy',
    theme: fantasy,
    // accents = kolory dachów domków.
    props: NO_PROPS,
    accents: ['#b5442f', '#a63d2a', '#c4512f', '#8f3a2a'],
    signs: false,
    flat: true,
  },
  postapo: {
    label: 'Post-apo',
    theme: postapo,
    // accents = kolory rdzy ruin.
    props: NO_PROPS,
    accents: ['#7a3b24', '#8c4a2b', '#6b3320', '#9a5a34'],
    signs: false,
    flat: true,
  },
  bright: {
    label: 'Bright',
    theme: bright,
    // Bez akcentów: w 3D dach w kolorze budynku.
    props: NO_PROPS,
    accents: [],
    signs: false,
  },
  medieval: { label: 'Medieval', theme: medieval, props: NO_PROPS, accents: ['#a5502f', '#8a5a3a', '#7d7a72', '#b86a3c'], signs: false, flat: true },
};
export const GENRE_IDS = Object.keys(GENRES) as GenreId[];

const derived = new Map<string, Genre>();

// Gatunek w wariancie koloru; bez wariantu (albo hue 0) ten sam obiekt co GENRES[id]. Wynik w pamięci podręcznej,
// więc stała tożsamość (memo w PostcardScreen). Warianty ma tylko Sci-fi, stąd scifiTheme.
export function genreDef(id: GenreId, variantId?: string): Genre {
  const base = GENRES[id];
  const variant = base.variants?.find((v) => v.id === variantId);
  if (!variant?.hue) return base;
  const key = `${id}:${variant.id}`;
  const cached = derived.get(key);
  if (cached) return cached;
  const h = (c: string) => shiftHue(c, variant.hue);
  const { look } = base.props;
  const genre: Genre = {
    ...base,
    theme: scifiTheme(variant),
    accents: base.accents.map(h),
    props: {
      ...base.props,
      look: { ...look, cars: look.cars.map(h), trail: look.trail && h(look.trail), ship: h(look.ship), engine: h(look.engine) },
    },
  };
  derived.set(key, genre);
  return genre;
}
