import { useEffect, useState } from 'react';
import type { Rect } from '../lib/mapTiles';
import { generateWorld, type World } from '../world/generate';
import type { GenreId } from '../world/genres';

type WorldState = { key: string; points: [number, number][]; world: World; rect: Rect };

// shortcut: generowanie w wątku głównym (pocztówka i tło ekranu osobno, ok. 15 ms każde), przenieść do Web Workera, gdy zacina się na telefonach.
// Świat dla prostokąta (ADR 0012): liczony w setTimeout(0), żeby spinner zdążył się pokazać; do wyniku zostaje poprzedni.
export function useWorld(
  points: [number, number][] | null,
  rect: Rect | null,
  seed: number,
  genre: GenreId,
): { world: World | null; rect: Rect | null; loading: boolean } {
  const [state, setState] = useState<WorldState | null>(null);
  const key = rect ? `${rect.join()}|${seed}|${genre}` : '';

  useEffect(() => {
    if (!points || !rect) return;
    const timer = setTimeout(() => setState({ key, points, rect, world: generateWorld(points, rect, seed, genre) }));
    return () => clearTimeout(timer);
    // rect, seed i genre są w key.
  }, [points, key]);

  if (!points || !rect) return { world: null, rect: null, loading: false };
  const fresh = state?.key === key && state.points === points;
  // Inny bieg (inne points): stary świat nie pasuje do trasy, więc go nie pokazujemy.
  const sameRoute = state?.points === points;
  return { world: sameRoute ? state!.world : null, rect: sameRoute ? state!.rect : null, loading: !fresh };
}
