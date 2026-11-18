import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3-geo';
import { loadMapLayers, type MapLayers, type MapProfile } from '../lib/vectorMap';

type MapState = { layers?: MapLayers; failed: boolean; loading: boolean };

// Ścieżki mapy dla projekcji trasy; size i profile muszą być stałymi (zależności efektu).
export function useMapLayers(
  projection: GeoProjection | null,
  size: [number, number],
  profile: MapProfile,
  enabled: boolean,
): MapState {
  const [state, setState] = useState<MapState>({ failed: false, loading: false });

  useEffect(() => {
    if (!enabled) return;
    if (!projection) {
      setState({ failed: true, loading: false });
      return;
    }
    let cancelled = false;
    // Zostaw poprzednie warstwy: przy powrocie do tła Map albo zmianie profilu nie mignie gradient.
    setState((s) => ({ ...s, failed: false, loading: true }));
    loadMapLayers(projection, size, profile).then(
      (layers) => !cancelled && setState({ layers, failed: false, loading: false }),
      () => !cancelled && setState({ failed: true, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [projection, size, profile, enabled]);

  return state;
}
