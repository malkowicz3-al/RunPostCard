// Gotowe zdjęcia tła (CC0, Wikimedia Commons; autorzy w public/backgrounds/LICENSE.md). Lokalne pliki, bez zapytań na zewnątrz.
export const SCENERY = [
  { id: 'lane-numbers', label: 'Lane numbers', group: 'Running' },
  { id: 'track-800', label: '800 m line', group: 'Running' },
  { id: 'sprint-lanes', label: 'Sprint lanes', group: 'Running' },
  { id: 'track-race', label: 'Track race', group: 'Running' },
  { id: 'marathon-crowd', label: 'Marathon crowd', group: 'Running' },
  { id: 'city-marathon', label: 'City marathon', group: 'Running' },
  { id: 'gravel-runner', label: 'Gravel runner', group: 'Running' },
  { id: 'golden-hill', label: 'Golden hill', group: 'Running' },
  { id: 'sunset-path', label: 'Sunset path', group: 'Running' },
  { id: 'track-mist', label: 'Misty track', group: 'Running' },
  { id: 'fog-road', label: 'Fog road', group: 'Landscape' },
  { id: 'fall-fog', label: 'Autumn fog', group: 'Landscape' },
  { id: 'autumn-path', label: 'Autumn path', group: 'Landscape' },
  { id: 'mountain-fall', label: 'Forest trail', group: 'Landscape' },
  { id: 'forest-road', label: 'Forest road', group: 'Landscape' },
  { id: 'switchbacks', label: 'Switchbacks', group: 'Landscape' },
  { id: 'volcano-road', label: 'Volcano road', group: 'Landscape' },
  { id: 'snow-trail', label: 'Snow trail', group: 'Landscape' },
  { id: 'coast-sunrise', label: 'Coast sunrise', group: 'Landscape' },
] as const;
export type SceneryId = (typeof SCENERY)[number]['id'];

export const sceneryUrl = (id: SceneryId) => `${import.meta.env.BASE_URL}backgrounds/${id}.jpg`;
// Małe miniatury do listy (pełne pliki ważą do ~1 MB).
export const sceneryThumb = (id: SceneryId) => `${import.meta.env.BASE_URL}backgrounds/thumbs/${id}.jpg`;
