# 0012. Tło „World”: miasto generowane pod prawdziwą trasą

## Kontekst
Właściciel chce zmyślonego świata pod swoją trasą zamiast prawdziwej mapy. Ma działać w 2D i 3D, a w 3D ze spinnerem na czas budowy. Na start jest tylko gatunek Sci-fi, później kolejne (fantasy, dziki zachód). Ten sam bieg ma dawać ten sam świat, a przycisk „New world” losuje inny wariant. Wcześniejsze motywy 8-bit i fantasy (ADR 0005) zostały usunięte jako „za dużo”, więc trasa zostaje głównym elementem, a pojazdów jest mało i są małe.

Co już jest w kodzie:
- `MapLayers` (`src/lib/vectorMap.ts`: string `d` na `MapKey` + `buildings[]`) obsługują `MapBackground`, motywy, `Buildings3D`, `MapBackdrop` i eksport.
- `src/ui/demoMap.ts` buduje zmyślone miasto jako `MapLayers` (ekran logowania).
- Eksport MP4 serializuje SVG pocztówki w każdej klatce.

Poza zakresem: Together, miniatury listy, gatunki inne niż Sci-fi.

## Decyzja

### 1. Moduł `src/world/`
Generator jest kolejnym źródłem `MapLayers`, tak jak kafelki. Zależności idą tylko w jedną stronę: `world` → `lib` i `postcard/themes` (pomocnicze `Glow`, `texture`). Nigdy `world` → `ui`.

| Plik | Zawartość |
|---|---|
| `rng.ts` | `mulberry32(seed)`, `hashSeed(...parts)` (FNV-1a po `parts.join(':')`). Prywatny `prng` z `demoRuns.ts` przechodzi tutaj i jest stamtąd importowany. |
| `grid.ts` | `warp`, `densify` przeniesione z `demoMap.ts`, który od teraz importuje je stąd. |
| `generate.ts` | `generateWorld` (czysta funkcja, bez DOM i bez sieci). |
| `genres.ts` | `GENRES`, `GenreId`, `Genre`. |
| `scifi.tsx` | Motyw Sci-fi (`MapTheme`). |
| `Props.tsx` | Rysowanie pojazdów. |

```ts
type Prop = { kind: 'car' | 'ship'; x: number; y: number; angle: number }; // px płótna, stopnie
type World = { layers: MapLayers; props: Prop[] };
type GenreId = 'scifi';
type Genre = {
  label: string;
  theme: MapTheme;                    // ten sam typ co w THEMES, ale poza rejestrem
  block: number;                      // bok kwartału w px płótna
  heights: [number, number];          // m, wysokości brył
  props: { cars: number; ships: number };
};
function generateWorld(points: [number, number][], rect: Rect, seed: number, genre: GenreId): World;
```

- Bez limitu liczby brył: stała gęstość (ok. 1000 w prostokącie pocztówki) zamiast obcinania, które zależałoby od `rect` i dawało szew między pocztówką a tłem. Limit pojazdów działa tylko jako zabezpieczenie, w stałej kolejności skrótu pozycji. Tło ekranu w 3D rysuje świat jako płaską podłogę, bez brył.
- `points` to `fit.points` trasy, czyli ten sam układ płótna co mapa. Trasa staje się drogą `major`, wokół niej jest korytarz bez budynków.
- `rect` to obszar do wypełnienia, który podaje wołający:
  - **Pocztówka:** ten sam prostokąt, który dziś wyznacza fragment `refined`, czyli odwrotność ustalonej (`settled`) kamery, a w 3D także macierzy izometrii. Do tego płótno i margines 15%.
  - **Tło ekranu:** prostokąt, który `MapBackdrop` dziś liczy do doczytania kafelków. `useRegionLayers` nie działa dla World.
- **Spójność bez wspólnego stanu:** świat jest określony na globalnej siatce kwartałów (komórka `i, j`). Każda komórka ma własny strumień losowości `mulberry32(hashSeed(seed, genre, i, j, rodzaj))`, a `warp` jest funkcją położenia. Dwa wywołania z różnymi `rect` dają więc identyczne miasto w części wspólnej. Pocztówka i tło stykają się bez szwu, a po przesunięciu kamery doliczamy świat, a nie losujemy go od nowa.

### 2. Wygląd gatunku a `MapTheme`
- `GENRES[id].theme` jest pełnym `MapTheme`, ale nie trafia do `THEMES` ani `ThemeId`. Testy kontrastu i `url(#id)` dla motywów, listy motywów, Together i ekran logowania zostają nietknięte.
- `Postcard` i `MapBackdrop` przyjmują `theme: ThemeId | MapTheme`, a obiekt rozwiązuje jedna linia `typeof t === 'string' ? THEMES[t] : t`. Reszta kodu motywów się nie zmienia.
- Id w `<defs>` motywu dostają prefiks `world-scifi-`, żeby nie kolidowały z innymi.

### 3. Przepływ danych i propsy
- `Look` dostaje `'world'`. Opcja jest widoczna tylko, gdy bieg ma trasę.
- `PostcardScreen` trzyma dwa stany:
  - `worldSeed`, z początkiem `hashSeed(activity.id)`. „New world” wylosowuje nowe ziarno, które żyje tylko w pamięci (bez zapisu).
  - `worldGenre`, domyślnie `'scifi'`.
- `Postcard` dostaje `background="map"`, `map={world.layers}`, `theme={GENRES[g].theme}` i jeden nowy prop `props?: Prop[]`. Pojazdy rysuje w grupie kamery nad mapą i bryłami, a pod trasą.
- **Podpis OSM/OpenMapTiles:** pokazujemy go tylko, gdy `theme` jest `ThemeId`. Prawdziwe kafelki zawsze idą z motywem z rejestru, a World zawsze z obiektem. World nie ma terenu (DEM) ani znaku terenu.
- **Bez sieci:** przy World nie ma `useMapLayers`, `useRegionLayers` ani terenu.
- `MapBackdrop` dostaje warstwy z `generateWorld` dla swojego prostokąta, bez pojazdów (są przyciemnione i małe, więc nie warto).

### 4. Wydajność (budżet)
- **Generowanie:** do 30 ms na desktopie dla prostokąta pocztówki i do 60 ms dla tła ekranu. Test jednostkowy mierzy przypadek pocztówki z zapasem ×3, więc łapie tylko rząd wielkości.
- **Limity w pocztówce:**
  - ok. 1000 brył ze stałej gęstości, bez twardego limitu (budżet 1500; prawdziwa mapa ma 5000/3000);
  - najwyżej 48 aut i 6 statków;
  - pojazd to najwyżej 3 elementy SVG, a poświata to jeden wspólny filtr na grupie pojazdów, nie filtr na każdy z nich.
- **Rozmiar SVG z World** to najwyżej ok. 300 KB, czyli wyraźnie mniej niż gęste miasto z OSM (ADR 0004: 1–3 MB). Dzięki temu MP4 nie powinno być wolniejsze niż z prawdziwą mapą.
- **Animacja:** pojazdy stoją. Animują się tylko trasa, liczby i wykresy (decyzja właściciela dla trybu Animated). Warstwy i pojazdy są w `useMemo`, tak jak mapa.

### 5. Determinizm
- Wynik zależy tylko od `points`, `rect`, `seed` i `genre`. Generator nie używa `Math.random` ani czasu i ma stałą kolejność iteracji po komórkach. Współrzędne są zaokrąglone do 1 jednostki, jak `precision` w `POSTCARD`.
- `Math.random` jest dozwolone tylko w przycisku „New world”, poza generatorem.
- Zmiana kodu generatora może zmienić świat dla tego samego ziarna. To akceptujemy, bo stan nie jest zapisywany.

### 6. 3D i spinner
- Jeden hook `useWorld(points, rect, seed, genre)` w `src/ui/` liczy świat w `setTimeout(0)` z anulowaniem przy zmianie argumentów. Do czasu wyniku zwraca poprzedni świat albo `null`.
- Przy `null` w 3D ramka pokazuje nakładkę „Building world…” (styl `.world-building`). W 2D nakładki nie ma, bo czas jest poniżej klatki.
- Pobieranie czeka na świat dla bieżącego `rect`, tak jak dziś czeka na teren i fragment `refined`.
- Bryły rysuje istniejący `Buildings3D` z `buildings3d: 'tower'` motywu. W 3D pojazdy idą przez `iso.matrix`, a statki są podniesione o stałą wysokość.

## Konsekwencje
- Nowy gatunek to wpis w `GENRES` i plik motywu w `src/world/`, bez zmian w `Postcard` i eksporcie.
- `Postcard`/`MapBackdrop` przyjmują obiekt motywu. To jedyna zmiana interfejsu poza propem `props` i opcją `'world'` w `Look`.
- Reguła podpisu („tylko `ThemeId`”) jest niejawna. Pilnuje jej test: World w 2D i 3D nie zawiera `MAP_ATTRIBUTION`, a prawdziwa mapa zawiera.
- Świat nie odpowiada terenowi biegu: zbocza i woda są zmyślone, prawdziwe są tylko trasa i jej wysokości ze strumieni.
- Zero nowych zależności i zero plików graficznych.
- Odrzucone:
  - jeden duży świat generowany raz i wycinany: eksport serializowałby obszar poza kadrem;
  - World jako `ThemeId` w `THEMES`: zmieniłby listy i testy motywów;
  - Web Worker: budżet tego nie wymaga, a dojdzie, gdy pomiar na telefonie przekroczy 100 ms.
