import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { MapLayers } from '../lib/vectorMap';
import { THEMES, type ThemeId } from '../postcard/themes';

// Mapa motywu (bez faktury papieru) jako obraz w rozmiarze tekstury; SVG → Image → canvas.
export async function mapImage(layers: MapLayers, theme: ThemeId, accent: string, width: number, height: number): Promise<HTMLCanvasElement> {
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
