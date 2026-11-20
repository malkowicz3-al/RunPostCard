import type { ReactNode } from 'react';
import type { FontId } from '../../lib/fonts';
import type { MapLayers } from '../../lib/vectorMap';
import type { MapStyle } from '../mapStyle';
import type { RouteStyle } from '../Route';
import type { StravaMarkVariant } from '../StravaMark';
import { dark } from './dark';
import { light } from './light';
import { neon } from './neon';
import { ocean } from './ocean';
import { forest } from './forest';
import { sunset } from './sunset';
import { mint } from './mint';
import { mono } from './mono';
import { slate } from './slate';
import { sand } from './sand';
import { plum } from './plum';
import { rose } from './rose';
import { coal } from './coal';
import { blueprint } from './blueprint';
import { pencil } from './pencil';
import { watercolor } from './watercolor';
import { vintage } from './vintage';
import { riso } from './riso';
import { chalk } from './chalk';
import { halftone } from './halftone';
import { synthwave } from './synthwave';
import { terminal } from './terminal';
import { ink } from './ink';
import { digitalrain } from './digitalrain';
import { lightgrid } from './lightgrid';
import { galaxy } from './galaxy';
import { dune } from './dune';
import { redfog } from './redfog';
import { spellbook } from './spellbook';
import { popcomic } from './popcomic';
import { bricks } from './bricks';
import { arcademaze } from './arcademaze';
import { dollhouse } from './dollhouse';
import { handheld } from './handheld';
import { vectorarcade } from './vectorarcade';
import { dungeon } from './dungeon';
import { spaceshooter } from './spaceshooter';
import { voxel } from './voxel';
import { nightvision } from './nightvision';
import { kartrace } from './kartrace';
import { cyberhud } from './cyberhud';
import { overworld } from './overworld';
import { pinball } from './pinball';

// Motywy map na pocztówce: tylko stylistyka (ADR 0005). Nowy motyw = plik w themes/ + wpis w THEMES.
export type ThemeId =
  | 'dark'
  | 'light'
  | 'neon'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'mint'
  | 'mono'
  | 'slate'
  | 'sand'
  | 'plum'
  | 'rose'
  | 'coal'
  | 'blueprint'
  | 'pencil'
  | 'watercolor'
  | 'vintage'
  | 'riso'
  | 'chalk'
  | 'halftone'
  | 'synthwave'
  | 'terminal'
  | 'ink'
  | 'digitalrain'
  | 'lightgrid'
  | 'galaxy'
  | 'dune'
  | 'redfog'
  | 'spellbook'
  | 'popcomic'
  | 'bricks'
  | 'arcademaze'
  | 'dollhouse'
  | 'handheld'
  | 'vectorarcade'
  | 'dungeon'
  | 'spaceshooter'
  | 'voxel'
  | 'nightvision'
  | 'kartrace'
  | 'cyberhud'
  | 'overworld'
  | 'pinball';

export type ThemeOutput = {
  scene: ReactNode; // pod trasą: <defs>, tło, warstwy mapy
  overlay?: ReactNode; // faktura papieru nad mapą (także nad ostrzejszym fragmentem 3D), pod trasą
  route: RouteStyle;
  text: { color: string; filter?: string };
  mark: StravaMarkVariant;
};

export type ThemeOptions = { accent?: string }; // accent: kolor neonu; Dark i Light ignorują

export type MapTheme = {
  label: string;
  font: FontId; // font ustawiany przy wyborze motywu; potem można go zmienić
  style: (opts?: ThemeOptions) => MapStyle; // paleta jako dane (miniatury w wyborze wyglądu)
  render: (layers: MapLayers, opts?: ThemeOptions) => ThemeOutput;
};

export const THEMES: Record<ThemeId, MapTheme> = {
  dark, light, neon, ocean, forest, sunset, mint, mono, slate, sand, plum, rose, coal, blueprint, pencil, watercolor, vintage, riso, chalk, halftone, synthwave, terminal, ink,
  digitalrain, lightgrid, galaxy, dune, redfog, spellbook, popcomic, bricks, arcademaze, dollhouse,
  handheld, vectorarcade, dungeon, spaceshooter, voxel, nightvision, kartrace, cyberhud, overworld, pinball,
};
