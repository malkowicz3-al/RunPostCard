# RunPostcard

Otwarta aplikacja webowa, która z wybranego biegu ze Stravy generuje „pocztówkę z biegu”: nowoczesną grafikę (trasa + wybrane dane) do udostępnienia lub nałożenia na zdjęcie.
(Folder nazywał się `ShowRunPic`; właściciel zmienia go na `RunPostcard` ręcznie po sesji.)

## Status
Etap 1 w trakcie domykania (logowanie, lista kafelków z trasami, pocztówka 9:16, PNG i SVG, tło gradient/przezroczyste, tryb jasny/ciemny, tryby dev `?mock=1` i `?debug=1`). Zostało w etapie 1: mapa (tło pocztówki i kafelki), font Barlow Condensed, oficjalny znak Stravy.
Na razie bez wdrożenia na Vercel: aplikacja działa tylko lokalnie (`npm run dev`).

## Model projektu
- Repozytorium otwarte na GitHubie, licencja MIT. Każdy uruchamia je u siebie (lokalnie, Vercel lub inny Node).
- Każdy rejestruje WŁASNĄ aplikację w Stravie (własny client ID i secret). Limit „1 sportowiec” Stravy więc nie przeszkadza.
- Hosting właściciela (Vercel) to tylko jego wybór, nie wymóg.
- Bez bazy danych. Sekrety tylko w `.env` (w `.gitignore`); w repo wyłącznie `.env.example` z pustymi polami.
- Język: README i interfejs po angielsku; ten plik po polsku. Polski interfejs ewentualnie później.

## Stos
- React + SVG (D3 do skal i kształtów), eksport SVG → PNG w przeglądarce. Biblioteka wykresów wybierana w etapie 3.
- Three.js: odłożony; kandydat do przyszłego widoku 3D (niżej).
- Mapa: kafelki CARTO (styl minimalistyczny, dane OpenStreetMap), bez biblioteki map; kafelki osadzane w SVG jako data URL, żeby eksport PNG/SVG działał. Podpis „© OpenStreetMap contributors © CARTO” na pocztówce z mapą i w aplikacji.
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
2. Presety stylu i fontów, tryby tła (przezroczyste/gradient/zdjęcie), proporcje 4:5 i 1:1, przycięcie trasy, udostępnianie na telefonie.
3. Sloty z konfigurowalnymi danymi i formami (np. tętno, tempo, przewyższenie, tempo na km; liczba, wykres liniowy, słupki, pierścień…). Najpierw agent badawczy proponuje formy wizualizacji, potem coder je implementuje.
4. Przesuwanie, skalowanie i transformacja elementów myszą i dotykiem.
5. Dalszy rozwój presetów i stylistyki.

## Do sprawdzenia (nie potwierdzone)
- Pełny tekst API Agreement/Policy Stravy: czy zezwala na publiczne repo z gotową integracją; zasada „dane tylko dla właściciela” (znana tylko ze wtórnych streszczeń); wytyczne „Powered by Strava”.
- Potwierdzone: wtyczka Vite `configureServer` działa; własna aplikacja Stravy działa dla jednego sportowca bez przeglądu; wylogowanie odwołuje dostęp. Po wylogowaniu Strava czasem zwraca 403 (limit sportowców) przy natychmiastowym ponownym logowaniu.

## Zasady
- Odpowiadaj po polsku.
- Najmniejsza działająca zmiana; bez zbędnych zależności.
- Subagenci wg globalnego `CLAUDE.md` (architect → planner → coder → test-runner → code-reviewer). Przed etapem 1 użyj architect do wyboru struktury projektu.
