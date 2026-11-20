import { useEffect, useState } from 'react';
import { previewProgress } from '../lib/animate';

// Podgląd animacji na ekranie (bez pliku): ten sam przebieg co eksport, w pętli.
// Ok. 30 kl./s wystarcza; zatrzymany albo „ogranicz ruch” w systemie = gotowa karta (progress pominięty).
export function usePreviewProgress(playing: boolean): number | undefined {
  const [p, setP] = useState<number>();
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!playing || reduce) return setP(undefined);
    const start = performance.now();
    let last = 0;
    let raf = requestAnimationFrame(function loop(now) {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      setP(previewProgress(now - start));
    });
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return p;
}
