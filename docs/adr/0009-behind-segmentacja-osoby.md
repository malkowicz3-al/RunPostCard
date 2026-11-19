# 0009. „Behind”: wycięta osoba ze zdjęcia nad trasą i dużymi liczbami (MediaPipe, lokalnie)

## Kontekst
Etap D z CLAUDE.md. Na tle ze zdjęcia biegacz ma stać „przed” elementami pocztówki, jak na okładce magazynu. Decyzje właściciela (ostateczne):
1. Trasa „obręczą”: górna część za osobą, dolna przed nią. Automatycznie, bez ustawień.
2. Za osobą: trasa (górna część) i duże liczby statystyk. Na wierzchu zawsze: etykiety, znak Stravy, podpis (czytelny).
3. Segmentacja: `@mediapipe/tasks-vision` (Apache 2.0) z npm, wasm serwowany lokalnie przez Vite, plik modelu w repo w `public/`. Bez CDN i bez sieci w czasie działania; zdjęcie i model nie opuszczają przeglądarki.

Ograniczenia: jeden samowystarczalny SVG 1080x1920 (ADR 0002): tylko lokalne `url(#…)`, unikalne id, obrazy jako data URL. `exportPng` rasteryzuje SVG przez `<img>` + canvas, więc wszystko musi działać w SVG ładowanym jako obraz (bez zewnętrznych zasobów). Zdjęcie jest już przycięte do 1080x1920 JPEG przez `loadPhoto` (bez EXIF). Przy tle „photo” nie ma mapy motywu (`out` = null), więc trasa jest biała, bez filtrów.

## Decyzja

### 1. Model: `selfie_multiclass_256x256` (float32)
- `selfie_segmenter` (256x256, ~250 KB): uczony na portretach z bliska; dla całej sylwetki biegacza w kadrze zawodzi (ucięte nogi, dziury). Odrzucony.
- `deeplab_v3` (257x257, ~2,7 MB, klasa „person”): ogólny, krawędzie grube, słabszy przy włosach i luźnych ubraniach. Zapasowy (zmiana = jedna stała ścieżki i indeks klasy).
- **Wybór: `selfie_multiclass_256x256`** (~16,4 MB): klasy włosy, skóra, ubranie, akcesoria, tło; osoba = `1 − pewność(tło)`, więc ubranie i akcesoria (czapka, plecak biegowy) wchodzą do sylwetki. Koszt: ~16 MB w repo (poniżej limitów GitHuba, bez LFS). Plik: `public/models/selfie_multiclass_256x256.tflite`, pobrany raz z `storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/`; licencja Apache 2.0 (karta modelu) opisana w README i `public/models/LICENSE`.
- `ImageSegmenter`, `runningMode: 'IMAGE'`, `outputConfidenceMasks: true`, delegat `CPU` (jednorazowe wywołanie, bez zależności od WebGL; GPU nie jest potrzebne dla 2 obrazów 256 px).

### 2. Maska: dwa przebiegi, wygładzenie przez skalowanie
- Przebieg 1 na całym zdjęciu 1080x1920: znajduje osobę i jej prostokąt (piksele z pewnością > 0,5).
- Brak osoby (mniej niż 0,5% pola) → `null`, nic się nie zmienia (bez komunikatu).
- Przebieg 2 na **kwadratowym wycinku** wokół prostokąta osoby (+20% marginesu, przycięty do płótna): biegacz w całej sylwetce zajmuje zwykle 30–60% wysokości zdjęcia, więc w przebiegu 1 dostaje tylko ~100 px maski; wycinek daje 256 px na samą osobę i kwadrat bez zniekształcenia proporcji. Tylko maska z przebiegu 2 trafia do wycinanki.
- Krawędź: maska 256 px skalowana dwuliniowo do rozmiaru wycinka w px płótna, potem `alpha = smoothstep(0,35, 0,65, pewność)`. Daje miękkie przejście ~3–5 px bez filtra rozmycia (`ctx.filter` nie jest pewny w Safari). Bez dalszego „matowania” włosów.

### 3. Warstwa osoby: wycinanka PNG z alfą (nie SVG `<mask>`)
- Wynik: `{ href: string; rect: Rect }`: PNG data URL RGBA = piksele zdjęcia × alfa, **przycięty do prostokąta wycinka** (mniejszy plik; zwykle 0,5–2 MB), rysowany jako jeden `<image x y width height>` na tych samych współrzędnych co zdjęcie.
- Odrzucone: SVG `<mask>` z obrazem maski nad drugą kopią zdjęcia. Działa w rasteryzacji, ale `<mask>` używa luminancji (trzeba osobnego obrazu w skali szarości), dochodzi id i drugie odwołanie do zdjęcia; wycinanka to jeden element bez nowych mechanizmów SVG.
- **Dim:** suwak przyciemnia zdjęcie prostokątem; osoba nad trasą musi być przyciemniona tak samo, inaczej „świeci”. Wycinanka dostaje filtr `<filter id="person-dim" color-interpolation-filters="sRGB">` z `feComponentTransfer` (`feFuncR/G/B type="linear" slope={1 − dim}`, alfa bez zmian): ten sam wynik co czarny prostokąt z `opacity = dim`, bez ponownego liczenia wycinanki przy ruchu suwaka. Filtry już działają w eksporcie (motywy).
- Eksport: wycinanka jest data URL w SVG, więc `exportPng.ts` i `exportSvg` bez zmian. Pobieranie zablokowane w trakcie segmentacji (jak teren i font).

### 4. Kolejność warstw w `Postcard`
Gdy `background === 'photo'` i jest `person`:
1. `PhotoBackground` (zdjęcie + Dim).
2. **Za osobą:** trasa — część górna; wartości `SlotNumber` (same liczby).
3. **Osoba:** `<image>` wycinanki z filtrem `person-dim`.
4. **Przed osobą:** trasa — część dolna; wykresy slotów (całe, bo zawierają drobny tekst i osie); etykiety `SlotNumber`; `StravaMark`; podpis (jeśli jest).

Bez `person` kolejność jak dziś (jedno rysowanie, bez klonów).

**Podział trasy (obręcz):** ta sama trasa rysowana dwa razy, w dwóch grupach z `clipPath` w `userSpaceOnUse` (domyślne jednostki) nałożonym na grupę owijającą trasę (wewnątrz transformacji kamery, więc w układzie trasy):
- `route-behind`: `<rect x="-1e5" y="-1e5" width="2e5" height={1e5 + mid}>` (wszystko nad linią podziału),
- `route-front`: `<rect x="-1e5" y={mid} width="2e5" height="1e5">`.
`mid` to środek pionowy obrysu trasy: płasko z `fitRoute(...).bounds` (`geoPath.bounds`), w 3D z min/max `y` punktów `iso.points` (bez kurtyny). Kamera (zoom, przesunięcie) działa bez przeliczania, bo prostokąty są pod jej transformacją. Zmiana wobec pierwszej wersji (`objectBoundingBox`): bez problemu zerowej wysokości bboxu przy trasie poziomej i bez przesunięcia podziału przez kurtynę 3D. Ten sam mechanizm owija `Route` (płasko) i `IsoRoute` (3D; druga kopia ma `gradientId="iso-curtain-grad-front"`, żeby id były unikalne). Obie połówki mają ten sam styl, więc szew jest niewidoczny. Bez podziału po punktach i bez progu z maski osoby.

**Podział slotów:** `SlotNumber` dostaje prop `part?: 'value' | 'label'` (brak = oba, jak dziś). `Postcard` przy `person` mapuje `layout` dwa razy: liczby (`part="value"`) za osobą, etykiety (`part="label"`) i wykresy przed nią. Wspólna funkcja renderująca slot w `Postcard`, żeby nie dublować kodu `fitted`/`chartFor`.

**Zmiana (Behind 2.0): reguła zasłonięcia 5–50%** (decyzja właściciela). Za obiekt idzie tylko to, co obiekt zasłania częściowo; zasłonięte w ponad połowie byłoby nieczytelne, a niezasłonięte nie daje efektu.
- Wycinanka niesie siatkę `grid` 108x192 (komórki 10x10 px płótna, 1 gdy alfa w środku komórki > 127; `gridFromCutout` w `cutout.ts`). `Postcard` sam liczy decyzje z siatki, bez stanu w ekranie.
- Liczba slotu idzie za obiekt, gdy pokrycie jej `slotBox` przez siatkę jest w przedziale 5–50% (`partlyCovered`); poza nim cały slot przed obiektem. Etykiety i wykresy zawsze przed.
- Trasa: punkty górnej części (`y < mid`, po kamerze `applyCamera`) — gdy 5–50% z nich leży w siatce, obręcz jak wyżej (`route-behind`/`route-front`); inaczej cała trasa jedną warstwą przed obiektem i bez defs podziału.

### 5. Wasm: importy `?url` z pakietu
- `import loader from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'` i `import binary from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'` (bez segmentu `wasm/`: `exports` pakietu mapuje je na `./wasm/…`), przekazane wprost jako `WasmFileset { wasmLoaderPath, wasmBinaryPath }` do `ImageSegmenter.createFromOptions` (bez `FilesetResolver` i bez CDN). Pakiet udostępnia te ścieżki w `exports`. Vite sam kopiuje pliki do `dist/assets` z hashem; w dev serwuje je z `node_modules`. Bez skryptu kopiującego i bez plików wasm w repo.
- Model: `'/models/selfie_multiclass_256x256.tflite'` z `public/` (z `import.meta.env.BASE_URL`).
- Wersja pakietu przypięta dokładnie (bez `^`): wasm i JS muszą pochodzić z tej samej wersji.

### 6. Moduły i przepływ
- `src/lib/segment.ts` (ładowany leniwie przez `import()`; jedyny import `@mediapipe/tasks-vision`): `segmentPerson(img: ImageBitmap | HTMLCanvasElement): Promise<Float32Array mask, w, h>`; segmenter tworzony raz i trzymany w module.
- `src/lib/cutout.ts` (czyste, bez DOM): `personBox(mask, w, h): Rect | null` (próg, min. pole) i `cutoutPixels(photo: Uint8ClampedArray, mask, …): { data, rect }` (smoothstep, przycięcie). Testy Vitest.
- `src/ui/usePersonCutout.ts`: `usePersonCutout(photoHref, enabled) -> { person: { href; rect } | null; loading }`; dekoduje zdjęcie do canvasa, dwa przebiegi, `toDataURL('image/png')`; anulowanie przy zmianie zdjęcia (wzorzec z `useTerrain`). Wynik w pamięci tylko dla bieżącego zdjęcia. Błąd (wasm, model, brak pamięci) → `person = null` po cichu (`console.warn`).
- Wątek główny, nie Web Worker: jedno wywołanie po wybraniu zdjęcia/włączeniu (~0,3–1 s z inicjalizacją wasm), bez ruchu w trakcie. Worker dopiero, jeśli UI wyraźnie przytnie na telefonie.
- `src/ui/PostcardScreen.tsx`: przełącznik **„Behind”** w sekcji zdjęcia (obok Dim), widoczny tylko przy wyglądzie Photo z wczytanym zdjęciem; domyślnie wyłączony (chunk ~kilkaset KB JS + ~10 MB wasm + 16 MB modelu ładuje się dopiero po włączeniu); w trakcie: stan „Finding runner…” i zablokowany Download; bez osoby przełącznik zostaje włączony, ale pocztówka wygląda jak bez niego.

### 7. „Auto + tap”: wskazanie obiektu kliknięciem
- Domyślnie jak wyżej: osoba automatycznie (`selfie_multiclass`). Przycisk **Pick object** uzbraja następny klik w zdjęcie; punkt (0..1) idzie do `InteractiveSegmenterLegacy` z modelem `magic_touch.tflite` (~6,2 MB, Apache 2.0, Google MediaPipe, `public/models/`), `segment(image, { keypoint })`, maska `confidenceMasks[0]`. **Auto** wraca do osoby.
- Ten sam przepływ dwóch przebiegów (przebieg 1 na 540x960, bo obiekt może być mały; przebieg 2 na kwadracie z punktem przeliczonym do jego układu), ta sama wycinanka i siatka.
- Model ładowany leniwie przy pierwszym kliknięciu, w tym samym module `segment.ts` z tą samą blokadą telemetrii. `InteractiveSegmenter` (nie-legacy, API pociągnięć) świadomie nieużyty.
- W trybie wskazywania ramka ma kursor celownika, klik nie przesuwa mapy ani nie otwiera slotu; Esc lub ponowny klik przycisku anuluje.

## Poza zakresem
- Ręczna korekta maski pędzlem/pociągnięciem (scribble), kilka obiektów naraz; w trybie Auto wszystkie osoby trafiają do wycinanki (pojedynczy punkt: decyzja 7).
- Ręczne ustawienie linii podziału trasy i progów zasłonięcia, inne elementy za osobą (wykresy, etykiety, znak Stravy).
- Matowanie włosów, cień osoby na trasie, wygładzanie krawędzi filtrem.
- Web Worker, delegat GPU, inne modele w UI.
- Proporcje 4:5 i 1:1 (dojdą razem z resztą etapu 3; wycinanka liczona na tym samym płótnie co zdjęcie).
- Zdjęcie ani maska nie są zapisywane (bez cache między sesjami).

## Konsekwencje
- MediaPipe wysyła metryki użycia (nie obrazy) `fetch`-em na `odml.pa.googleapis.com` i nie ma opcji, by to wyłączyć. `segment.ts` odrzuca żądania na ten host (owijka `fetch`), więc biblioteka sama wyłącza logowanie. To decyzja właściciela; przy aktualizacji pakietu trzeba sprawdzić, czy adres lub sposób wysyłki się nie zmienił.
- Jedna nowa zależność: `@mediapipe/tasks-vision` (Apache 2.0, Google), uzasadniona: brak sensownej segmentacji osoby bez modelu. Repo rośnie o ~16 MB (model), build o ~10 MB wasm; ładowane tylko po włączeniu „Behind”.
- Zero ruchu sieciowego poza własnym serwerem (dev/Vercel): zgodne z zasadą „zdjęcie nie opuszcza przeglądarki”.
- SVG/PNG z „Behind” rośnie o wycinankę PNG (0,5–2 MB w data URL); `exportPng` bez zmian.
- Jakość zależy od zdjęcia: tłum, osoba bardzo mała (< ~15% wysokości) lub silnie nieostra da słabą maskę; wtedy użytkownik wyłącza „Behind”.
- Linia podziału trasy to środek jej obrysu, nie sylwetka: przy trasie daleko od osoby efekt obręczy nie wystąpi (część trasy nad osobą i tak jest za nią tylko tam, gdzie się nakładają).
- Do sprawdzenia przy implementacji: rozmiar pliku modelu i wasm po instalacji, czas na telefonie (iOS Safari, pamięć wasm), czy filtr `person-dim` daje ten sam odcień co prostokąt Dim w Chrome/Safari/Firefox.
- Pick object (decyzja 7): repo +6,2 MB (`magic_touch.tflite`); po pierwszym kliknięciu druga instancja wasm w pamięci obok segmentera osoby. Do sprawdzenia na prawdziwym zdjęciu: czy `confidenceMasks[0]` to pewność „obiekt” (a nie tło) i jaki ma rozmiar.
