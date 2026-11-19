import { useEffect, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { GeoProjection } from 'd3-geo';
import type { RunStreams } from '../strava/api';
import type { Dem } from '../lib/dem';
import type { MapLayers } from '../lib/vectorMap';
import { THEMES, type ThemeId } from '../postcard/themes';

const PASS_MS = 8000;
const FRAME_MS = 1000 / 30;

// Bez ładowania Three.js: czy przeglądarka da kontekst WebGL (sprawdzane raz).
let webgl: boolean | undefined;
export function hasWebGL(): boolean {
  if (webgl === undefined) {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') ?? c.getContext('webgl');
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return webgl;
}

// Mapa motywu (bez faktury papieru) jako obraz w rozmiarze tekstury; SVG → Image → canvas.
async function mapImage(layers: MapLayers, theme: ThemeId, accent: string, width: number, height: number): Promise<HTMLCanvasElement> {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width={width} height={height} preserveAspectRatio="none">
        {THEMES[theme].render(layers, { accent }).scene}
      </svg>,
    ),
  );
  const xml = new XMLSerializer().serializeToString(host.querySelector('svg')!);
  root.unmount();
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width, height });
    c.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Paint: klatka POV do canvasa eksportu (p pominięte = bieżąca klatka podglądu).
export type PovPaint = (target: HTMLCanvasElement, p?: number) => void;

// Lot wzdłuż trasy (ADR 0010) pod nakładką pocztówki; scena budowana leniwie, zwalniana przy odmontowaniu i zmianie danych.
export function PovView({
  streams,
  projection,
  layers,
  theme,
  accent,
  dem,
  color,
  route,
  playing,
  paintRef,
  onReady,
}: {
  streams: RunStreams;
  projection: GeoProjection;
  layers?: MapLayers;
  theme: ThemeId;
  accent: string;
  dem: Dem | null;
  color?: (t: number) => string;
  route: boolean;
  playing: boolean;
  paintRef: RefObject<PovPaint | null>;
  onReady: (ready: boolean) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'building' | 'ready' | 'failed'>('building');
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const progress = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let dispose: (() => void) | null = null;
    setStatus('building');
    onReady(false);
    (async () => {
      const { createRenderer, createPov } = await import('../pov/scene');
      if (cancelled) return;
      // Nowy canvas przy każdej budowie: dispose wymusza utratę kontekstu, a tego samego canvasa nie da się użyć ponownie.
      const canvas = Object.assign(document.createElement('canvas'), { className: 'pov-canvas' });
      hostRef.current!.prepend(canvas);
      dispose = () => canvas.remove();
      const renderer = createRenderer(canvas);
      dispose = () => {
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
      const h = renderer.capabilities.maxTextureSize >= 4096 ? 4096 : 2048;
      const floor = layers ? await mapImage(layers, theme, accent, h / 2, h) : null;
      if (cancelled) return;
      const style = THEMES[theme].style({ accent });
      const stroke = THEMES[theme].render({}, { accent }).route.stroke;
      const themeColor = stroke?.startsWith('#') ? stroke : '#ffffff';
      const pov = createPov(renderer, {
        streams,
        projection,
        dem,
        buildings: layers?.buildings ?? [],
        floor,
        background: style.background,
        building: style.colors.building,
        color: color ?? (() => themeColor),
        route,
      });
      dispose = () => {
        pov.dispose();
        canvas.remove();
      };
      paintRef.current = (target, p) => pov.paint(target, p ?? progress.current);
      setStatus('ready');
      onReady(true);
      let last = performance.now();
      let drawn = -Infinity;
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (playingRef.current) progress.current = (progress.current + (now - last) / PASS_MS) % 1;
        last = now;
        // shortcut: 30 kl./s na sztywno (bateria telefonu); bez pomiaru wydajności i obniżania jakości
        if (now - drawn < FRAME_MS - 1) return;
        drawn = now;
        pov.render(progress.current);
      };
      raf = requestAnimationFrame(loop);
    })().catch(() => !cancelled && setStatus('failed'));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      paintRef.current = null;
      dispose?.();
      onReady(false);
    };
  }, [streams, projection, layers, theme, accent, dem, color, route]);

  return (
    <div className="pov" ref={hostRef}>
      {status !== 'ready' && (
        <p className="pov-status" role="status">
          {status === 'building' ? 'Building 3D scene…' : 'Could not build the 3D scene.'}
        </p>
      )}
    </div>
  );
}
