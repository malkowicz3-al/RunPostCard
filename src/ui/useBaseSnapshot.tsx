import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { DEFAULT_CAMERA, keepCamera, type Camera } from '../lib/camera';
import { serialize } from '../lib/exportPng';
import { Postcard } from '../postcard/Postcard';
import { offscreenFrames } from './ExportControls';

type Props = ComponentProps<typeof Postcard>;
export type Snapshot = { href: string; camera: Camera; props: Props };

// Te same właściwości poza kamerą: obraz mapy dalej pasuje (w 3D obrót zmienia iso, więc obraz przestaje pasować).
export const sameBase = (a: Props, b: Props) => {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Props>) if (k !== 'camera' && a[k] !== b[k]) return false;
  return true;
};

// Podgląd mapy jako jeden obraz (część 'base' pocztówki) zrobiony, gdy kamera stoi: w trakcie przesuwania, przybliżania
// i obrotu przekształca się sam obraz (CSS), a nie tysiące ścieżek. Tylko tło mapy: zdjęcie i gradient nie ruszają się z kamerą.
export function useBaseSnapshot(props: Props, still: boolean): Snapshot | null {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const current = useRef<string | null>(null);
  const usable = props.background === 'map';
  const camera = props.camera ?? DEFAULT_CAMERA;
  const fresh = !!snap && sameBase(snap.props, props) && keepCamera(snap.camera, camera) === snap.camera;

  useEffect(() => {
    if (!usable || !still || fresh) return;
    let cancelled = false;
    // Osobne zadanie (flushSync nie może działać w efekcie Reacta), z opóźnieniem: ostrzejsza mapa zwykle dochodzi zaraz po zatrzymaniu.
    const timer = setTimeout(() => {
      const frames = offscreenFrames(() => <Postcard {...props} part="base" draft />);
      let url: string;
      try {
        url = URL.createObjectURL(new Blob([serialize(frames.frameAt(1))], { type: 'image/svg+xml;charset=utf-8' }));
      } catch {
        return; // bez obrazu zostaje zwykły podgląd wektorowy
      } finally {
        frames.unmount();
      }
      const img = new Image();
      img.src = url;
      img.decode().then(
        () => {
          if (cancelled) return URL.revokeObjectURL(url);
          if (current.current) URL.revokeObjectURL(current.current);
          current.current = url;
          setSnap({ href: url, camera, props });
        },
        () => URL.revokeObjectURL(url),
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [props, still, usable, fresh]);

  useEffect(() => () => void (current.current && URL.revokeObjectURL(current.current)), []);

  return usable && snap && sameBase(snap.props, props) ? snap : null;
}
