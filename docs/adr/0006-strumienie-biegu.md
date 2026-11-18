# 0006. Strumienie biegu tylko dla otwartej pocztówki; markery i widok 3D z jednego źródła

## Kontekst
Etap A planu: markery na trasie (najszybszy punkt, max/min tętno, najwyższy punkt) i izometryczny widok trasy z wysokościami. `summary_polyline` z listy aktywności tego nie daje: brak wysokości, tętna, prędkości i dystansu na punkt. Potrzebne są strumienie Stravy (`GET /activities/{id}/streams`).

Ograniczenia:
- Limit zapytań Stravy (rząd 100 odczytów / 15 min, 1000 / dzień na aplikację). Strumienie dla 30 biegów z listy zjadłyby to szybko.
- Bez bazy i bez backendu dla danych (ADR 0001): wywołanie z przeglądarki, dane tylko w pamięci.
- Jeden SVG jako źródło prawdy dla podglądu i eksportu (ADR 0002); motywy map tylko przy tle `map` (ADR 0005).
- Prywatność (CLAUDE.md): początek i koniec trasy przycięte domyślnie ok. 200 m. W kodzie przycięcia jeszcze nie ma (płaska trasa rysuje cały `summary_polyline`).
- Bez nowych zależności.

## Decyzja

### 1. Pobieranie: `src/strava/api.ts`
- Z `getActivities` wydzielamy prywatne `stravaGet<T>(path: string): Promise<T>`: token (`getAccessToken`), `SessionExpiredError` przy braku tokenu i 401 (z `clearSession`), komunikat przy 429, błąd przy `!res.ok`. `getActivities` staje się jedną linią na `stravaGet`.
- `fetchStreams(id: number): Promise<RunStreams | null>` = `stravaGet('/activities/{id}/streams?keys=latlng,altitude,heartrate,velocity_smooth,distance,time&key_by_type=true')` -> `normalizeStreams`.
- Typ obok `Activity`:
  ```ts
  export type RunStreams = {
    latlng: [number, number][]; // [lat, lng], jak decodePolyline
    distance: number[];         // m od startu
    time?: number[];            // s od startu
    altitude?: number[];        // m
    heartrate?: number[];       // bpm
    velocity?: number[];        // m/s (velocity_smooth)
  };
  ```
- `normalizeStreams(raw: unknown): RunStreams | null` (eksportowana, czysta, testowana): odpowiedź to obiekt po typie, każdy `{ data: [...] }`. Brak `latlng` lub `distance` albo mniej niż 2 punkty -> `null`. Brak opcjonalnego klucza jest normalny. Opcjonalna tablica o długości innej niż `latlng` jest odrzucana (wszystkie indeksy muszą się zgadzać).
- Strumienie pobieramy **tylko dla otwartej pocztówki**, raz na otwarcie. Lista biegów dalej używa wyłącznie `summary_polyline`.
- Scope `activity:read` bez zmian. Wg dokumentacji Stravy ten scope wycina strefy prywatności, co dotyczy też strumieni (do potwierdzenia na prawdziwym biegu ze strefą).

### 2. Hook: `src/ui/useRunStreams.ts`
- `useRunStreams(activity: Activity): RunStreams | null` (`null` = brak, ładowanie albo błąd; UI nie rozróżnia).
- Efekt zależny od `activity.id`, z flagą `cancelled` jak `useMapLayers`. Wynik tylko w stanie komponentu (pamięć karty), bez cache, bez `sessionStorage`.
- Każdy błąd (sieć, 429, 401, zły kształt) degraduje cicho: brak markerów i ukryty przełącznik 3D. Pocztówka działa jak dziś.
- Tryb mock: `import.meta.env.DEV && new URLSearchParams(location.search).has('mock')` -> dynamiczny `import('../dev/mockActivities')` i `mockStreams(activity)`, bez sieci. Ten sam wzorzec co w `App.tsx`, więc Vite wycina mock z buildu produkcyjnego.

### 3. Syntetyczne strumienie: `src/dev/mockActivities.ts`
- `mockStreams(activity: Activity): RunStreams`, deterministyczne, liczone z danych mocka (bez losowości):
  - `latlng` = `decodePolyline(activity.map.summary_polyline)` (te same 80 punktów co trasa płaska);
  - `distance` = skumulowany haversine przeskalowany do `activity.distance`;
  - `time` = `distance / activity.distance * activity.moving_time`;
  - `altitude` = `200 + 40 * sin(pi * d / D)` (jedno wzgórze na środku); dla `Hill repeats` kilka wzgórz (`sin` o większej częstotliwości), żeby było widać nachylenia;
  - `heartrate` tylko gdy `activity.average_heartrate` istnieje: średnia + składnik rosnący z nachyleniem i lekki wzrost w czasie; bieg `Lunch … figure eight` nie ma HR (już dziś), więc testuje brak tętna;
  - `velocity` = `activity.distance / activity.moving_time` z falą zależną od nachylenia (wolniej pod górę).
- Wymaga eksportu `decodePolyline` z `src/lib/polyline.ts` (już eksportowany).

### 4. Czyste obliczenia: `src/lib/`
- `src/lib/runHighlights.ts`:
  ```ts
  export const TRIM_M = 200; // prywatność: żaden marker w pierwszych i ostatnich 200 m
  export type HighlightKind = 'fastest' | 'maxHr' | 'minHr' | 'highest';
  export type Highlight = { kind: HighlightKind; index: number; value: number };
  export function highlights(s: RunStreams): Highlight[];
  ```
  - Zwraca **indeks** w strumieniach, nie `latlng`: ten sam wynik ustawia marker w widoku płaskim (`projection(latlng[i])`) i w 3D (`iso.points[i]`).
  - Kandydaci tylko z `TRIM_M <= distance[i] <= distance.at(-1) - TRIM_M`.
  - `fastest`: max średniej kroczącej `velocity` z 10 próbek; `minHr`: dopiero po `time >= 300` s (bez `time` po `distance >= 1000`); brak danych -> rodzaj pominięty.
  - `TRIM_M` żyje tu, bo to jedyny konsument. Gdy etap 3 doda przycięcie samej trasy, stała przechodzi do wspólnego modułu i obie rzeczy jej używają.
- `src/lib/isoRoute.ts`:
  ```ts
  export type IsoRoute = {
    points: [number, number][]; // trasa podniesiona o wysokość, w układzie płótna
    ground: [number, number][]; // ta sama trasa na podłożu (cień, dół kurtyny)
    slope: (-1 | 0 | 1)[];      // klasa nachylenia odcinka i -> i+1 (kolor)
    exaggeration: number;       // >1 = przewyższenie wzmocnione (podpis "elevation ×N")
    matrix: [number, number, number, number, number, number]; // SVG matrix: płaskie płótno -> podłoże 3D
  };
  export function isoRoute(s: RunStreams, box: Box, projection: GeoProjection): IsoRoute | null; // null bez altitude
  ```
  - `projection` = `fit.projection` (płaska projekcja pocztówki, ta sama co mapa). Punkt podłoża = `projection(latlng)`, potem obrót 45° i oś Y × 0,5, podniesienie `(alt - min) × skala`, na końcu dopasowanie bboxu `points ∪ ground` do `box`. Całość podłoża jest afiniczna, więc `matrix` przenosi płaską mapę pod trasę 3D.
  - Wygładzanie (szum zegarka): `latlng` średnią kroczącą z 7 próbek (indeksy zachowane), wysokość średnią w oknie ±100 m dystansu, nachylenie z okna ±100 m, progi ±4%, serie krótsze niż 150 m przejmują klasę sąsiada (bez migotania).
  - Wzmocnienie: celuje w ok. 6% wysokości `box`, ale najwyżej ×3 (`MAX_EXAGGERATION`), żeby płaski bieg wyglądał płasko.
- Obie funkcje bez DOM i sieci, z testami Vitest.

### 5. Rysowanie i `Postcard.tsx`
- Nowe props: `streams?: RunStreams | null`, `view?: 'flat' | '3d'` (domyślnie `'flat'`), `highlights?: boolean` (domyślnie `false`). Bez nich pocztówka jest identyczna jak dziś.
- `Postcard` liczy `useMemo`: `highlights(streams)` i przy `view === '3d'` `isoRoute(streams, ROUTE_BOX)`.
- **Mapa w 3D jako podłoga:** przy motywie mapy rysujemy prostokąt w kolorze tła motywu, potem `scene` motywu w `<g transform="matrix(iso.matrix)">` z maską wygaszającą brzegi (`iso-floor-fade`), na końcu trasę 3D. Tekst, znak i podpis OSM jak w widoku płaskim. (Wcześniej 3D wyłączało mapę; zmienione na prośbę właściciela: bez mapy brakowało odniesienia.)
- `src/postcard/IsoRoute.tsx`: kurtyna, cień, trasa kolorowana nachyleniem; rysuje najwyżej ~800 punktów (co k-ty + ostatni), markery dalej używają pełnych `iso.points`. Kolory z/pod górę stałe; płaskie odcinki i kurtyna w kolorze trasy motywu (biały bez mapy).
- `src/postcard/RouteMarkers.tsx`: `{ points: [number, number][]; items: Highlight[]; color: string }`. Widok płaski podaje punkty rzutowane przez `fit.projection` (projekcja z `summary_polyline`; strumień `latlng` jest gęstszy, ale leży na tej samej trasie), 3D podaje `iso.points`. Kolor = `text.color`.
- Wszystko zwykłe SVG wewnątrz tego samego `<svg>`, eksport PNG/SVG bez zmian.

### 6. `PostcardScreen.tsx` i panel Style
- Stan `view` i `highlights` (domyślnie `'flat'` i wyłączone); `streams = useRunStreams(activity)`.
- Przełącznik „Highlights” widoczny, gdy `streams` istnieje; „Flat / 3D” widoczny, gdy `streams?.altitude` istnieje.
- Przełącznik 3D nie zmienia wyglądu; kafelki motywów działają w obu widokach i mapa ładuje się tak samo.

## Konsekwencje
- Jedno dodatkowe zapytanie do Stravy na otwarcie pocztówki; lista bez zmian w kosztach. Powrót do tej samej pocztówki pobiera ponownie (bez cache, świadomie).
- 401 przy strumieniach czyści sesję jak przy liście; użytkownik dowie się dopiero przy następnej akcji (powrót do listy). Akceptowane.
- Markery i 3D zależą od jakości danych zegarka (szum wysokości i GPS); wygładzanie w czystych funkcjach, łatwe do strojenia testami.
- Płaska trasa dalej nie jest przycięta o 200 m (niezgodność z CLAUDE.md do etapu 3); przycięte są tylko markery. Widok 3D rysuje pełny strumień, czyli tyle samo, co dziś pokazuje widok płaski.
- Nowe formy slotów (etap 4: wykresy tętna, tempa, przewyższenia) dostaną dane z tego samego `RunStreams`, bez nowego pobierania.
- Zero nowych zależności.
