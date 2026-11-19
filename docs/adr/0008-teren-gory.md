# 0008. Teren (góry): wysokości z AWS Terrain Tiles, cieniowanie i relief 3D jako obraz z canvasa

## Kontekst
Właściciel chce gór: pocztówki jak plakaty Tatr (ukośny relief 3D z cieniowaniem, biała trasa na grzbietach) oraz mapy z cieniowaniem rzeźby w widoku płaskim. ADR 0004 zauważył, że kafelki OpenMapTiles nie mają rzeźby terenu: potrzebne jest osobne źródło wysokości.

Ograniczenia:
- Jeden samowystarczalny SVG pocztówki dla podglądu i eksportu (ADR 0002): wolno używać data URL i tylko lokalnych `url(#…)`.
- Bez klucza, bez backendu dla danych (ADR 0001). Każdy uruchamia repo bez konfiguracji.
- Bez nowych zależności, jeśli nie są konieczne. Dekodowanie PNG przez `createImageBitmap` i canvas.
- Obecny 3D (`isoRoute`, ADR 0006/0007) jest afiniczny: podłoga to płaska mapa pod `iso.matrix`, trasa podniesiona o `(alt − min) · pxPerM · exaggeration`, bryły budynków w przestrzeni ekranu (`Buildings3D`). Warstwy mapy to gotowe napisy `d` w px płótna, bez współrzędnych.

## Źródła wysokości (ocena)

| Źródło | Klucz | CORS | Zoom / rozdzielczość | Uwagi |
|---|---|---|---|---|
| **AWS Open Data „Terrain Tiles”** (Mapzen/Tilezen Joerd), `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | nie | tak (używane wprost w przykładach MapLibre `raster-dem`; potwierdzić pierwszym krokiem w przeglądarce) | z0–z15, PNG 256 px, kodowanie Terrarium `h = R·256 + G + B/256 − 32768` [m] | Dane: SRTM/GMTED (~30 m), Europa EU-DEM (~25–30 m), USA 3DEP (do 10 m), ETOPO1 na morzu. Powyżej z12–z13 kafelki są nadpróbkowane. Utrzymywane jako AWS Open Data (bez SLA), od lat stabilne; repliki `elevation-tiles-prod-eu`. |
| Mapterhorn, `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp` | nie | nie sprawdzone | Terrarium WebP 512 px, dane do z17 (lokalnie lepsze DEM, np. swisstopo) | Projekt młody (2025), polityka użycia i atrybucja nieopisane na stronie dostępu. Kandydat zapasowy: zmiana to inny URL i rozmiar kafelka. |
| MapLibre demo tiles (`demotiles.maplibre.org/terrain-tiles`) | nie | tak | mały obszar demonstracyjny | Tylko do przykładów, nie do użytku: odrzucone. |
| OpenFreeMap | — | — | — | Brak potwierdzonego, udokumentowanego źródła wysokości na openfreemap.org (wzmianki tylko z serwisów trzecich): odrzucone do czasu oficjalnej dokumentacji. |
| Klucze komercyjne (MapTiler, Mapbox Terrain-RGB) | tak | tak | do z14+ | Wymagają klucza: odrzucone (ta sama zasada co CARTO, ADR 0003/0004). |

**Licencja i atrybucja AWS Terrain Tiles** (wg `tilezen/joerd/docs/attribution.md`): wymagane podanie źródeł, m.in. „3DEP (dawniej NED), GMTED2010 i SRTM courtesy of the U.S. Geological Survey”, „produced using Copernicus data and information funded by the European Union – EU-DEM layers”, ETOPO1 (NOAA), a dla hostowanej usługi także Mapzen; regiony mają dodatkowe podpisy (Austria DGM, Norwegia Kartverket, UK Environment Agency, Kanada, Australia, NZ, Meksyk, ArcticDEM). Dokument mówi: podpis „w miejscu rozsądnym dla medium”.

**Prywatność:** przeglądarka pobiera kafelki z `s3.amazonaws.com`, więc AWS widzi obszar biegu (jak OpenFreeMap/Cloudflare dla mapy, ADR 0004). Opisać w README.

## Decyzja

### 1. Źródło
- AWS Terrain Tiles, format Terrarium PNG, jeden szablon URL w stałej `TERRAIN_URL` (wymiana na Mapterhorn = zmiana stałej i `DEM_TILE_PX`).
- `DEM_MAX_ZOOM = 13` (z13 przy 50° szer. ≈ 12 m/px, dane ~30 m: wyżej tylko więcej bajtów). Zoom kafelków z tej samej projekcji co mapa: `mapTiles(projection, size, 1024, DEM_MAX_ZOOM, {k, rect})` (ok. 4 jednostki płótna na piksel DEM; wysokości i tak są gładkie).
- Pobieranie przez istniejące `cached` + `queuedFetch` z `vectorMap.ts` (eksportujemy je; wspólna kolejka 4 zapytań, cache i przerywanie jak dla mapy). Dekodowanie: `createImageBitmap(blob)` → `OffscreenCanvas` (albo `<canvas>`) → `getImageData` → wysokości. 404 / błąd kafelka = cały teren niedostępny (cichy powrót do dzisiejszego wyglądu).
- **Atrybucja:**
  - pocztówka z terenem, w tej samej pionowej linii co podpis mapy: `© OpenMapTiles © OpenStreetMap contributors · Terrain: Mapzen, USGS, Copernicus EU-DEM, NOAA and others` (stała `TERRAIN_ATTRIBUTION`, mieści się w pasie 1920 px przy 18 px);
  - aplikacja (pod pocztówką / w stopce) i README: pełna lista z linkiem do `tilezen/joerd/docs/attribution.md`.

### 2. Rysowanie: wariant (c) hybryda — relief jako obraz z canvasa, trasa jako wektor na terenie
Odrzucone:
- **(a) samo cieniowanie na płaskiej/pochylonej podłodze:** tanie, ale w 3D trasa podniesiona o wysokość wisi nad płaskimi „górami”; nie daje wyglądu plakatu. Zostaje jako widok płaski.
- **(b) pełny 3D w SVG** (siatka terenu jako paski SVG, mapa wektorowa i budynki nakładane na wysokość per wierzchołek): wymaga parsowania napisów `d` z powrotem na współrzędne, podziału długich odcinków, sortowania tysięcy pasków; SVG rośnie o wiele MB, eksport zwalnia. Za dużo kodu na efekt, który daje obraz.

Wybór:
- **Siatka DEM w układzie płaskiego płótna** (ten sam co warstwy mapy przed `iso.matrix`): kafelki Web Mercator są wyrównane do osi płótna, więc mozaika kafelków to od razu regularna siatka (`cell = tile.size / 256` jednostek). Bez przepróbkowania przy składaniu.
- **Cieniowanie** (Horn, światło z NW 315°, wysokość 45°, stały `HILLSHADE_Z = 2`) z siatki; metry → jednostki płótna przez `k0` jak w `isoRoute`.
- **Widok płaski:** obraz cieni (PNG RGBA: cień = czarny z alfą, światło = biały z alfą, płaskie = przezroczyste) w rozdzielczości siatki, jako `<image>` z data URL nad sceną motywu, pod trasą, w tej samej grupie kamery. Bez `mix-blend-mode` (niepewne w `<img>` z SVG) i bez zmian w motywach (ulice też lekko cieniowane, akceptowane).
- **Widok 3D:** relief renderowany do canvasa i wstawiany jako jeden `<image>` (JPEG q≈0,9, tło wypełnione `style.background`, więc styka się bez szwu z prostokątem tła) w grupie kamery, **zamiast** podłogi wektorowej i `Buildings3D`. Algorytm: „voxel” / malarz od przodu: próbki podłoża (wysokość i cień interpolowane dwuliniowo) w gęstości wyjścia, kolejność od przodu do tyłu po przekątnych (`iso.matrix` ma `y_ekranu ~ b·(x + y)`, więc głębokość = `x + y`, bez sortowania), dla każdej kolumny ekranu bufor najwyższego narysowanego `y`; każda próbka rysuje pionowy odcinek od wierzchołka do tego bufora. Koszt O(liczba pikseli wyjścia).
- **Kolor reliefu (etap 1):** jednobarwny jak plakat: `style.background` przesunięty do `mix(bg, #fff, 0.4)` w świetle i `mix(bg, #000, 0.5)` w cieniu (`mix` z `color.ts`).
- **Trasa na terenie:** `isoRoute` dostaje opcjonalny `dem`; wysokość punktu = `demAt(dem, x, y)` (zamiast strumienia `altitude`, który różni się od DEM o dziesiątki metrów i trasa wchodziłaby w zbocze albo wisiała), reszta (wygładzanie, nachylenie, kolory, dopasowanie do `ROUTE_BOX`) bez zmian. Trasa rysowana zawsze na wierzchu (wektor), podniesiona o 2 px / zoom; kurtyna i cień w `IsoRoute` wyłączone (trasa leży na powierzchni).
- **Wspólna skala pionowa:** jedno `exaggeration` i jedna podstawa: `IsoRoute` dostaje pole `baseM` (min. wysokość DEM na trasie). Relief podnosi próbkę o `(h − baseM) · pxPerM · exaggeration`, trasa tak samo. Teren poniżej podstawy schodzi w dół ekranu (poprawne geometrycznie). Reguła `exaggeration` (1..3, cel 6% pola) zostaje; dla gór daje zwykle ×1. Budynki w trybie terenu ukryte w etapie 1.

### 3. Kiedy teren działa
- Przełącznik **„Terrain”** w sekcji View, widoczny przy tle Map i istniejących `streams`. Działa w obu widokach (płasko: cieniowanie, 3D: relief).
- Domyślnie włączony automatycznie, gdy rozpiętość wysokości strumienia ≥ `TERRAIN_AUTO_M = 300` m (przed pobraniem DEM, bez dodatkowych zapytań); użytkownik może zmienić. Płaskie biegi nie pobierają kafelków terenu, dopóki ktoś nie włączy.
- **Obszar DEM** (unika zależności cyklicznej: obszar zależy od `iso.matrix`, a `iso` od DEM): liczony raz z `iso` bez DEM (strumień `altitude`) i kamery domyślnej: `backdropArea(CANVAS, DEFAULT_CAMERA, 0.3, matrix)` (płasko: macierz jednostkowa). Po wczytaniu `iso` liczone ponownie z DEM; bez ponownego pobierania (margines pokrywa różnicę dopasowania). Limit `MAX_DEM_TILES = 32`, przy przekroczeniu poziom niżej (k = 1, 0,5, 0,25 jak `loadAreaLayers`).
- **Przybliżenie (refined):** w 3D z terenem wektorowy fragment `refined` nie jest pobierany (podłoga wektorowa zastąpiona). Płasko działa jak dziś, cieniowanie nad nim. Ostrzejszy DEM przy zoomie: nie (dane ~30 m).
- **MapBackdrop:** ten sam obraz (płasko: cienie nad mapą tła; 3D: relief zamiast mapy i brył), bez filtrów. Poza obszarem DEM tło motywu.
- **Eksport:** obraz jest już data URL w SVG, więc PNG/SVG bez zmian w `exportPng.ts`. Pobieranie zablokowane w trakcie wczytywania terenu (jak mapa i font).

### 4. Limity wydajności
- DEM: ≤ 32 kafelki PNG (zwykle 6–12; w górach ~50–150 KB każdy), ≤ ~2 mln próbek `Float32Array`.
- Relief 3D: obraz w jednostkach płótna (przed kamerą) na bboxie rzutu obszaru DEM, gęstość `min(2, √(8e6 / pole))` px na jednostkę, czyli ≤ 8 MP (poniżej limitu canvasa iOS 16 MP). Render ~100–300 ms na głównym wątku, tylko przy zmianie DEM, `iso` lub motywu (nie przy każdej klatce kamery). JPEG data URL ~1–3 MB: tyle rośnie plik SVG.
- Cieniowanie płaskie: 1 px na komórkę DEM, PNG kilkaset KB.

## Plan

### Etap 1 (ten ADR)
Nowe pliki:
- `src/lib/dem.ts`
  ```ts
  export const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  export const TERRAIN_ATTRIBUTION = 'Terrain: Mapzen, USGS, Copernicus EU-DEM, NOAA and others';
  export const DEM_MAX_ZOOM = 13;
  export const TERRAIN_AUTO_M = 300;
  export type Dem = { x0: number; y0: number; cell: number; w: number; h: number; z: Float32Array; mPerUnit: number }; // płótno płaskie
  export function terrarium(r: number, g: number, b: number): number;
  export function demFromTiles(tiles: Tile[], pixels: Uint8ClampedArray[], tilePx: number, mPerUnit: number): Dem; // czysta mozaika
  export function demAt(dem: Dem, x: number, y: number): number; // dwuliniowo, brzeg = najbliższa komórka
  export function loadDem(projection: GeoProjection, size: [number, number], rect: Rect, signal?: AbortSignal): Promise<Dem | null>;
  ```
- `src/lib/relief.ts` (bez DOM; obraz jako `{width, height, data: Uint8ClampedArray}`)
  ```ts
  export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
  export function hillshade(dem: Dem): Float32Array;                       // 0..1, płasko ≈ 0,5·(…)
  export function shadeOverlay(dem: Dem, shade: Float32Array): Pixels;     // widok płaski, RGBA
  export function reliefImage(dem: Dem, shade: Float32Array, iso: IsoRoute, colors: { background: string }, maxPixels?: number):
    Pixels & { rect: Rect };                                               // rect w jednostkach płótna przed kamerą
  ```
- `src/ui/useTerrain.ts`: `useTerrain(projection, area: Rect | null, enabled) -> { dem: Dem | null; loading: boolean }` (wzorzec anulowania z `useRegionLayers`) oraz mała funkcja `toDataUrl(p: Pixels, type)` (canvas `putImageData` → `toDataURL`).
- Testy: `src/lib/dem.test.ts`, `src/lib/relief.test.ts`.

Zmiany:
- `src/lib/vectorMap.ts`: `export` przy `cached` i `queuedFetch`.
- `src/lib/isoRoute.ts`: `isoRoute(s, box, projection, dem?: Dem)`; pole `baseM` w `IsoRoute`.
- `src/postcard/IsoRoute.tsx`: prop `onSurface?: boolean` (bez kurtyny i cienia, mały odstęp w górę).
- `src/postcard/Postcard.tsx`: prop `terrain?: { href: string; rect: Rect }` (3D: zamiast podłogi i brył; płasko: nad sceną w grupie kamery); podpis z `TERRAIN_ATTRIBUTION`, gdy `terrain`.
- `src/ui/MapBackdrop.tsx`: ten sam prop i rysowanie.
- `src/ui/PostcardScreen.tsx`: stan `terrain` (domyślnie z `TERRAIN_AUTO_M`), przełącznik w View, `iso` z DEM, obszar DEM, obrazy w `useMemo`, brak `refined` w 3D z terenem, blokada eksportu przy `loading`.
- `src/App.tsx` (atrybucja w aplikacji), `README.md` (źródło, atrybucja, prywatność), `docs/architecture.md`.

Testy obowiązkowe (Vitest, bez sieci):
- `terrarium`: `(128, 0, 0)` → 0 m, `(0, 0, 0)` → −32768, znany piksel z ułamkiem `B`.
- `demFromTiles`: dwa kafelki obok siebie dają `w = 512`, `cell = size/256`, `x0 = left` pierwszego; wartość z drugiego kafelka pod właściwym indeksem.
- `demAt`: w węźle = wartość, w środku komórki = średnia, poza siatką = brzeg.
- `hillshade`: płaszczyzna pozioma = stała; stok zwrócony na NW jaśniejszy niż na SE.
- `reliefImage`: wysoka komórka z przodu zasłania niższą z tyłu (kolumna ma kolor przodu); `width·height ≤ maxPixels`; płaski DEM daje romb podłogi zgodny z `iso.matrix` (narożniki).
- `isoRoute` z DEM w postaci płaszczyzny `h = c·x`: podniesienie liniowe w `x`, `baseM` = min na trasie, wynik bez DEM bez zmian (istniejące testy).

Ręcznie: bieg w Tatrach i płaski w mieście, oba widoki, motyw jasny i ciemny, eksport PNG i SVG (rozmiar, czas), Network (liczba kafelków z S3, CORS), telefon.

### Etap 2 (później, osobna decyzja właściciela)
- Mapa wektorowa na terenie bez parsowania ścieżek: scena motywu (`MapBackground` bez filtrów) rasteryzowana do canvasa (ta sama droga co `exportPng`) i użyta jako kolor albedo w `reliefImage` zamiast jednolitego tła.
- Budynki na terenie: `Buildings3D` z podniesieniem o `demAt(środek)`.
- Zasłanianie trasy przez grzbiety (bufor wysokości kolumn z `reliefImage` jako maska), kolory reliefu w motywach (`MapStyle.relief?`), ponowny render przy zoomie > 2 po zatrzymaniu kamery, obszar DEM za kamerą (jak `nextBackdropArea`), Web Worker, jeśli render przytnie UI.

## Konsekwencje
- Nowy zewnętrzny host (`s3.amazonaws.com`): kolejna usługa bez SLA i kolejny podmiot widzący obszar biegu. Wymiana źródła = jedna stała.
- Zero nowych zależności. Ok. 250–350 linii nowego kodu (dwa moduły czyste + hook) i małe zmiany w istniejących.
- W 3D z terenem znika podłoga wektorowa (ulice, woda, budynki) do etapu 2: wygląd monochromatycznego plakatu reliefowego. Motywy różnią się wtedy tylko kolorem tła, trasy i tekstu.
- Trasa w 3D z terenem używa wysokości DEM, nie zegarka; slot „przewyższenie” i wykresy dalej liczą ze strumienia (mogą się różnić od rysunku o kilka procent).
- Trasa jest zawsze na wierzchu: za grzbietem widać ją „przez górę” (do etapu 2).
- Plik SVG z reliefem rośnie o 1–3 MB (JPEG w data URL); PNG bez zauważalnej zmiany czasu.
- Atrybucja terenu jest uproszczona na pocztówce (pełna lista w aplikacji i README); właściciel powinien ją zatwierdzić, bo dokument Joerd przenosi odpowiedzialność za zgodność z licencjami źródeł na użytkownika.
