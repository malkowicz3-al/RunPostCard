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

## Gatunki: Sci-fi i Fantasy (Post-apo usunięte)
- Post-apo usunięte decyzją właściciela, razem z polami `Genre.keep` (gęstość) i `Genre.ruin` (ruiny) i ich strumieniem losowania w `decorateWorld`. Strumień koloru i szyldu jest nietknięty, więc Sci-fi się nie zmienia.
- `Genre` ma pola `signs` (szyldy tylko w Sci-fi), `props.look` (kolory aut i statków, smuga, poświata) i `flat` (tylko widok płaski).
- `Buildings3D`: `accent` bryły jest kolorem dachu we wszystkich wariantach poza `tower` (tam to nadal neon okien i krawędzi). Motywy bez `accent` bez zmian.
- Fantasy to ilustrowana mapa na pergaminie na tym samym szkielecie (decyzja właściciela):
  - zamiast obrysów brył domki (`src/world/icons.ts`, `houseIcons`; zamki z `landmarks`): komórka 40 px dostaje domek, gdy jej skrót przechodzi próg (ok. 230 na płótnie w gęstym mieście, limit 400 tylko jako bezpiecznik), a w komórce wygrywa bryła ze skrótem z grubej siatki 16 px; zamek to największa bryła od 1000 px² w komórce 400 px z wylosowanym progiem (ok. 3 na płótno). Wybór nie zależy od zestawu brył, więc baza, refined po zoomie i tło pokazują te same domki i zamki; dach w kolorze `accent`, więc „New world” zmienia tylko dachy;
  - lasy, pola i łąki to wzory przez `MapStyle.fills`; obrys wody i lasu przez nowe `MapStyle.outlines` z `paint-order: stroke`, bo kafelki tną poligony i zwykły obrys rysowałby szwy kafelków;
  - statki (do 3) tylko na dużej wodzie (od 25 000 px²), z dala od brzegu i trasy; zwykłe pojazdy wyłączone;
  - ramka, róża wiatrów i wąż morski w nakładce (przestrzeń płótna, więc bez dublowania w refined); róża (r 52) i wąż (skala 0,8) na wysokości y 350, pod statystykami górnych układów (test kolizji z `LAYOUTS`), róża w rogu z mniejszą liczbą punktów trasy;
  - trasa z jednym filtrem (drżenie i kontur tuszem); ulice bez filtrów (wydajność);
  - tylko widok płaski (`Genre.flat`): `PostcardScreen` ukrywa przełącznik 2D/3D i nie włącza 3D.
- Bez animacji: ruch pojazdów był zrobiony i usunięty, bo za bardzo spadała liczba klatek.

## Dopisek 21 XI 2026: Post-apo, Bright, kolory Sci-fi
- Post-apo wraca (decyzja właściciela) jako ilustrowana mapa jak Fantasy, na wspólnych ikonach (`src/world/icons.ts`, dawniej `fantasyIcons.ts`): ruiny, największa bryła w komórce 400 px dostaje grzyb atomowy, ramka w pasy ostrzegawcze; tylko płasko (`Genre.flat`).
- Bright: jasna, kolorowa mapa bez szyldów i pojazdów; 2D i 3D.
- Sci-fi ma 5 wariantów koloru (`Genre.variants`): paleta obrócona w odcieniu (`shiftHue`) raz przy tworzeniu motywu, nie filtrem SVG (bez kosztu przy rysowaniu); trasa z wariantu, z kontrastem do szczegółów mapy. Violet (obrót 0) to ten sam obiekt co dotąd, więc wynik bez zmian.
- `genreDef(id, variantId)` zwraca gatunek z wariantem (pamięć podręczna, stała tożsamość dla `useMemo`); `decorateWorld` i `worldProps` dostają wariant.
- `Genre.reseed`: przycisk „New world” tylko tam, gdzie losowanie coś zmienia (Sci-fi).

## Dopisek 21 XI 2026 (2): święta i Medieval
- Cztery style świąteczne (decyzja właściciela): Christmas, New Year's Eve, Easter, Valentine's. Wspólna fabryka `holidayTheme` w `src/world/holiday.tsx` na wzór Bright (najpierw wszystkie krawężniki ulic, potem wypełnienia, bez szarych pasów na skrzyżowaniach); każdy styl to plik z paletą, fontem, trasą z konturem i ozdobami. Ozdoby (światełka, choinki, jajka, serca, fajerwerki, płatki) są statyczne i deterministyczne, jedna ścieżka na kolor, rysowane z `layers.buildings` tylko w widoku płaskim; w 3D znikają, a `Genre.accents` daje dachy w kolorach święta. Bez szyldów, pojazdów i „New world”; 2D i 3D.
- Medieval (`src/world/medieval.tsx`): ilustrowana mapa późnego średniowiecza na wzór Fantasy: domki z dwuspadowym dachem (kolory z `accents`) i kościoły z wieżą zamiast brył, pola w bruzdy, gęste lasy, woda z falkami, ramka z chmur i mgły (pas do 24 px, z dala od podpisu OSM i znaku Stravy), tarcza i wstęga w górnych rogach. Tylko płasko (`Genre.flat`).
- Nazwy ogólne, bez filmów, gier i marek.

## Dopisek 21 XI 2026 (3): obiekty świąteczne w 3D i obwódka tekstu
- Style świąteczne na chwilę w Map i z powrotem w World (decyzja właściciela). `Genre.festive` (Christmas: prezent, choinka; Easter: jajko, królik); `decorateWorld` po dotychczasowych losowaniach wybiera ok. 1/6 mniejszych brył (bez hal powyżej 70 px) jako `Building.festive`; `Buildings3D` rysuje zamiast nich pudełko prezentu na prawdziwym obrysie albo pionowe billboardy (choinka, jajko, królik); dachy Christmas zostają białe, papier prezentów z `Genre.festiveColors` (losowany po rodzaju, jako `accent`); `holidayTheme` daje statystykom obwódkę (`halo`, filtr `Outline`); trasa Medieval granatowa z kremowym konturem.
