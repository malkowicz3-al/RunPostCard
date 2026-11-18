import { POSTCARD } from '../../lib/vectorMap';
import { MapBackground } from '../MapBackground';
import { MINIMAL } from '../mapStyle';
import type { MapTheme } from './index';

// Wygląd sprzed motywów, bez zmian.
export const minimal: MapTheme = {
  label: 'Minimal',
  profile: POSTCARD,
  render: ({ map }) => ({
    scene: <MapBackground layers={map.layers} style={MINIMAL} />,
    route: { stroke: '#ffffff', width: 14 },
    text: { color: '#ffffff' },
    mark: 'white',
  }),
};
