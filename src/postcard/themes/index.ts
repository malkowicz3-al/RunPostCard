import type { ReactNode } from 'react';
import type { MapLayers } from '../../lib/vectorMap';
import type { MapStyle } from '../mapStyle';
import type { RouteStyle } from '../Route';
import type { StravaMarkVariant } from '../StravaMark';
import { dark } from './dark';
import { light } from './light';
import { neon } from './neon';

// Motywy map na pocztówce: tylko stylistyka (ADR 0005). Nowy motyw = plik w themes/ + wpis w THEMES.
export type ThemeId = 'dark' | 'light' | 'neon';

export type ThemeOutput = {
  scene: ReactNode; // pod trasą: <defs>, tło, warstwy mapy
  route: RouteStyle;
  text: { color: string; filter?: string };
  mark: StravaMarkVariant;
};

export type ThemeOptions = { accent?: string }; // accent: kolor neonu; Dark i Light ignorują

export type MapTheme = {
  label: string;
  style: (opts?: ThemeOptions) => MapStyle; // paleta jako dane (miniatury w wyborze wyglądu)
  render: (layers: MapLayers, opts?: ThemeOptions) => ThemeOutput;
};

export const THEMES: Record<ThemeId, MapTheme> = { dark, light, neon };
