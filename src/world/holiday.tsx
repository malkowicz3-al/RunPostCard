import { MapBackground } from '../postcard/MapBackground';
import type { MapStyle } from '../postcard/mapStyle';
import type { ReactNode, SVGProps } from 'react';
import type { FontId } from '../lib/fonts';
import type { Rect } from '../lib/mapTiles';
import type { MapLayers } from '../lib/vectorMap';
import type { MapTheme } from '../postcard/themes';
import type { StravaMarkVariant } from '../postcard/StravaMark';
import { Outline } from '../postcard/themes/texture';
import { parseLines } from './geom';
import type { Pt } from './grid';
import { center, corners, houseIcons, keepOutDist, landmarks, type House } from './icons';

// Wspólny szkielet stylów świątecznych (Christmas, New Year, Easter, Valentine): mapa jak w Bright (ulice z obrzeżem,
// ulica trasy najszersza), na niej statyczne ozdoby przy domkach i punktach orientacyjnych (houseIcons/landmarks
// z ./icons), rysunki w górnych rogach w nakładce. Ozdoby tylko płasko: Postcard w 3D usuwa warstwę building.
export const WIDTHS: MapStyle['widths'] = { water: 3, building: 1.2, waterway: 3, path: 1.2, minor: 4, mid: 7, major: 24, rail: 1.6, tunnel: 1.4, bridge: 5, runway: 6 };
export const DASHES: MapStyle['dashes'] = { path: '2 4', rail: '8 5', tunnel: '4 4' };
const CASINGS = [['minor', 6], ['mid', 10], ['major', 30]] as const;

export type Spots = { houses: House[]; marks: Pt[] };
export type HolidaySpec = {
  id: string;
  label: string;
  font: FontId;
  style: MapStyle;
  casing: string;
  route: { stroke: string; outline: string };
  text: string;
  halo: string; // obwódka statystyk: czytelne nad bryłami w 3D
  mark: StravaMarkVariant;
  defs?: ReactNode; // wzory i filtry z id world-<id>-…
  decor: (spots: Spots) => ReactNode;
  overlay: (first: Pt, second: Pt) => ReactNode; // first: rysunek w rogu COMPASS_BOX, second: SERPENT_BOX (./icons)
};

export const r1 = (v: number) => Math.round(v * 10) / 10;
export const dot = (x: number, y: number, r: number) => `M${r1(x - r)} ${r1(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
export const oval = (x: number, y: number, rx: number, ry: number) =>
  `M${r1(x - rx)} ${r1(y)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
// Promienie (fajerwerki, płatki śniegu): n kresek od r0 do r1 wokół (x, y).
export const rays = (x: number, y: number, from: number, to: number, n: number, turn = 0) => {
  let d = '';
  for (let k = 0; k < n; k++) {
    const a = ((k * 360) / n + turn) * (Math.PI / 180);
    d += `M${r1(x + from * Math.cos(a))} ${r1(y + from * Math.sin(a))}L${r1(x + to * Math.cos(a))} ${r1(y + to * Math.sin(a))}`;
  }
  return d;
};

// Jedna ścieżka na kolor: części [kolor, d] sklejone; stroke = kolor jako kreska zamiast wypełnienia.
export function paint(parts: [string, string][], props: SVGProps<SVGPathElement> = {}, stroke = false): ReactNode {
  const by = new Map<string, string>();
  for (const [c, d] of parts) by.set(c, (by.get(c) ?? '') + d);
  return [...by].map(([c, d]) =>
    stroke ? <path key={c} d={d} fill="none" stroke={c} strokeLinecap="round" {...props} /> : <path key={c} d={d} fill={c} {...props} />,
  );
}

export function holidayTheme(spec: HolidaySpec): MapTheme {
  const { id, style } = spec;
  // Scena bez <defs> (id są w render().scene); refined w Postcard rysuje ją we własnym prostokącie.
  // Najpierw wszystkie obrzeża, potem jezdnie: na skrzyżowaniach bez szarych pasów w poprzek ulic.
  const floor = (layers: MapLayers, rect?: Rect): ReactNode => {
    const shown = layers.building ? layers.buildings : undefined;
    const markSet = landmarks(shown);
    // Ozdoby z dala od znaku Stravy i podpisu OSM (zasięg ok. 24 px przy domkach, 70 px przy punktach orientacyjnych).
    const houses = houseIcons(shown, markSet).filter((h) => keepOutDist(h.x, h.y) > 24);
    const marks = markSet.map((b) => center(b).map(Math.round) as Pt).filter(([x, y]) => keepOutDist(x, y) > 70);
    return (
      <>
        <MapBackground layers={{ ...layers, minor: undefined, mid: undefined, major: undefined }} style={style} rect={rect} />
        <g fill="none" strokeLinejoin="round" strokeLinecap="round">
          {CASINGS.map(([k, w]) => layers[k] && <path key={`c${k}`} d={layers[k]} stroke={spec.casing} strokeWidth={w} />)}
          {CASINGS.map(([k]) => layers[k] && <path key={k} d={layers[k]} stroke={style.colors[k]} strokeWidth={style.widths[k]} />)}
        </g>
        {(houses.length > 0 || marks.length > 0) && <g className="world-decor">{spec.decor({ houses, marks })}</g>}
      </>
    );
  };
  return {
    label: spec.label,
    font: spec.font,
    style: () => style,
    floor,
    render: (layers) => {
      const [first, second] = corners(parseLines(layers.major)[0] ?? []);
      return {
        scene: (
          <>
            <defs>
              <Outline id={`world-${id}-route`} color={spec.route.outline} radius={4} />
              <Outline id={`world-${id}-text`} color={spec.halo} radius={4} />
              {spec.defs}
            </defs>
            {floor(layers)}
          </>
        ),
        overlay: spec.overlay(first, second),
        route: { stroke: spec.route.stroke, width: 16, filter: `url(#world-${id}-route)` },
        text: { color: spec.text, filter: `url(#world-${id}-text)` },
        mark: spec.mark,
      };
    },
  };
}
