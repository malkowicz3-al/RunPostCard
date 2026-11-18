# 0004. Mapa wektorowa z OpenFreeMap rysowana jako SVG (zastępuje 0003)

## Kontekst
Rastrowe kafelki CARTO (ADR 0003) bez klucza dają znak wodny „API KEY REQUIRED”, a klucz to dodatkowa konfiguracja dla każdego, kto uruchamia repo. Właściciel chce minimalistycznego zarysu mapy (ulice, budynki, woda, zieleń) rysowanego przez nas w SVG, pod trasą, na pocztówce (tło „Map”) i w miniaturach listy, bez żadnej konfiguracji.

Sprawdzone 2026-11-18 z `http://localhost:5173`:
- Overpass API niedostępne (502/504/timeout, także `/api/status`): odrzucone jako niewiarygodne.
- OpenFreeMap: TileJSON `https://tiles.openfreemap.org/planet` (pole `tiles[0]` z wersją w ścieżce, która się zmienia), `maxzoom` 14, schemat OpenMapTiles (warstwy `building`, `transportation` z `class`, `water`, `waterway`, `park`, `landcover`, …), bez klucza, CORS działa, `application/vnd.mapbox-vector-tile`. Kafelek z14 centrum Krakowa: 388 KB.
- MVT: geometria w układzie lokalnym kafelka `0..extent` (OpenMapTiles: `extent` = 4096) z buforem poza tym zakresem; kafelek nie ma rozmiaru w pikselach, „512” to tylko konwencja stylów. Rzutowanie: punkt kafelka `(gx, gy)` -> płótno `(left + gx/extent*size, top + gy/extent*size)`.
- Regulamin OpenFreeMap nie narzuca treści atrybucji; zakazuje automatycznego masowego pobierania, a dla pobrań offline zaleca max 4 równoległe zapytania. Atrybucja w TileJSON: OpenFreeMap, © OpenMapTiles, dane © OpenStreetMap. Schemat OpenMapTiles jest na CC-BY 4.0, dane OSM na ODbL – obie wymagają podpisu.

## Decyzja

### Źródło i pobieranie
- Jedno źródło mapy: wektorowe kafelki OpenFreeMap. CARTO usunięte w całości (kafelki rastrowe, `VITE_CARTO_API_KEY`, `MAP_ENABLED`, `tileUrl`, data URL kafelków). Mapa działa bez konfiguracji. Domyślne tło pocztówki nadal `'gradient'`.
- TileJSON pobierany raz na sesję (obietnica w pamięci); z niego `tiles[0]` (walidacja: string `https://…` zawierający `{z}`, `{x}`, `{y}`) i `maxzoom` (używamy `min(14, maxzoom)`). Błąd nie zostaje w cache.
- Kafelki: `src/lib/mapTiles.ts` zostaje i liczy kafelki z TEJ SAMEJ projekcji co trasa (`fitRoute`), ale parametrem jest docelowy rozmiar kafelka w jednostkach płótna `tileUnits` zamiast `pixelRatio`: `z = clamp(round(log2(world / tileUnits)), 0, maxZoom)`. Krawędzie NIE są zaokrąglane (to było tylko na szczeliny rastrów): `Tile = {z, x, y, left, top, size}` w liczbach rzeczywistych.
  - Pocztówka: `tileUnits = 1024` -> rozmiar kafelka w [724, 1448) albo większy przy `z = 14` -> najwyżej 3x4 = 12 kafelków. Bieg 5 km w Krakowie wypada na z13 (budynki w OpenMapTiles są od z13; dla dłuższych biegów budynki znikają same – akceptowane).
  - Miniatura: `tileUnits = 256` na płótnie 100x100 -> najwyżej 2x2 = 4 kafelki, typowo z11–z12.
  - **Aktualizacja (zoom 3D):** `mapTiles(..., region)` z `region = {k, rect}` liczy `z = tileZoom(k)` (świat × k) i zwraca tylko kafelki nad `rect`, nadal w jednostkach płótna. `loadRegionLayers` pomija region, gdy `tileZoom(k)` nie jest większy niż bazowy (już z14), albo gdy kafelków jest > 24; precyzja 0,5 (k = 2) / 0,25 (k = 4), `minBuildingArea / k²`, odcięcie obiektów do `rect`. Cache kafelków i obiektów bez zmian. Na danych testowych: 4–12 kafelków z14 na region.
- Jeden cache w pamięci `URL -> Promise<VectorTile>` współdzielony przez pocztówkę i miniatury (ten sam wzorzec co `dataUrl.ts`: błąd usuwany z cache).
- Kolejka: najwyżej 4 równoległe `fetch` do OpenFreeMap (zgodnie z ich zaleceniem). Bez leniwego ładowania (IntersectionObserver) – 30 miniatur to zwykle kilka unikalnych kafelków, bo biegi zaczynają się w tej samej okolicy; dodać dopiero, gdy to zmierzymy jako problem.
- Odpowiedź 204 albo pusta -> pusty kafelek (bez warstw), inny status nie-OK -> błąd. Jeśli ciało zaczyna się od `1f 8b` (gzip bez nagłówka `Content-Encoding`), rozpakować przez `DecompressionStream('gzip')` (API przeglądarki, bez zależności).

### Dekodowanie: zależność `@mapbox/vector-tile` + `pbf`
Rekomendacja: zależność, nie własny dekoder. Własny minimalny dekoder MVT to ok. 100 linii parsowania binarnego protobuf (varinty, zigzag, komendy geometrii, tablice kluczy/wartości) na danych z zewnętrznego serwera – dokładnie to miejsce, gdzie błędy są ciche i trudne do testowania. `@mapbox/vector-tile` + `pbf` to referencyjna, mała (kilka KB gz), powszechnie używana implementacja tego formatu. Zasada „bez zbędnych zależności” jest zachowana: ta jest uzasadniona, a kod dekodowania zostaje cienką warstwą (kilka linii), więc wymiana jest tania.

### Rysowanie
- Czysta funkcja `buildMapLayers(features, [width, height], profile)` przyjmuje proste obiekty `{layer, type, cls, geometry: {x, y}[][], tile}` (adapter z `VectorTile` to kilka linii osobno), więc testy nie potrzebują binarnych kafelków.
- Klasyfikacja do kluczy (kolejność rysowania od spodu): `water` (warstwa `water`, poligony; `waterway` jako linie tym samym kolorem), `green` (`park`; `landcover` klasy `wood`/`grass`), `building`, `path` (`transportation` klasy `path`/`track`), `minor` (`minor`/`service`), `mid` (`secondary`/`tertiary`), `major` (`motorway`/`trunk`/`primary`). Pomijamy `rail`, `ferry` i inne klasy oraz `brunnel = tunnel`; z `transportation` tylko linie.
  - **Aktualizacja (ADR 0005, „Details”):** dochodzą warstwy źródłowe `landuse` i `aeroway`. Profil `POSTCARD_DETAILED` klasyfikuje dodatkowo: `rail`/`transit` -> `rail` (tunele kolei pomijane), tunel drogowy -> `tunnel`, `brunnel = bridge` -> klucz drogi + `bridge`; `landuse` -> `landuse`/`industrial`/`civic`/`sport` wg klasy; `landcover` `farmland`/`sand` -> `field`; `aeroway` linie `runway`/`taxiway` -> `runway`, poligony -> `industrial`. `POSTCARD` i `THUMB` bez zmian. Klasyfikacja zwraca listę kluczy (most = dwa), geometria dekodowana tylko dla kluczy profilu; `featureCache` z kluczem po `keys`, więc profile się nie mieszają.
- Rzutowanie punktu: `left + gx/extent*size`, zaokrąglenie do `profile.precision` (pocztówka 1 jednostka, miniatura 0,1). Po zaokrągleniu usuwane kolejne duplikaty punktów.
- Odchudzanie: odrzucenie obiektu, którego bbox nie przecina płótna; budynek z bbox mniejszym niż `profile.minBuildingArea` (np. 16 j²) pominięty; linia krótsza niż 1 jednostka po zaokrągleniu pominięta. Bez Douglasa–Peuckera i bez geometrycznego przycinania (resztę przycina viewBox).
- Wynik: `Record<klucz, string>` – JEDEN atrybut `d` na klucz (poligony `M…Z`, linie `M…L…`). Jeden `<path>` na warstwę sprawia, że duplikaty z bufora kafelków i styki kafelków nie są widoczne (wypełnienie `nonzero`, obrys jednej ścieżki maluje się raz). Poligony tylko wypełniamy (bez obrysu), bo obrys pokazałby granice kafelków. Kolory pełne (bez przezroczystości), żeby nakładanie się nie zmieniało odcienia.
- Profile w jednym miejscu (`src/lib/vectorMap.ts`): `POSTCARD` (wszystkie klucze, precision 1, minBuildingArea 16) i `THUMB` (tylko `water`, `minor`, `mid`, `major`; precision 0,1; budynków brak).
- Kolory i grubości jako stałe w jednym miejscu (`src/postcard/mapStyle.ts`) pod przyszłe presety. Pocztówka: ciemne tło (`<rect>` na całe płótno), ulice jasne cienkie linie z grubością wg klasy (np. major 5, mid 3.5, minor 2, path 1.2), budynki delikatnie jaśniejsze od tła, woda i zieleń subtelnie zabarwione. Trasa na wierzchu jak teraz, w tej samej grupie „scena” (ADR 0003).
- Miniatury: kolory z tokenów CSS (`var(--map-water)`, `var(--map-road)` w `styles.css` dla jasnego i ciemnego motywu), trasa nadal `currentColor`. Miniatura nie zależy już od `useColorScheme`.
- Pocztówka dostaje gotowe ścieżki przez prop (`map?: MapLayers`) i pozostaje synchroniczna; wszystko jest wektorowym SVG inline, więc eksport PNG/SVG działa bez data URL (ADR 0002 w mocy).

### Atrybucja
- Pocztówka w trybie mapy: „© OpenMapTiles © OpenStreetMap contributors” (w miejscu obecnego podpisu CARTO; jeśli koliduje ze znakiem Stravy, skrócić do „© OpenMapTiles © OpenStreetMap”).
- Aplikacja (pod listą, teraz zawsze, bo miniatury zawsze mają mapę): „Map: OpenFreeMap © OpenMapTiles © OpenStreetMap contributors” z linkami do openfreemap.org, openmaptiles.org i openstreetmap.org/copyright.

### Prywatność
Przeglądarka pobiera kafelki z `tiles.openfreemap.org` (za Cloudflare), więc OpenFreeMap i Cloudflare widzą obszar biegu (przybliżoną lokalizację) – tak jak wcześniej CARTO. Opisać w README.

## Konsekwencje
- Jedna nowa para zależności (`@mapbox/vector-tile`, `pbf`); mniej konfiguracji (koniec z kluczem CARTO).
- Pełna kontrola nad stylem mapy (presety w etapie 5 zmieniają tylko stałe w `mapStyle.ts`).
- Zależność od darmowej usługi OpenFreeMap bez SLA; URL kafelków brany z TileJSON, więc zmiana wersji planety nas nie psuje. Zmiana dostawcy = inny URL TileJSON, o ile serwuje schemat OpenMapTiles z CORS.
- Rozmiar SVG pocztówki w gęstym centrum miasta może sięgać 1–3 MB tekstu ścieżek; budżet pilnowany przez `minBuildingArea` i `precision`.
- Dekodowanie i budowa ścieżek na głównym wątku (do ~12 kafelków); Web Worker dopiero, jeśli UI zauważalnie się zacina.
- 3D/izometria (przyszłość): warstwa `building` w OpenMapTiles ma `render_height`/`render_min_height`, więc ekstruzja budynków 2.5D jest możliwa z tych samych danych; rzeźby terenu kafelki nie mają (potrzebne osobne źródło wysokości albo streamy Stravy).

## Plan wdrożenia (dla codera)
1. `npm i @mapbox/vector-tile pbf` (sprawdzić w README zainstalowanej wersji: nazwa czytnika `Pbf`/`PbfReader` i czy typy są w paczce; jeśli nie – `@types/*` w devDependencies).
2. `src/lib/mapTiles.ts`: usunąć `MapStyle`, `cartoKey`, `MAP_ENABLED`, `tileUrl`; sygnatura `mapTiles(projection, [w, h], tileUnits, maxZoom = 14)`; `Tile = {z, x, y, left, top, size}` bez zaokrągleń; dodać `tileUrlFrom(template, t)` (podstawienie `{z}/{x}/{y}`).
3. `src/lib/vectorMap.ts` (nowy): `loadTileJson()` (cache), kolejka 4 równoległych, `loadTile(url): Promise<VectorTile>` (cache, 204/puste, gzip), adapter `VectorTile -> features`, `buildMapLayers(...)`, profile `POSTCARD`/`THUMB`, typ `MapLayers`, stała `MAP_ATTRIBUTION`. Funkcja wysokiego poziomu `loadMapLayers(projection, size, profile): Promise<MapLayers>`.
4. `src/postcard/mapStyle.ts` (nowy): kolory tła/warstw i grubości linii pocztówki.
5. `src/postcard/MapBackground.tsx`: `<rect>` tła + po jednym `<path>` na klucz w ustalonej kolejności; usunąć `postcardTileUrls` i `<image>`.
6. `src/postcard/Postcard.tsx`: prop `mapImages` -> `map?: MapLayers`; podpis z `MAP_ATTRIBUTION`.
7. `src/ui/useMapLayers.ts` (nowy, mały hook): `(projection | null, size, profile, enabled) -> {layers?, failed}` z flagą anulowania przy odmontowaniu; używany przez `PostcardScreen` i `RouteThumb`.
8. `src/ui/PostcardScreen.tsx`: usunąć `MAP_ENABLED` (przycisk „Map” zawsze), `fetchDataUrl` kafelków; użyć hooka; zachować „Loading map…”, blokadę eksportu w trakcie i powrót do gradientu przy błędzie.
9. `src/ui/RouteThumb.tsx`: `fit` w `useMemo([polyline])`, hook z profilem `THUMB`, ścieżki z `var(--map-*)`; usunąć `useColorScheme` (plik `useColorScheme.ts` usunąć, jeśli nie ma innych użyć).
10. `src/styles.css`: tokeny `--map-water`, `--map-road` dla obu motywów. `src/App.tsx`: nowy podpis z linkami, bez warunku `MAP_ENABLED`.
11. `src/lib/dataUrl.ts`: poprawić komentarz (tylko font).
12. Usunąć `VITE_CARTO_API_KEY` z `.env.example`, `docs/setup/3-env-file.svg`, typów env (jeśli są); README: usunąć sekcję klucza CARTO, opisać OpenFreeMap (bez konfiguracji), atrybucję i prywatność; `docs/architecture.md`: opisy `mapTiles.ts`, `MapBackground.tsx`, `RouteThumb.tsx`, nowe pliki, decyzja „ADR 0004”.
13. `CLAUDE.md` (linia o mapie CARTO) – zmienia właściciel, nie agent.

## Testy obowiązkowe (Vitest, bez sieci)
- `mapTiles.test.ts` (przerobić istniejące): zoom z `tileUnits` i przycięcie do `maxZoom` 14; pokrycie płótna bez szczelin; najwyżej 12 kafelków na pocztówce (`tileUnits` 1024) i 4 w miniaturze (`tileUnits` 256) w pętli skal/przesunięć; zawijanie x na antypołudniku; pomijanie y poza zakresem; sąsiednie kafelki: `left[i+1] === left[i] + size`; punkt Krakowa w kafelku zgodny ze wzorem slippy map z dokładnością < 0,5 jednostki; `tileUrlFrom`.
- `vectorMap.test.ts` (nowy, na obiektach `{layer, type, cls, geometry, tile}`): klasyfikacja klas `transportation` do kluczy i pomijanie `rail`/tunelu; profil `THUMB` nie zwraca budynków ani ścieżek; mały budynek pominięty, duży zostaje; obiekt poza płótnem pominięty; rzutowanie `gx = extent` trafia w `left + size`; zaokrąglenie i usuwanie duplikatów punktów; jeden string `d` na klucz; walidacja TileJSON (zły/brakujący `tiles[0]` -> błąd); kolejka nie przekracza 4 równoległych (`fetch` zamockowany) i ten sam URL pobierany raz; błąd nie zostaje w cache.
- Ręcznie w przeglądarce (nie w CI): pocztówka „Map” dla biegu w mieście i poza miastem, eksport PNG i SVG, rozmiar pliku SVG, lista 30 miniatur w jasnym i ciemnym motywie, zakładka Network (liczba zapytań do OpenFreeMap).
