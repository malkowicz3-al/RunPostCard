# 0013. Tło „World” na prawdziwej mapie (zastępuje 0012)

## Kontekst
Decyzja właściciela (20 XI 2026): „Jest prawdziwa mapa: mamy jej budynki, ulice, lasy, parki. Nowy świat ma ten sam szkielet co stary, tylko inny wygląd.” Generator miasta z ADR 0012 odpada. World korzysta z tych samych kafelków OpenFreeMap co tło Map i zmienia tylko ich wygląd: neon brył, szyldy, ulica trasy z krawężnikami, mgła i pojazdy.

Z ADR 0012 nadal obowiązują:
- `GENRES` poza `THEMES` (motyw jako obiekt `MapTheme`, prefiks id `world-<gatunek>-`);
- `Look = 'world'` tylko przy trasie;
- ziarno `hashSeed(activity.id)` i przycisk „New world” z `Math.random` (stan tylko w pamięci);
- `Props.tsx` i miejsce pojazdów w `Postcard`.

Reszta 0012 jest nieaktualna.

## Decyzja

### 1. Przepływ danych
- World korzysta z tego samego toru kafelków co Map:
  - `useMapLayers(..., isMap || isWorld)` daje mapę bazową,
  - `useRegionLayers` daje fragment `refined` (zoom, 3D poza płótnem),
  - `MapBackdrop` dostaje obszar tła,
  - profil `POSTCARD_DETAILED` z bryłami i istniejące limity (5000 brył w bazie, 3000 w tle).

  `region` w `PostcardScreen` liczy się dla `isMap || isWorld`. Teren (DEM) zostaje tylko dla Map.
- Nowy plik `src/world/decorate.ts` zawiera dwie czyste funkcje, bez DOM, sieci, `Math.random` i czasu:
  ```ts
  type Prop = { kind: 'car' | 'ship'; x: number; y: number; angle: number }; // px płótna, stopnie
  function decorateWorld(layers: MapLayers, points: Pt[], seed: number, genre: GenreId): MapLayers;
  function worldProps(layers: MapLayers, points: Pt[], seed: number, genre: GenreId): Prop[];
  ```
  To dwie funkcje, a nie jedna zwracająca `{ layers, props }`. Pojazdy liczymy tylko dla mapy bazowej, a warstwy dekorujemy dla bazy, `refined` i tła.
- `decorateWorld` robi trzy rzeczy:
  1. **Ulica trasy:** `major` zastępuje ścieżka z `points` (`fit.points`, `M…L…`). Prawdziwe drogi `major` są doklejane do `mid`. `scifi.tsx` dalej rysuje krawężniki i asfalt na `layers.major`.
  2. **Korytarz:** usuwa z `buildings` bryły, których wierzchołki albo punkty krawędzi (próbki co najwyżej co 17 px) leżą bliżej trasy niż połowa ulicy (17 px). To utrzymuje regułę „żaden budynek nie wchodzi na ulicę trasy”. Indeks kubełkowy `routeIndex` przechodzi tu z `generate.ts`.
  3. **Neon:** dla każdej bryły `accent = accents[h1 % n]`, a `sign` to `h2 < 0.3` i `h ≥ ok. 25 m` (prawdziwe budynki są niższe niż generowane). Skrót liczymy jako `hashSeed(seed, genre, round(cx / 4), round(cy / 4))` od środka pierścienia, a nie od indeksu. Dzięki temu baza (precyzja 1), `refined` (0,5 / 0,25) i tło (rzadsze) dają ten sam kolor dla tego samego budynku.
- Geometria nie zależy od `seed`. „New world” losuje tylko kolory, szyldy i pojazdy.
- **Memo.** Wszystkie miejsca liczą w `useMemo` od obiektu warstw, więc klatki animacji i ruch kamery nie liczą niczego od nowa:
  - `PostcardScreen` liczy `decorateWorld` dla `map.layers` i dla `zoomed.refined.layers` oraz `worldProps` dla `map.layers`;
  - `MapBackdrop` liczy `decorateWorld` dla swojego `refined`.

### 2. Rysowanie fragmentu `refined`
- Dziś `refinedMap` w `Postcard` i tło w `MapBackdrop` rysują `MapBackground` ze stylem. Fragment World straciłby wtedy neonowe obrysy i krawężniki.
- `MapTheme` dostaje opcjonalne `floor?: (layers: MapLayers, rect: Rect) => ReactNode`, czyli tę samą scenę co `render().scene`, ale bez `<defs>` (bez zdublowanych id) i z tłem w `rect`. `scifi` je ma, pozostałe motywy nie. `Postcard.refinedMap` używa `themeDef.floor ?? MapBackground`.
- `MapBackdrop` zostaje przy `MapBackground` bez filtrów, tak jak dla Map. Tło ekranu jest przyciemnione o 50%, więc dostaje dekorowane warstwy bez pojazdów i bez poświaty. W 3D rysuje bryły jak przy Map (`flatWorld` znika), z `accent` z dekoracji.

### 3. Pojazdy na prawdziwych ulicach
- Ulice biorą się ze stringów `minor` i `mid` mapy bazowej. Format z `buildMapLayers` to sklejone podścieżki `M x yLx yL…`, liczby mogą być ujemne i ułamkowe, bez `Z` dla linii. Wystarczy prosty parser: `split('M')`, potem `split('L')`, potem dwie liczby. Nie potrzeba biblioteki ani DOM.
- **Kandydaci:** odcinki o długości ≥ 20 px. Auto stoi w `t` ze skrótu `hashSeed(seed, genre, round(mx), round(my))` od środka odcinka, a jego kąt to kąt odcinka; kandydatem jest tylko wtedy, gdy samo auto (nie środek odcinka) leży poza korytarzem trasy (ten sam `routeIndex`, korytarz 34 px), bo długa prosta ulica może przecinać trasę. Kolejność wyznacza ten sam skrót. Bierzemy pierwsze `GENRES[g].props.cars` (48).
- **Statki:** `props.ships` (6) punktów z `mulberry32(hashSeed(seed, genre, 'ship'))` w płótnie z marginesem 15%, z losowym kątem.
- Pojazdy są tylko w obszarze mapy bazowej (płótno). Po oddaleniu fragment `refined` poza płótnem jest bez pojazdów, co akceptujemy.

### 4. Podpis i sieć
- Dane World to OSM/OpenMapTiles, więc `MAP_ATTRIBUTION` musi być widoczny (wymóg licencji). Warunek w `Postcard` zmienia się z `typeof theme === 'string'` na „jest mapa” (`out`). Test z 0012 („World bez podpisu”) odwracamy.
- World pobiera kafelki tak jak Map: tylko po zalogowaniu, z ekranu pocztówki. Reguła „bez sieci przed logowaniem” dalej obowiązuje.

### 5. Błędy i brak trasy
- World jest dostępny tylko przy trasie, bez zmian.
- `mapMissing` i `mapLoading` obejmują World. `map.failed` wraca do gradientu i zdejmuje font motywu, tak jak przy Map. Komunikat ładowania to „Loading map…”.

### 6. 3D
Bryły w 3D to prawdziwe wysokości z `render_height` i istniejące przewyższenie, rysowane przez `Buildings3D` w wariancie `tower` z `accent` i `sign` z dekoracji. World nie ma terenu.

### 7. Do usunięcia
- Pliki:
  - `src/world/generate.ts` i `generate.test.ts`;
  - `src/ui/useWorld.ts`.
- W `PostcardScreen`: `worldRect`, `worldArea`, `worldLoading` i `worldMissing` (zastępuje je `mapMissing`).
- W `MapBackdrop`: prop `world.points`. Zostaje tylko `seed` i `genre` do dekoracji.
- Nakładka „Building world…” i style `.world-building` i `.world-spinner`.
- Pola `Genre.block` i `Genre.heights`.
- `Prop` przenosimy do `decorate.ts`.
- Zostają `src/world/grid.ts` i `rng.ts` (używają ich `demoMap.ts` i `demoRuns.ts`).
- Testy World w `Postcard.test.tsx` biorą ręcznie zbudowane `MapLayers` (siatka brył i ulic) przepuszczone przez `decorateWorld`.

## Konsekwencje
- **Wydajność:** rozmiar SVG i szybkość MP4 są takie jak dla motywów z bryłami `tower` (Cyber HUD, Synthwave; w 3D ok. 1,5× Dark w tym samym mieście), a nie ok. 300 KB jak w 0012. Obowiązują istniejące limity brył. Neonowe obrysy to jedna ścieżka na kolor, więc liczba elementów nie rośnie z liczbą budynków.
- **Bez podwójnych budynków:** płaskie obrysy rysujemy z `buildings` zamiast warstwy `building` (`scifi.tsx` już tak robi). W gęstym centrum poza limitem 5000 najmniejsze budynki więc znikają w World, choć są w Map.
- **Budynki przecięte przez kafelek albo granicę `refined`** mogą dostać dwa kolory (dwa środki). Akceptujemy to.
- **Korytarz** usuwa prawdziwe budynki, przez które przechodzi GPS (np. hala, podwórko). To świadome odstępstwo od szkieletu.
- Nowy gatunek to nadal wpis w `GENRES` i plik motywu z opcjonalnym `floor`.
- Zero nowych zależności.
- **Odrzucone:**
  - jedna funkcja `{ layers, props }` liczona trzy razy;
  - akcenty po indeksie bryły, bo indeks jest inny w bazie, `refined` i tle;
  - pojazdy z warstwy `path`, bo to ścieżki piesze.

## Gatunki Fantasy i Post-apo
- `Genre` dostał pola `signs` (szyldy tylko w Sci-fi), `keep` (odsetek zostawionych brył), `ruin` (odsetek brył z obciętą wysokością, co najmniej `min + 3` m) i `props.look` (kolory aut i statków, smuga, poświata).
- Gęstość i ruiny losujemy z osobnego skrótu środka bryły na grubszej siatce 16 px (kolor i szyld zostają na siatce 4 px), więc ten sam budynek w bazie, `refined` i tle wygląda tak samo z dokładnością do drobnych różnic wierzchołków. Duże bryły (od 18 m albo dłuższy bok od 60 px) zostają zawsze. Strumień koloru i szyldu jest nietknięty, więc Sci-fi się nie zmienia.
- `Buildings3D`: `accent` bryły jest kolorem dachu we wszystkich wariantach poza `tower` (tam to nadal neon okien i krawędzi). Motywy bez `accent` bez zmian.
- Fantasy: bryły `castle`, bez pojazdów. Post-apo: bryły `voxel`, wraki aut bez smugi i poświaty.
- Bez animacji: ruch pojazdów był zrobiony i usunięty, bo za bardzo spadała liczba klatek.
