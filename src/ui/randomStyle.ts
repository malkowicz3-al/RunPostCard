import type { RunStreams } from '../strava/api';
import { GRADIENT_IDS, type GradientId } from '../postcard/Background';
import { ROUTE_COLORS, available, type RouteColor } from '../postcard/routeColor';
import { LAYOUTS, type LayoutId } from '../postcard/slots';
import type { TextStyle } from '../postcard/SlotNumber';
import { THEMES, type ThemeId } from '../postcard/themes';
import { FONTS, type FontId } from '../lib/fonts';
import { SCENERY, type SceneryId } from './scenery';

export type RandomBackground = { kind: 'map'; theme: ThemeId } | { kind: 'gradient'; gradient: GradientId } | { kind: 'scenery'; id: SceneryId };
export type RandomStyle = {
  background: RandomBackground | null; // null = tło zostaje (własne zdjęcie)
  font: FontId;
  layout: LayoutId;
  routeColor: RouteColor;
  textStyle: TextStyle;
};

const pickOne = <T,>(xs: readonly T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length) % xs.length];

// Losowy wygląd pocztówki (przycisk Random). Własne zdjęcie użytkownika zostaje; mapa tylko z trasą; styl linii tylko dostępny dla biegu.
export function randomStyle(
  { hasRoute, streams, keepBackground }: { hasRoute: boolean; streams?: RunStreams | null; keepBackground: boolean },
  rnd: () => number = Math.random,
): RandomStyle {
  const kinds: RandomBackground['kind'][] = hasRoute ? ['map', 'map', 'gradient', 'scenery'] : ['gradient', 'scenery'];
  const kind = pickOne(kinds, rnd);
  const background: RandomBackground | null = keepBackground
    ? null
    : kind === 'map'
      ? { kind, theme: pickOne(Object.keys(THEMES) as ThemeId[], rnd) }
      : kind === 'gradient'
        ? { kind, gradient: pickOne(GRADIENT_IDS, rnd) }
        : { kind, id: pickOne(SCENERY, rnd).id };
  return {
    background,
    font: pickOne(Object.keys(FONTS) as FontId[], rnd),
    layout: pickOne(Object.keys(LAYOUTS) as LayoutId[], rnd),
    routeColor: pickOne(ROUTE_COLORS.map((c) => c.id).filter((id) => available(id, streams)), rnd),
    // Bez Outline i Shadow naraz: razem są za ciężkie.
    textStyle: pickOne<TextStyle>([{}, {}, { bold: true }, { italic: true }, { shadow: true }, { outline: true }, { bold: true, shadow: true }], rnd),
  };
}
