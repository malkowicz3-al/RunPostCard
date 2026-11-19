# RunPostcard

Otwarta aplikacja webowa, która z wybranego biegu ze Stravy generuje „pocztówkę z biegu”: nowoczesną grafikę (trasa + wybrane dane) do udostępnienia lub nałożenia na zdjęcie.
(Folder nazywał się `ShowRunPic`; właściciel zmienia go na `RunPostcard` ręcznie po sesji.)

## Status
Etap 1 w trakcie domykania (logowanie, lista kafelków z trasami, pocztówka 9:16, PNG i SVG, tło gradient/przezroczyste, tryb jasny/ciemny, tryby dev `?mock=1` i `?debug=1`). Zrobione też: font Barlow Condensed, oficjalne znaki Stravy, wektorowy zarys mapy (tło pocztówki i kafelki). Etap 1 zamknięty; etap 2 (motywy map) ma Dark/Light/Neon z wyborem koloru neonu, kafelki wyglądu i menu Download. Zrobiony etap A z planu „dane biegu” (ADR 0006): strumienie Stravy dla otwartego biegu i widok izometryczny 3D z przewyższeniami (markery Highlights usunięte decyzją właściciela, ADR 0007). Widok 3D ma mapę jako podłogę, ręczny zoom/przesuwanie i wypełnienie pod trasą. Zrobiony etap B: tło ze zdjęcia (lokalnie, zapis od nowa bez EXIF/GPS, suwak Dim) i wybór 6 fontów (Barlow, Bebas Neue, Archivo Black, Space Grotesk, Permanent Marker, Bungee; licencje w `public/fonts/licenses`). Fonty: lista z 20 krojami. Mapy: 33 motywy (w tym 10 w stylu gatunków gier) (klasyczne, stylizowane i 10 w klimacie popkultury pod ogólnymi nazwami, bez marek; każdy ustawia swój font, zmienialny), szczegóły mapy zawsze włączone (kolej, mosty, tereny; bez nazw ulic, decyzja właściciela), zoom i przesuwanie w 2D i 3D z ostrzejszą mapą po zatrzymaniu. Ekran (ADR 0007): mapa motywu na cały ekran pod panelem, przygaszona poza ramką pocztówki; panel w sekcjach z listami z podglądem; podpis mapy mały, pionowo przy prawej krawędzi (wymóg licencji OSM/OpenMapTiles, nie usuwamy). Początek etapu 4: 10 układów statystyk (`LAYOUTS` w `src/postcard/slots.ts`), 13 rodzajów danych i okno „Change” z podglądem; klik w statystykę na pocztówce otwiera je, wybór danej już obecnej zamienia sloty miejscami; nakładka do klikania jest w HTML poza SVG, więc nie trafia do eksportu. Formy: liczba i 12 wykresów ze strumieni (profil przewyższenia, tętno ze strefami, tempo na km, pierścień stref) w slotach z polem `box`; 5 układów z wykresem. Presety stylu z etapu 3 w praktyce dają motywy map (paleta + grubość linii + przypisany font); osobnych presetów nie robimy, chyba że właściciel zechce. Teren (ADR 0008, etap 1): przełącznik Terrain z AWS Terrain Tiles, widoczny tylko przy ≥ 300 m przewyższenia (wtedy domyślnie włączony; w mieście go nie ma, decyzja właściciela), płasko cieniowanie, w 3D jednobarwny relief zamiast podłogi i brył, trasa na wysokościach DEM. Budynki 3D (bryły z `render_height`) w widoku 3D bez terenu. Etap 2 terenu (mapa nadrukowana na relief, budynki na zboczach, zasłanianie trasy przez grzbiety, Web Worker) odłożony decyzją właściciela. Zrobiony etap D „behind” (ADR 0009): przełącznik Behind tylko przy tle Photo; osoba wycięta lokalnie (MediaPipe, model w `public/models`), trasa „obręczą” (górna część za osobą); za osobą zawsze tylko górna część trasy; wszystkie statystyki i znak Stravy na wierzchu (reguła 5–50% wycofana decyzją właściciela); „Pick object” wycina kliknięty obiekt (magic_touch), „Auto” wraca do osoby. Edycja zdjęcia w oknie (ikona przy Dim): przesuwanie, zoom, 8 presetów kolorów, wypalane w JPEG z oryginału; ziarno odrzucone decyzją właściciela. Styl linii trasy (lista „Line” w View): Theme, Rainbow, Pace, Heart rate, Elevation; trasa w ok. 150 odcinkach z kolorem wg ułamka długości, w 2D, 3D, Behind i tle ekranu. Animacja rysowania trasy (etap 2 planu animacji): pocztówka z propem `progress`, trasa rośnie z kropką biegacza, dystans i czas liczą się w górę; eksport MP4 (WebCodecs H.264 + Mediabunny, 1080x1920, 30 kl./s) i GIF (gifenc, 432x768, 25 kl./s, jedna paleta, klatki tylko ze zmianami), obie biblioteki ładowane leniwie; po pobraniu na telefonie przycisk Share (Web Share z plikiem). Dalej w planie: C preset „w ulicy” (4 rogi, perspektywa). Przycięcie trasy 200 m dotyczy tylko markerów; przycinanie samej trasy odłożone decyzją właściciela. Z etapu 3 zostały proporcje 4:5 i 1:1. Zrobiony POV (ADR 0010): trzeci widok obok Flat/3D, lot kamery za biegaczem w Three.js (leniwy chunk), podłoga z mapy motywu jako tekstura, bryły budynków, teren z DEM, eksport PNG (bieżąca klatka), MP4 i GIF; SVG w POV wyłączony. Zrobiony etap 4 planu animacji: lista stronicowana (po 50, „Load more” do 200 biegów), tryb „Select” i widok „Together” (układ Overlay ze startami w jednym punkcie albo Geographic we wspólnej projekcji z mapą, 2D i 3D do 20 biegów ze strumieniami w pamięci karty, eksport tylko MP4/GIF).
Na razie bez wdrożenia na Vercel: aplikacja działa tylko lokalnie (`npm run dev`).

## Model projektu
- Repozytorium otwarte na GitHubie, licencja MIT. Każdy uruchamia je u siebie (lokalnie, Vercel lub inny Node).
- Każdy rejestruje WŁASNĄ aplikację w Stravie (własny client ID i secret). Limit „1 sportowiec” Stravy więc nie przeszkadza.
- Hosting właściciela (Vercel) to tylko jego wybór, nie wymóg.
- Bez bazy danych. Sekrety tylko w `.env` (w `.gitignore`); w repo wyłącznie `.env.example` z pustymi polami.
- Język: README i interfejs po angielsku; ten plik po polsku. Polski interfejs ewentualnie później.

## Stos
- React + SVG (D3 do skal i kształtów), eksport SVG → PNG w przeglądarce. Biblioteka wykresów wybierana w etapie 3.
- Three.js: tylko widok POV, ładowany leniwie (ADR 0010).
- Mapa: własny minimalistyczny zarys (ulice, budynki, woda, zieleń) rysowany jako SVG z wektorowych kafelków OpenFreeMap (dane OSM, schemat OpenMapTiles, bez klucza); dekoder `@mapbox/vector-tile` + `pbf`, bez biblioteki map (ADR 0004). CARTO odrzucone (wymaga klucza). Podpis OpenMapTiles/OSM na pocztówce z mapą i w aplikacji. Overpass API odrzucone (niedostępne przy testach).
- Przyszłość (bez terminu): widok 3D/izometryczny trasy z wysokościami (góry, miasto), generowany tylko na pocztówce, nie w liście.
- Dane tylko ze Stravy (OAuth). Garmin: później, bez terminu (dostęp do API Garmina wymaga zatwierdzenia).

## Backend (jedyny)
Wymiana kodu OAuth na token i jego odświeżanie wymagają sekretu aplikacji, więc nie mogą działać w przeglądarce.
- Jeden wspólny moduł z logiką (kod + sekret → token; odświeżanie).
- Dwa cienkie wejścia do tego samego modułu: plik w `api/` (Vercel) i wtyczka Vite `configureServer` (uruchomienie lokalne).
- Oficjalnie wspierane: Vercel i lokalnie. Inne hostingi: tylko opis w README „bez gwarancji”.
- Nic nie zapisuje; nie ma bazy.

## Sesja i prywatność
- Token domyślnie w `sessionStorage` (znika po zamknięciu karty); opcja „Zostań połączony” (dłuższy zapis); „Wyloguj” kasuje dane i odwołuje dostęp w Stravie.
- Wgrane zdjęcie nie opuszcza przeglądarki.
- Początek i koniec trasy przycięte domyślnie (np. 200 m), z możliwością wyłączenia.

## Pocztówka (założenia produktowe)
- Przepływ: zalogowanie → lista ostatnich biegów → wybór → krótka animacja „generuję” → gotowa pocztówka w ładnym, nowoczesnym stylu → zmiany → zapis.
- Domyślne proporcje 9:16 (stories), potem 4:5 i 1:1; eksport PNG.
- Tło do wyboru: przezroczyste; gradient rysowany kodem z ziarnem w kolorach presetu (domyślne); własne zdjęcie (auto-dopasowanie + przyciemnienie dla czytelności).
- Domyślny układ: trasa jako główny element, duży dystans, pod nim czas, tempo, śr. tętno, data.
- Zapis: pobranie PNG; na telefonie systemowe „Udostępnij” (Web Share API). Bez publikacji na Instagramie/Stravie.
- „Slot”: każdy element (dystans, tempo, tętno…) ma konfigurowalne dane i formę graficzną. Architekturę slotów budujemy od początku, nawet gdy w etapie 1 jest tylko forma „liczba”.
- Preset stylu = font + kolor naklejki + grubość linii; 3–4 presety.
- Znak „Powered by Strava”: w aplikacji zawsze, na pocztówce w rogu (domyślnie włączony, wyłączalny). Wytyczne Stravy sprawdzić na początku etapu 1.

## Etapy
1. Logowanie Stravą, lista biegów, wybór, domyślna pocztówka (gradient, trasa, 4 statystyki, 9:16), pobranie PNG, znak Strava. Dodane przez właściciela: mapa jako tło pocztówki i w kafelkach.
2. Motywy map (dodane przez właściciela): ten sam prawdziwy zarys mapy w różnych stylach, zmienia się tylko stylistyka (kolory, linie, poświata), bez ikon. Są: Dark (domyślny), Light, Neon. 8-bit i fantasy (zamki, smok) zrobione i usunięte decyzją właściciela: „za dużo”. Kandydat na kolejny: Blueprint. Trasa dokładna, eksport jak teraz; miniatury listy minimalistyczne. Generowanie AI (model obrazu, własny płatny klucz, drugi backend): ewentualnie później jako opcja.
3. Presety stylu i fontów, tryby tła (przezroczyste/gradient/zdjęcie), proporcje 4:5 i 1:1, przycięcie trasy, udostępnianie na telefonie.
4. Sloty z konfigurowalnymi danymi i formami (np. tętno, tempo, przewyższenie, tempo na km; liczba, wykres liniowy, słupki, pierścień…). Najpierw agent badawczy proponuje formy wizualizacji, potem coder je implementuje.
5. Przesuwanie, skalowanie i transformacja elementów myszą i dotykiem.
6. Dalszy rozwój presetów i stylistyki.

## Do sprawdzenia (nie potwierdzone)
- Strumienie Stravy: czy strefy prywatności są z nich wycięte przy `activity:read`; zasady wyświetlania strumieni.
- Pełny tekst API Agreement/Policy Stravy: czy zezwala na publiczne repo z gotową integracją; zasada „dane tylko dla właściciela” (znana tylko ze wtórnych streszczeń); wytyczne „Powered by Strava”.
- Potwierdzone: wtyczka Vite `configureServer` działa; własna aplikacja Stravy działa dla jednego sportowca bez przeglądu; wylogowanie odwołuje dostęp. Po wylogowaniu Strava czasem zwraca 403 (limit sportowców) przy natychmiastowym ponownym logowaniu.

## Zasady
- Odpowiadaj po polsku.
- Najmniejsza działająca zmiana; bez zbędnych zależności.
- Subagenci wg globalnego `CLAUDE.md` (architect → planner → coder → test-runner → code-reviewer). Przed etapem 1 użyj architect do wyboru struktury projektu.
