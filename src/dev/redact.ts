// Tylko dev: ukrywa trasę i współrzędne startu/końca w surowej odpowiedzi Stravy.
const redactPolyline = (value: string) => `[redacted, ${value.length} chars]`;

export function redactActivities(raw: unknown[]): unknown[] {
  return raw.map((item) => {
    const activity = { ...(item as Record<string, unknown>) };
    delete activity.start_latlng;
    delete activity.end_latlng;
    // Dane identyfikujące sportowca i miejsce, zanim JSON trafi do schowka.
    delete activity.athlete;
    delete activity.external_id;
    delete activity.location_city;
    delete activity.location_state;
    delete activity.location_country;
    if (activity.map && typeof activity.map === 'object') {
      const map = { ...(activity.map as Record<string, unknown>) };
      for (const key of ['summary_polyline', 'polyline'] as const) {
        if (typeof map[key] === 'string') map[key] = redactPolyline(map[key]);
      }
      activity.map = map;
    }
    return activity;
  });
}
