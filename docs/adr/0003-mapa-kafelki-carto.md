# 0003. Mapa z kafelków CARTO (dane OSM) bez biblioteki map

## Kontekst
Pod trasą (pocztówka i miniatury na liście) ma być widać mapę. Pocztówka to jeden samowystarczalny SVG eksportowany przez `<img>` -> canvas (ADR 0002), więc każdy zasób musi być w nim jako data URL. Trasa jest rzutowana przez `d3-geo` `geoMercator().fitExtent` (`src/lib/routePath.ts`). Nie chcemy nowych zależności ani bazy/backendu.

## Decyzja
- Źródło: rastrowe kafelki CARTO (dane OpenStreetMap), `https://basemaps.cartocdn.com/{style}/{z}/{x}/{y}@2x.png` (host bez subdomen a–d, bo dla niego CORS `*` jest sprawdzony). Pocztówka: `dark_all` (biała treść). Miniatury: `light_all` w jasnym motywie, `dark_all` w ciemnym.
- Bez biblioteki map (Leaflet/MapLibre): kafelki liczy czysta funkcja w `src/lib/mapTiles.ts` z TEJ SAMEJ projekcji co trasa. Mercator d3 i Web Mercator kafelków różnią się tylko skalą i przesunięciem: szerokość świata = `2*PI*scale` jednostek, więc zoom kafelka `z = round(log2(2*PI*scale*pixelRatio/512))` (kafelek @2x ma 512 px), przycięty do [0, 19]. Rozmiar kafelka na płótnie `s = 2*PI*scale / 2^z`, lewy górny róg świata = `projection([-180, 85.0511])`. Zwracamy kafelki pokrywające całe płótno (1080x1920 lub 100x100), x modulo `2^z`, y poza [0, 2^z) pomijane; krawędzie zaokrąglane do całych jednostek (bez szczelin przy rysowaniu na canvas). Dla pocztówki `pixelRatio = 1` daje s w [362, 724) -> max 4x7 = 28 kafelków; dla miniatur `pixelRatio ~ 3` -> max 2x2.
- Pocztówka: tło to trzeci tryb `'gradient' | 'transparent' | 'map'`. Kafelki są pobierane `fetch -> blob -> data URL` z pamięciowym cache (jak font) i osadzane jako `<image>`; eksport jest możliwy dopiero, gdy wszystkie są gotowe. Podpis „© OpenStreetMap contributors © CARTO” jest częścią SVG w trybie mapy.
- Miniatury: zwykłe URL-e w `<image href>`, bez eksportu i bez data URL.
- Mapa i trasa są rysowane w jednej grupie `<g>` („scena”) z jednej projekcji.

## Konsekwencje
- Zero nowych zależności; logika kafelków testowalna jednostkowo (Vitest).
- Zależność od darmowego, zewnętrznego CDN CARTO: warunki użycia (attribution, limity, użycie niekomercyjne) i dostępność poza naszą kontrolą. Zmiana dostawcy = zmiana szablonu URL i podpisu, o ile serwuje kafelki XYZ z CORS.
- Przeglądarka użytkownika łączy się z CARTO i ujawnia mu obszar biegu (przybliżoną lokalizację) – do wzmianki w README.
- Mapa pokazuje okolicę startu/mety; dopóki nie ma przycięcia trasy (etap 2), tryb mapy zwiększa ryzyko ujawnienia miejsca zamieszkania. Strefy prywatności Stravy (scope `activity:read`) nadal działają.
- Klucz API (dopisane po sprawdzeniu w przeglądarce): CARTO bez klucza zwraca kafelki „API KEY REQUIRED”. Klucz darmowy (non-commercial, do 5M zapytań/mies.), publiczny, przeglądarkowy, doklejany jako `?key=` do URL kafelka; zmienna `VITE_CARTO_API_KEY` w `.env` (opcjonalna, czytana tylko w `src/lib/mapTiles.ts`). Bez klucza mapy nie ma nigdzie (miniatury bez kafelków, brak trybu „Map”, brak podpisu). Zalecane przypięcie klucza do domen w panelu CARTO.
- Kafelki na pocztówce są rysowane o 1 jednostkę większe (zakładka), bo antyaliasing styku przy skalowaniu podglądu/eksportu dawał widoczne linie.
- Przyszły widok 3D/izometryczny (tylko pocztówka) nie jest blokowany: będzie kolejną wartością trybu (np. `'map3d'`) i podmienia zawartość „sceny”. Wariant 2.5D w SVG: macierz `transform` na grupie sceny (kafelki + trasa) i przesunięcie punktów trasy o wysokość ze streamów. Wariant Three.js: render do canvas -> data URL -> `<image>` w tym samym SVG, więc ADR 0002 (jeden SVG do eksportu) zostaje w mocy. Warunek: projekcja liczona raz i przekazywana do warstw, nie ukryta w komponencie trasy.
