import type { ReactElement } from 'react';
import type { GeoProjection } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Dem } from '../lib/dem';
import type { MapLayers } from '../lib/vectorMap';
import { encodeMp4 } from '../lib/encodeVideo';
import type { Banner } from '../postcard/Postcard';
import { THEMES, type ThemeId } from '../postcard/themes';
import { offscreenFrames } from '../ui/ExportControls';
import { FOV, cameraAt, povBuildingColor, project, type V3 } from './data';
import { mapImage } from './mapImage';
import { momentsOf } from './moments';
import { createPov, createRenderer, type Pov } from './scene';
import { bannerAlpha, povFrameProgress } from './timeline';

const SIZE: [number, number] = [1080, 1920];
const BANNER_LIFT_M = 25; // napis zaczepiony nad trasą, żeby kreska nie znikała w wstędze

export type PovExportInput = {
  streams: RunStreams;
  projection: GeoProjection;
  layers?: MapLayers;
  theme: ThemeId;
  accent: string;
  dem: Dem | null;
  color?: (t: number) => string; // styl linii; brak = kolor trasy motywu
  route: boolean;
  overlay: (p: number, banner?: Banner) => ReactElement; // pocztówka bare nad klatką WebGL
};

// POV tylko jako plik (ADR 0011): scena WebGL poza ekranem na czas eksportu, zawsze zwalniana.
export async function encodePovMp4(
  input: PovExportInput,
  { onProgress, signal }: { onProgress?: (done: number) => void; signal?: AbortSignal },
): Promise<Blob> {
  const renderer = createRenderer();
  let pov: Pov | null = null;
  try {
    const h = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
    const floor = input.layers ? await mapImage(input.layers, input.theme, input.accent, h / 2, h) : null;
    signal?.throwIfAborted();
    const style = THEMES[input.theme].style({ accent: input.accent });
    const stroke = THEMES[input.theme].render({}, { accent: input.accent }).route.stroke;
    const themeColor = stroke?.startsWith('#') ? stroke : '#ffffff';
    pov = createPov(renderer, {
      streams: input.streams,
      projection: input.projection,
      dem: input.dem,
      buildings: input.layers?.buildings ?? [],
      floor,
      background: style.background,
      building: povBuildingColor(style.colors.building, style.background),
      color: input.color ?? (() => themeColor),
      route: input.route,
    });
    const path = pov.path;
    const moments = momentsOf(input.streams);
    // Przed punktem tabliczka wisi nad nim (przed biegaczem); po minięciu jedzie nad biegaczem, zamiast zjeżdżać na statystyki.
    // Najwyżej 300 m przed biegaczem: w długim biegu nie wisi na horyzoncie.
    const ahead = 300 / Math.max(1, path.track.total);
    const anchor = (p: number, f: number): V3 => {
      const [x, y, z] = cameraAt(path, Math.min(Math.max(p, f), p + ahead)).runner;
      return [x, y + BANNER_LIFT_M, z];
    };
    const bannerAt = (p: number): Banner | undefined => {
      const b = bannerAlpha(p, moments, path.track.total);
      const at = b && project(path, p, anchor(p, b.m.f), SIZE[0] / SIZE[1], FOV);
      if (!b || !at || at[0] < 0 || at[0] > 1 || at[1] < 0 || at[1] > 1) return undefined;
      return { x: at[0] * SIZE[0], y: at[1] * SIZE[1], text: b.m.label, alpha: b.alpha };
    };
    const { frameAt, unmount } = offscreenFrames((p) => input.overlay(p, bannerAt(p)));
    const paint = pov.paint;
    try {
      return await encodeMp4(frameAt, { onProgress, signal, progresses: povFrameProgress(moments, 30, path.track.total), under: (c, p) => paint(c, p) });
    } finally {
      unmount();
    }
  } finally {
    if (pov) pov.dispose();
    else {
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
}
