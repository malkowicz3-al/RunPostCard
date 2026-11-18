import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3-geo';
import { loadMapLayers, type MapLayers, type MapProfile } from '../lib/vectorMap';

// Ścieżki mapy dla projekcji trasy; size i profile muszą być stałymi (zależności efektu).
export function useMapLayers(
  projection: GeoProjection | null,
  size: [number, number],
  profile: MapProfile,
  enabled: boolean,
): { layers?: MapLayers; failed: boolean } {
  const [state, setState] = useState<{ layers?: MapLayers; failed: boolean }>({ failed: false });

  useEffect(() => {
    if (!enabled) return;
    if (!projection) {
      setState({ failed: true });
      return;
    }
    let cancelled = false;
    setState({ failed: false });
    loadMapLayers(projection, size, profile).then(
      (layers) => !cancelled && setState({ layers, failed: false }),
      () => !cancelled && setState({ failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [projection, size, profile, enabled]);

  return state;
}
