// Gotowe zdjęcia tła (CC0, Wikimedia Commons; autorzy w public/backgrounds/LICENSE.md). Lokalne pliki, bez zapytań na zewnątrz.
export const SCENERY = [
  { id: 'track-mist', label: 'Misty track' },
  { id: 'fog-road', label: 'Fog road' },
  { id: 'fall-fog', label: 'Autumn fog' },
  { id: 'autumn-path', label: 'Autumn path' },
  { id: 'mountain-fall', label: 'Forest trail' },
  { id: 'forest-road', label: 'Forest road' },
  { id: 'switchbacks', label: 'Switchbacks' },
  { id: 'volcano-road', label: 'Volcano road' },
  { id: 'snow-trail', label: 'Snow trail' },
  { id: 'coast-sunrise', label: 'Coast sunrise' },
] as const;
export type SceneryId = (typeof SCENERY)[number]['id'];

export const sceneryUrl = (id: SceneryId) => `${import.meta.env.BASE_URL}backgrounds/${id}.jpg`;
// Małe miniatury do listy (pełne pliki ważą do ~1 MB).
export const sceneryThumb = (id: SceneryId) => `${import.meta.env.BASE_URL}backgrounds/thumbs/${id}.jpg`;
