import type { ReactNode } from 'react';
import type { Activity } from '../../strava/api';
import type { MapProfile } from '../../lib/vectorMap';
import type { RouteStyle } from '../Route';
import type { StravaMarkVariant } from '../StravaMark';
import type { PlaceInput } from './geometry';
import { minimal } from './minimal';
import { pixel } from './pixel';
import { fantasy } from './fantasy';

// Motywy map na pocztówce (ADR 0005). Nowy motyw = plik w themes/ + wpis w THEMES.
export type ThemeId = 'minimal' | 'pixel' | 'fantasy';

// map, size, route (punkty w układzie płótna), seed (hashSeed(activity.id)), exclude (sloty, znak Stravy, podpis).
export type ThemeInput = PlaceInput & { activity: Activity };

export type ThemeOutput = {
  scene: ReactNode; // pod trasą: <defs>, tło, warstwy mapy, ikony
  overlay?: ReactNode; // nad trasą, pod slotami
  route: RouteStyle & { stroke: string; width: number; d?: string }; // d nadpisuje ścieżkę trasy
  text: { color: string; outline?: string; outlineWidth?: number };
  mark: StravaMarkVariant;
};

export type MapTheme = { label: string; profile: MapProfile; render: (input: ThemeInput) => ThemeOutput };

export const THEMES: Record<ThemeId, MapTheme> = { minimal, pixel, fantasy };

// Motyw do narysowania: wybrany, jeśli dane mapy są dla jego profilu; inaczej poprzedni, aż przyjdą nowe.
export const shownTheme = (chosen: ThemeId, rendered: ThemeId, dataProfile?: MapProfile): ThemeId =>
  THEMES[chosen].profile === dataProfile ? chosen : rendered;
