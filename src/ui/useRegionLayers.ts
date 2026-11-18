import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3-geo';
import type { Rect, Region } from '../lib/mapTiles';
import { loadRegionLayers, type MapLayers, type MapProfile } from '../lib/vectorMap';

export type Refined = { rect: Rect; layers: MapLayers };
type RegionState = { refined?: Refined; loading: boolean };

const SIZE: [number, number] = [1080, 1920];

// Ostrzejsze warstwy dla fragmentu przybliżonego w 3D. Błąd jest cichy: zostaje mapa podstawowa.
export function useRegionLayers(
  projection: GeoProjection | null,
  region: Region | null,
  profile: MapProfile,
  enabled: boolean,
  load = loadRegionLayers, // musi być stała (zależność efektu)
): RegionState {
  const [state, setState] = useState<RegionState>({ loading: false });

  useEffect(() => {
    if (!enabled || !projection || !region) {
      setState({ loading: false });
      return;
    }
    // Przerwanie zatrzymuje też kafelki czekające w kolejce na nieaktualny fragment.
    const controller = new AbortController();
    const { signal } = controller;
    // Poprzednie warstwy zostają w trakcie ładowania (mają własny prostokąt, więc są wciąż poprawne).
    setState((s) => ({ ...s, loading: true }));
    load(projection, SIZE, profile, region, signal).then(
      (layers) => !signal.aborted && setState({ refined: layers ? { rect: region.rect, layers } : undefined, loading: false }),
      // Błąd zostawia poprzednie ostrzejsze warstwy.
      () => !signal.aborted && setState((s) => ({ ...s, loading: false })),
    );
    return () => controller.abort();
  }, [projection, region, profile, enabled, load]);

  return state;
}
