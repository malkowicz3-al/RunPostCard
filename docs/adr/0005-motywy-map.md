# 0005. Motywy map rysowane kodem w SVG (minimal, pixel, fantasy)

> **Aktualizacja (decyzja właściciela):** motywy pixel (8-bit) i fantasy usunięte jako „za dużo”. Motywy zmieniają tylko stylistykę (kolory, linie, poświata), bez ikon: **dark** (dawny minimal, bez zmian wizualnych, domyślny), **light**, **neon** (`src/postcard/themes/`). Usunięte razem z nimi: `MapObjects`/`buildMapObjects`, profil `PIXEL`, `random.ts`, `geometry.ts` (rozmieszczanie ikon, schodkowa trasa), `shownTheme` (jeden profil `POSTCARD` dla wszystkich motywów). Zostaje podział scalonych multipoligonów budynków w `buildMapLayers` i warianty `StravaMark`. Interfejs: `MapTheme = { label, render(layers) -> { scene, route, text, mark } }`; filtry SVG lokalne, z obszarem równym płótnu. Poniższy tekst opisuje pierwotną wersję i zostaje jako historia.

## Kontekst
Etap 2 „Motywy map” (CLAUDE.md): z tych samych danych OSM co tło „Map” (ADR 0004) generujemy stylizowane mapy na pocztówce, np. zamek zamiast bloku, smok, woda w falach. Wymagania: deterministycznie (ziarno = id biegu), trasa dokładna, eksport SVG/PNG jak teraz (ADR 0002: jeden samowystarczalny SVG), miniatury listy bez zmian, bez nowych zależności.

Stan kodu:
- `buildMapLayers` (`src/lib/vectorMap.ts`) zwraca jeden string `d` na klucz warstwy; obiekty (budynki, parki) giną przy sklejaniu.
- `MapBackground.tsx` rysuje `<rect>` + `<path>` na klucz z kolorami z `mapStyle.ts`.
- `Route.tsx` ma na sztywno biały kolor i grubość 14; `SlotNumber.tsx` i podpis mapy w `Postcard.tsx` mają na sztywno `fill="#ffffff"`; `StravaMark` zawsze w wariancie białym.
- `Background.tsx` już używa `feTurbulence`, a eksport PNG (SVG -> Image -> canvas) go zawiera, więc filtry SVG w eksporcie działają przynajmniej w przeglądarce właściciela.
- Jedyny font: Barlow Condensed Bold (`public/fonts`, OFL), osadzany jako data URL.

Pierwsza część etapu: architektura + `minimal` (obecny wygląd bez zmian) + `pixel` (8-bit) + `fantasy` (pergamin). Mapa skarbów, neon i akwarela później, w tym samym interfejsie.

## Decyzja

### 1. Interfejs motywu i rejestr
Nowy katalog `src/postcard/themes/`. Rejestr jak `FORMS` w `slots.ts`:

```ts
export type ThemeId = 'minimal' | 'pixel' | 'fantasy';

export type ThemeInput = {
  map: MapData;               // { layers: MapLayers (d jak dziś), objects: MapObjects }
  size: [number, number];     // 1080x1920
  route: [number, number][];  // punkty trasy w układzie płótna (ta sama projekcja)
  seed: number;               // hashSeed(activity.id)
  activity: Activity;         // nazwa biegu do kartusza itp.
  exclude: Rect[];            // strefy bez dekoracji: sloty + znak Stravy/podpis
};

export type ThemeOutput = {
  scene: ReactNode;    // pod trasą: <defs>, tło, warstwy mapy, ikony (drzewa, zamki, smok)
  overlay?: ReactNode; // nad trasą, pod slotami: kartusz, róża wiatrów
  route: { stroke: string; width: number; outline?: string; outlineWidth?: number;
           dash?: string; filter?: string; crisp?: boolean; d?: string }; // d nadpisuje ścieżkę (pixel: schodki)
  text: { color: string; outline?: string; outlineWidth?: number };
  mark: 'white' | 'black' | 'orange'; // wariant oficjalnego znaku Stravy (pliki już są w assets)
};

export type MapTheme = { label: string; profile: MapProfile; render: (input: ThemeInput) => ThemeOutput };
export const THEMES: Record<ThemeId, MapTheme>;
```

- `Rect = [x0, y0, x1, y1]`.
- Motyw działa tylko przy tle `'map'`. Gradient i przezroczyste tło się nie zmieniają.
- `Postcard` liczy `render(...)` w `useMemo([themeId, map, activity])`. Rozmieszczanie w gęstym mieście zajmuje kilka do kilkudziesięciu ms i nie może się powtarzać przy każdym renderze (np. po doczytaniu fontu).
- **Kolory slotów bez przepisywania slotów:** `SlotNumber` zamienia `fill="#ffffff"` na `fill="currentColor"` (2 miejsca). `Postcard` owija sloty w `<g color={text.color} stroke={text.outline} strokeWidth={text.outlineWidth} paintOrder="stroke" strokeLinejoin="round">`. `stroke` i `paint-order` się dziedziczą, `color` daje `currentColor`. Konwencja dla przyszłych form slotów: kolor tylko przez `currentColor`, bez stałych kolorów.
- `Route` dostaje props ze stylu (`stroke`, `width`, opcjonalny obrys rysowany pod spodem jako druga ścieżka, `dash`, `filter`, `shapeRendering`). Domyślne wartości = obecne, więc gradient i przezroczyste tło wyglądają jak dziś.
- `StravaMark` dostaje prop `variant` (domyślnie `'white'`). Pliki są oficjalne i niezmienione.
- Podpis mapy dostaje `fill={text.color}`.
- `MapBackground` staje się ogólnym rendererem warstw z propem `style: MapStyle = { background: string; colors: Record<MapKey, string>; widths; linecap?: 'round' | 'square' }`. `background` i `colors` mogą być `url(#…)` (gradient, wzór). `mapStyle.ts` eksportuje typ `MapStyle` i `MINIMAL` (dzisiejsze stałe bez zmian wartości).
- `minimal` = `{ profile: POSTCARD, scene: <MapBackground style={MINIMAL}/>, route: biała 14, text: biały, mark: 'white' }`. Wynik ma być piksel w piksel taki jak dziś.
- Id w `<defs>` z prefiksem motywu (`fantasy-…`, `pixel-…`), żeby nie kolidowały z `bg-gradient`/`bg-grain`.

Sprawdzenie dla kolejnych motywów:
- Mapa skarbów: pergamin jak fantasy, `route.dash`, krzyżyk „X” na `route.at(-1)` w `overlay`, palmy przez ten sam `scatter`.
- Neon: ciemne tło, `feGaussianBlur` w `scene` i `route.filter` (poświata).
- Akwarela: filtry `feTurbulence` + `feDisplacementMap` + rozmycie na wypełnieniach w `scene`, tekstura papieru.

Interfejs je udźwignie bez zmian; najwyżej dojdzie pole w `route`.

### 2. Dane na poziomie obiektów
W `vectorMap.ts` rzutowanie i filtrowanie z `buildMapLayers` przenosimy do wewnętrznej funkcji `projectFeatures(features, size, profile)`, która zwraca `{ key, rings, box }[]`. Konsumują ją dwie czyste funkcje:
- `buildMapLayers(...)`: bez zmian w sygnaturze i wyniku; istniejące testy przechodzą bez zmian.
- `buildMapObjects(...): MapObjects`:

```ts
type Ring = [number, number][];
type Area = { rings: Ring[]; area: number; box: Rect };
type MapObjects = {
  buildings: { x: number; y: number; area: number }[]; // x, y = środek bbox
  green: Area[];
  water: Area[];
};
```

- `area` = |suma pól ze znakiem wszystkich pierścieni| (shoelace). Otwory w MVT mają przeciwny kierunek, więc wychodzi pole bez otworów.
- Środek budynku = środek bbox: tani i wystarcza do postawienia ikony.
- Współrzędne są już zaokrąglone, w układzie płótna.
- Rzek i dróg jako obiektów nie robimy. Motywy rysują je z istniejącego `d` (obrys, wzór, filtr); dojdą, gdy któryś motyw ich naprawdę potrzebuje.
- `MapProfile` dostaje pole `objects: boolean`: `POSTCARD` i `PIXEL` = true, `THUMB` = false (30 miniatur nie liczy obiektów).
- `loadMapLayers` zwraca `MapData = { layers, objects }` (przy `objects: false` puste tablice). Robi jedno `projectFeatures` i z niego oba wyniki.
- `useMapLayers` zwraca `{ layers?, objects?, failed }` (rozłożone `MapData`), więc `RouteThumb` się nie zmienia.
- Rozmiar:
  - obiekty żyją tylko w pamięci i nie trafiają do SVG;
  - kilka tysięcy budynków to kilka tysięcy małych obiektów, a pierścienie zieleni i wody to co najwyżej dziesiątki tysięcy punktów, czyli pomijalnie;
  - do SVG trafiają tylko postawione ikony jako `<use>`, z limitami liczby (niżej).
- Duplikaty z bufora kafelków i budynki rozcięte na styku kafelków:
  - zieleń i woda: nie przeszkadzają (test punktu w dowolnym wielokącie);
  - budynki: duplikaty usuwa minimalny odstęp między ikonami.

### 3. Losowość deterministyczna i rozmieszczanie
`src/lib/random.ts` (bez zależności, ~15 linii):
- `hashSeed(...parts: (string | number)[]): number`: FNV-1a 32-bit po `parts.join(':')`. Id Stravy przekracza 2^32, więc hashujemy string.
- `mulberry32(seed): () => number`: wartości w [0, 1).
- Osobny strumień na rodzaj ikony: `mulberry32(hashSeed(activity.id, 'trees'))`. Zmiana liczby zamków nie przesuwa wtedy drzew.
- Determinizm dotyczy tych samych danych mapy. Zmiana OSM może zmienić wygląd (akceptowane). Kolejność obiektów jest stała, bo `Promise.all` zachowuje kolejność kafelków.

`src/postcard/themes/geometry.ts` (czyste funkcje, wspólne dla motywów):
- `pointInPolygon(p, rings)`: promień, parzysto-nieparzyście, po wszystkich pierścieniach, więc otwory działają same.
- `OccupancyGrid(size, cell = 12)`:
  - siatka zajętości 90x160 komórek (`Uint8Array`);
  - `markRect`, `markRoute(points, radius)` (próbkowanie odcinków co pół komórki), `isFree(rect)`.
- `slotZones(layout)`:
  - pełne pasy szerokości płótna `[0, y - 0.8*size - 20, 1080, y + 80]` dla każdego elementu `defaultLayout`;
  - dodatkowo pas `[0, 1800, 1080, 1920]` (znak Stravy i podpis).
  - Pełna szerokość jest prosta i odporna na różną długość wartości (np. data).
- `placeIcons(input, opts)` zwraca `{ dragon?, castles, houses, trees }`. Każda ikona to `{ x, y, size, flip }` (drzewa bez `flip`).
  - Na start zajęte: `exclude` oraz bufor trasy (połowa grubości trasy + 12).
  - Kolejność: smok, zamki, domy, drzewa. Każda postawiona ikona zaznacza swój bbox.
  - **Smok:**
    - największy wolny kwadrat metodą DP na siatce, O(komórek);
    - najpierw na siatce, gdzie komórka musi dodatkowo leżeć w wodzie (środek komórki w `water` o polu ≥ progu);
    - gdy bok jest mniejszy niż `opts.dragon.min` (np. 160), szukamy na całej wolnej siatce;
    - gdy dalej za mały, smoka nie ma;
    - rozmiar = min(bok, max); `flip` z PRNG.
  - **Zamki i domy:**
    - budynki sortowane malejąco po `area`;
    - zachłannie bierzemy kolejne, jeśli bbox ikony jest wolny i odstęp od już postawionych ≥ `minSpacing`;
    - zamki: np. 4 sztuki, odstęp 220; domy: np. 30 sztuk, odstęp 80;
    - rozmiar ikony = clamp(sqrt(area) * k, min, max);
    - PRNG tylko do drobnego drgania i `flip`.
  - **Drzewa:**
    - globalna siatka co `spacing` (np. 36) po całym płótnie, punkt = środek komórki + drganie ±spacing/3 z PRNG;
    - punkt zostaje, jeśli leży w którymś `green` (najpierw test bbox) i jego bbox jest wolny;
    - limit `max` (np. 400);
    - globalna siatka zamiast siatki per wielokąt: nakładające się park/las nie dublują drzew.
  - `opts.grid` (pixel = 12): wszystkie współrzędne i rozmiary ikon przyciągnięte do wielokrotności siatki (`snap(v, g) = Math.round(v / g) * g`).
- Poissona nie robimy: siatka z drganiem wygląda wystarczająco dobrze i jest trywialna do przetestowania.

### 4. Pixel (8-bit)
- Profil `PIXEL = { ...POSTCARD, precision: 12, minBuildingArea: 144 }` w `vectorMap.ts` (profile w jednym miejscu). Przyciąganie mapy do siatki dzieje się w `buildMapLayers` za darmo przez `precision`. Cache dekodowania kafelków (`featureCache`, klucz po `keys`) jest wspólny z `POSTCARD`, więc zmiana motywu nie pobiera kafelków drugi raz.
- **Pułapka:** obecne `Math.round(v * k) / k` z `k = 1/12` daje błędy zmiennoprzecinkowe (np. `36.00000000000001`). Dla `precision >= 1` liczyć `Math.round(v / p) * p`, dla `< 1` zostawić obecny wzór (testy THUMB z 0,1 zostają).
- Na grupie `scene` `shapeRendering="crispEdges"`; `MapStyle.linecap = 'square'`.
- Drogi zostają polilinią na siatce (ukośne odcinki z `crispEdges` wyglądają pikselowo). Schodkowe drogi robimy dopiero, gdy właściciel zechce, przez obiekty linii.
- Trasa: `route.d = staircase(snapped route points, 12)`.
  - Tylko odcinki poziome i pionowe na siatce: dla każdego odcinka kroki H/V w proporcji dx:dy.
  - Odchylenie od prawdziwej trasy ≤ 1 komórka (12 j.), co jest celowe dla tego motywu.
  - Kolor np. `#ff004d`, obrys `#1d1d1d`, `crisp: true`, `linecap` kwadratowy.
- Paleta ograniczona, ok. 8 kolorów, propozycja:
  - tło trawa `#3e8948`, zieleń/las `#265c42`;
  - woda `#2b4fb0`, rzeki tym samym;
  - budynki `#8b5a3c`;
  - drogi piaskowe `#e8c170`, major `#f4f4f4`;
  - tekst biały z czarnym obrysem 8; znak `white`.
- Ikony jako `<symbol>` w `<defs>`, rysowane z prostokątów:
  - sprite to tablica stringów (np. `'..##..'`) + mapa znak -> kolor;
  - funkcja `spriteRects` scala poziome serie jednego koloru w jeden `<rect>`;
  - ikony: drzewo 8x8, dom 8x8, zamek 12x12, smok 16x12, rysowane w `<use href width height>`;
  - `viewBox` symbolu = rozmiar sprite'a;
  - rozmiary ikon będące wielokrotnością 12 dają równe „piksele”.
- Font bez zmian (Barlow). Font pikselowy (np. „Press Start 2P”, OFL) to osobna decyzja w presetach.

### 5. Fantasy (pergamin)
- **Tło:**
  - `radialGradient` pergaminu (`#f1e3c3` w środku, `#d8bf8f` na brzegach jako winieta);
  - ziarno `feTurbulence` jak w `Background.tsx` (numOctaves ≤ 2, niska nieprzezroczystość).
- **Drżące linie:**
  - filtr `feTurbulence` (baseFrequency ~0.02) + `feDisplacementMap` (scale 3–4) na grupie warstw mapy i ikon;
  - region filtra trochę większy niż płótno, żeby brzegi nie były puste;
  - NIGDY na trasie: trasa zostaje dokładna, a przesunięcie mapy o 3–4 j. jest niewidoczne.
- **Woda:**
  - `<pattern patternUnits="userSpaceOnUse">` (np. 28x14) z kolorem bazowym i falą (ścieżka „~” atramentem);
  - `colors.water = 'url(#fantasy-waves)'`; rzeki (`waterway`) jako atramentowy obrys.
- **Reszta mapy:**
  - zieleń jasnooliwkowa;
  - budynki jako ciepłe bloki niskiego kontrastu, z ikonami na wierzchu;
  - drogi atramentem `#4a3420` w grubościach jak dziś.
- **Ikony:** drzewa (sosna lub „lizak” z pniem), zamki, domy, smok.
- **Overlay:**
  - kartusz z nazwą biegu w pasie nad `ROUTE_BOX` (y < 260), wyśrodkowany, szerokość ≤ 680 j.;
  - nazwa obcięta do ~28 znaków z „…”, emoji mogą zostać (fallback systemowy);
  - róża wiatrów: gwiazda z wielokątów liczonych kodem, w prawym górnym rogu, poza kartuszem.
  - Oba prostokąty dopisane do `exclude`.
- **Trasa:** czerwony atrament `#8b1e1e`, grubość ~10, bez filtra.
- **Tekst:** `#3b2a1a` z jasną obwódką `#f1e3c3` (outlineWidth ~6).
- **Znak Stravy:** `black` (biały byłby nieczytelny na pergaminie).
- **Ikony – decyzja: rysujemy własne proste SVG w kodzie** (ścieżki i wielokąty w plikach motywu), bez plików w `src/assets/themes/`. Uzasadnienie:
  - brak licencji i atrybucji na pocztówce;
  - spójny styl;
  - kilka ikon to kilkadziesiąt linii.
  - game-icons.net (CC BY 3.0) wymaga atrybucji przy każdym udostępnionym obrazie, więc odrzucone.
  - Kenney (CC0) jest prawnie OK, ale to dodatkowe pliki w innym stylu.
  - Wraca do rozważenia (CC0 + wpis w README), jeśli własne ikony okażą się za słabe.
- **Font: zostaje Barlow Condensed**, bez nowych pobrań.
  - Kartusz: wersaliki z dużym `letterSpacing` (styl grawerowanej mapy).
  - Fonty systemowe (`serif`) odpadają: w eksporcie SVG na innym komputerze wyglądałyby inaczej.
  - Font szeryfowy OFL (np. IM Fell) to decyzja etapu presetów: kolejny TTF w `public/fonts` + `@font-face` w `fonts.ts`.

### 6. Eksport
- Ścieżka bez zmian (`exportPng.ts`).
- Filtry `feTurbulence`/`feDisplacementMap`, `<pattern>`, `<symbol>`/`<use>` i `shape-rendering` są wewnątrz SVG. SVG jako `<img>` je renderuje (Chrome, Firefox, Safari) i nie ma zewnętrznych zasobów, więc canvas nie jest skażony.
- Ryzyko Safari jest niżej. Test ręczny jest obowiązkowy.
- Czas:
  - filtry na 1080x1920 to rząd 100–400 ms na desktopie i więcej na telefonie, przy eksporcie akceptowalne;
  - w podglądzie przeglądarka zwykle cache'uje wynik filtra;
  - jeśli przewijanie się tnie, zmniejszyć `numOctaves` albo region filtra.
- Rozmiar:
  - SVG rośnie o kilkadziesiąt KB (`<use>` po ~60 B, limity ikon);
  - PNG z ziarnem na całym pergaminie może mieć 3–6 MB, bo szum się nie kompresuje; trzymać niską nieprzezroczystość ziarna.
- **Plan B (tylko jeśli Safari/telefon zawiedzie):**
  - ziarno jako tekstura PNG 256x256 generowana raz przez canvas + `mulberry32` -> `toDataURL` -> `<pattern><image href="data:…"/></pattern>`;
  - drżenie linii wyłączone (czyste linie), bez zależności.

### 7. UI
- `PostcardScreen`: stan `theme: ThemeId = 'minimal'`.
- Pod przełącznikiem tła drugi `.segmented` `role="group" aria-label="Map theme"` z przyciskami `aria-pressed` (Minimal, 8-bit, Fantasy), widoczny tylko przy `background === 'map'`.
- `useMapLayers(..., THEMES[theme].profile, ...)`. Profil to stała obiektu motywu, więc zależność efektu jest stabilna.
- Zmiana pixel <-> reszta przelicza warstwy z cache, a przez chwilę widać gradient z „Loading map…” (akceptowane).
- `Postcard` dostaje prop `theme`.
- Miniatury bez zmian (profil `THUMB`, tokeny CSS).

### 8. Zmiana po przeglądzie właściciela (ikony za małe, 8-bit „za bardzo fantasy”)
- Pixel to zwykłe miasto ze starej gry: bez smoka i zamku. Sprite'y: dom z dachem i kamienica (8x8, piksel 12 -> 96x96; większa trzecia część domów to kamienice), wieżowiec dla największych budynków (8x16 -> 96x192, `aspect` w opcjach budynków), drzewo i świerk (8x8 -> 96x96, odstęp 120, max 80). Wszystkie sprite'y mają ten sam piksel 12.
- OpenMapTiles scala budynki kafelka w jeden multipoligon (setki pierścieni), więc `projectFeatures` dzieli warstwę `building` na poligony (pierścień o kierunku pierwszego = nowy budynek, przeciwny = otwór), a `minBuildingArea` działa na pojedynczy budynek. Bez tego `MapObjects.buildings` miało ok. 1 „budynek” na kafelek i ikon budynków prawie nie było.
- Siatka 24 zamiast 12: `PIXEL.precision = 24`, `minBuildingArea = 576`, trasa schodkowa na 24, trasa 24 + obwódka 6, drogi 8/16/24/32, rzeki 24.
- Ikona ma osobne `w` i `h` = kolumny/wiersze sprite'a × całkowity piksel, zawsze wielokrotność siatki; siatka zajętości ma komórkę = siatkę, więc kwadrat smoka też jest na siatce.
- Bufor trasy przy `grid` rośnie o jedną komórkę (schodki odchodzą od trasy o ≤ 1 komórkę).
- Smok jest opcjonalny w `PlaceOpts` (pixel go nie używa).
- Fantasy bez zmian w wyglądzie, ikony ok. 2x: drzewa 56 (odstęp 64, max 200), zamki 128–220 (3 szt., odstęp 360), smok 280–500, domy 44–64 (20 szt., odstęp 110).

## Konsekwencje
- Nowy motyw = jeden plik w `themes/` + wpis w `THEMES`, bez zmian w slotach i eksporcie.
- Konwencja `currentColor` w formach slotów staje się wymagana.
- Determinizm zależy od danych OSM, nie tylko od ziarna.
- Pixel trasa jest celowo przybliżona (≤ 12 j.); fantasy przesuwa mapę filtrem o kilka jednostek względem trasy.
- Jeden font na wszystkie motywy do etapu presetów.
- Zero nowych zależności i zero plików graficznych, więc README nie potrzebuje sekcji licencji ikon (tylko zdanie „ikony narysowane w kodzie”).

## Plan wdrożenia (dla codera)
1. `src/lib/random.ts`: `hashSeed`, `mulberry32`.
2. `src/lib/vectorMap.ts`:
   - wydzielić `projectFeatures` (identyczne filtrowanie);
   - poprawić zaokrąglanie dla `precision >= 1`;
   - `buildMapObjects`, typy `MapObjects`/`MapData`/`Rect`;
   - pole `objects` w `MapProfile` (`POSTCARD`/`THUMB`), nowy `PIXEL`;
   - `loadMapLayers` -> `Promise<MapData>`.
3. `src/lib/routePath.ts`: `fitRoute` zwraca też `points: [number, number][]` (rzutowane punkty trasy).
4. `src/ui/useMapLayers.ts`: stan `{ layers?, objects?, failed }` z `MapData`.
5. `src/postcard/mapStyle.ts`: typ `MapStyle` + `MINIMAL` (obecne wartości).
6. `src/postcard/MapBackground.tsx`: prop `style` (tło, kolory, grubości, linecap).
7. `src/postcard/SlotNumber.tsx`: `fill="currentColor"`.
8. `src/postcard/Route.tsx`: props stylu z domyślnymi = obecne.
9. `src/postcard/StravaMark.tsx`: prop `variant` (import trzech plików `?raw`).
10. `src/postcard/themes/geometry.ts`: `pointInPolygon`, `OccupancyGrid`, `slotZones`, `placeIcons`, `snap`, `staircase`.
11. `src/postcard/themes/index.ts`: typy, `THEMES`.
12. `src/postcard/themes/minimal.tsx`.
13. `src/postcard/themes/pixel.tsx`: paleta, `spriteRects`, symbole, `placeIcons` z `grid: 12`, schodkowa trasa.
14. `src/postcard/themes/fantasy.tsx`: defs (pergamin, ziarno, drżenie, fale), symbole, kartusz, róża wiatrów.
15. `src/postcard/Postcard.tsx`:
    - props `map?: MapData`, `theme?: ThemeId`;
    - `useMemo` na `render`, `seed = hashSeed(activity.id)`, `exclude = slotZones(defaultLayout)`;
    - kolejność: `scene` -> trasa -> `overlay` -> `<g>` slotów z kolorem/obrysem -> znak Stravy (`mark`) -> podpis (`text.color`).
    - Przy tle innym niż `map`: jak dziś.
16. `src/ui/PostcardScreen.tsx`: stan i przełącznik motywu, profil z motywu.
17. Testy (niżej); `npx tsc --noEmit`, `npm run build`.
18. `docs/architecture.md`: nowe pliki, decyzja „ADR 0005”. `README.md`: krótko o motywach i że ikony są rysowane w kodzie.
19. Ręcznie (`?mock=1`):
    - każdy motyw na biegu w mieście i poza miastem;
    - eksport PNG i SVG w Chrome, Firefox i Safari/iOS (filtry obecne w PNG?);
    - czas eksportu i rozmiar plików;
    - `minimal` porównany wizualnie z poprzednim commitem.

## Testy obowiązkowe (Vitest, bez DOM i bez sieci)
- `random.test.ts`:
  - to samo ziarno daje tę samą sekwencję, inne ziarno inną;
  - wartości w [0, 1);
  - `hashSeed` stabilny (stała wartość dla znanego wejścia).
- `vectorMap.test.ts` (istniejące bez zmian poza `loadMapLayers(...).layers`):
  - `buildMapObjects`: kwadratowy budynek -> środek i pole;
  - przesunięcie i skala kafelka stosowane do pierścieni zieleni i wody;
  - pole wielokąta z otworem = zewnętrzny minus otwór;
  - budynek poniżej `minBuildingArea` pominięty;
  - `THUMB` -> puste obiekty;
  - profil `PIXEL`: każda liczba w `d` wszystkich warstw jest wielokrotnością 12 (`Number.isInteger(v / 12)`).
- `themes/geometry.test.ts`:
  - `pointInPolygon` (wewnątrz, na zewnątrz, w otworze);
  - `placeIcons`:
    - ten sam seed daje identyczny wynik, inny seed inne drzewa;
    - wszystkie ikony w płótnie;
    - żadna nie przecina `exclude` ani `slotZones(defaultLayout)`;
    - żadna w buforze trasy;
    - drzewa leżą w `green`;
    - zamki to największe budynki i zachowują odstęp;
    - smok trafia na dużą wodę, gdy jest, i nie ma go, gdy brak miejsca;
    - z `grid: 12` wszystkie `x`, `y` i `size` są wielokrotnościami 12;
  - `staircase`: tylko odcinki H/V, punkty na siatce, początek i koniec zgodne z przyciągniętą trasą.
