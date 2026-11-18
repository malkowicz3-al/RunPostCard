import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3-geo';
import { loadMapLayers, type MapLayers, type MapObjects, type MapProfile } from '../lib/vectorMap';

// profile: profil, dla którego są layers/objects (przy zmianie profilu zostają stare, aż przyjdą nowe).
type MapState = { layers?: MapLayers; objects?: MapObjects; profile?: MapProfile; failed: boolean };

// Ścieżki i obiekty mapy dla projekcji trasy; size i profile muszą być stałymi (zależności efektu).
export function useMapLayers(
  projection: GeoProjection | null,
  size: [number, number],
  profile: MapProfile,
  enabled: boolean,
): MapState {
  const [state, setState] = useState<MapState & { projection?: GeoProjection }>({ failed: false });

  useEffect(() => {
    if (!enabled) return;
    if (!projection) {
      setState({ failed: true });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, failed: false }));
    loadMapLayers(projection, size, profile).then(
      (data) => !cancelled && setState({ ...data, profile, projection, failed: false }),
      () => !cancelled && setState({ failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [projection, size, profile, enabled]);

  // Dane innej trasy nie są ważne nawet chwilowo.
  if (state.projection !== projection) return { failed: state.failed };
  return { layers: state.layers, objects: state.objects, profile: state.profile, failed: state.failed };
}
