import type { ReactNode } from 'react';
import type { MapLayers } from '../../lib/vectorMap';
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

export type MapTheme = { label: string; render: (layers: MapLayers) => ThemeOutput };

export const THEMES: Record<ThemeId, MapTheme> = { dark, light, neon };
