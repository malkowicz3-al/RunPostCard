# Architektura – etap 1

Zakres: logowanie Stravą, lista ostatnich biegów, wybór, domyślna pocztówka 9:16 (gradient z ziarnem, trasa, dystans + czas, tempo, śr. tętno, data), pobranie PNG, znak „Powered by Strava”.

## Struktura plików

```
.env.example              # VITE_STRAVA_CLIENT_ID=, STRAVA_CLIENT_SECRET= (puste)
index.html                # punkt wejścia Vite
package.json              # zależności: react, react-dom, d3-geo, @mapbox/vector-tile, pbf; dev: vite, @vitejs/plugin-react, typescript, vitest, @types/*
tsconfig.json             # jeden tsconfig dla src/, server/, api/ i vite.config.ts
vite.config.ts            # plugin React + mała wtyczka configureServer montująca POST /api/strava/token na server/stravaToken.ts
README.md                 # rejestracja własnej aplikacji Strava, .env, uruchomienie lokalne i na Vercel

server/
  stravaToken.ts          # JEDYNA logika backendu: {code} albo {refresh_token} + sekret -> POST strava.com/oauth/token; czysta funkcja (body, env) -> {status, json}
  stravaToken.test.ts     # walidacja wejścia i mapowanie odpowiedzi (fetch zamockowany)

api/strava/
  token.ts                # wejście Vercel: Web Request -> stravaToken -> Response (kilka linii)

src/
  main.tsx                # montuje <App/>
  App.tsx                 # prosta maszyna stanów bez routera: login -> lista -> "generuję" -> pocztówka
  styles.css              # style interfejsu aplikacji (nie pocztówki)

  strava/
    auth.ts               # URL autoryzacji + parametr state, obsługa ?code po powrocie, sessionStorage, odświeżanie przed wygaśnięciem, wylogowanie (deauthorize + czyszczenie)
    api.ts                # stravaGet (token, 401/429); GET /athlete/activities, filtr biegów (sport_type Run/TrailRun/VirtualRun), typ Activity; fetchStreams + normalizeStreams -> RunStreams (ADR 0006)
    api.test.ts           # normalizeStreams
  
  postcard/
    slots.ts              # model slotu {id, data, form}, rejestr danych (data -> etykieta + wartość z Activity), domyślny układ 9:16
    Postcard.tsx          # jeden <svg viewBox="0 0 1080 1920">: tło, trasa, sloty, znak Strava; ten sam SVG idzie do eksportu
    Background.tsx        # gradient + ziarno przez filtr feTurbulence (kod, bez obrazków)
    IsoRoute.tsx          # widok 3D: kurtyna, cień na podłożu, trasa kolorowana nachyleniem (płaskie odcinki w kolorze trasy motywu)
    RouteMarkers.tsx      # kropki i etykiety markerów (FASTEST, MAX HR, MIN HR, HIGHEST) w punktach trasy
    Route.tsx             # <path> trasy z gotowej ścieżki + styl z motywu (kolor, grubość, filtr); ROUTE_BOX = obszar trasy na płótnie
    MapBackground.tsx     # renderer warstw mapy: <rect> tła + jeden <path> na warstwę wg MapStyle (kolory, grubości, opcjonalny filtr; wektor inline, ADR 0004)
    mapStyle.ts           # typ MapStyle (kolory, grubości linii, filtry warstw)
    SlotNumber.tsx        # forma "liczba"; kolor tylko przez currentColor (motyw ustawia color na grupie slotów)
    StravaMark.tsx        # oficjalny znak „Powered by Strava” (white/black/orange) jako <image> z data URL (import ?raw, bez modyfikacji plików)
    themes/               # motywy mapy na pocztówce, tylko stylistyka (ADR 0005)
      index.ts            # typy ThemeOutput/MapTheme/ThemeOptions ({accent}), rejestr THEMES (dark, light, neon); style(opts) = paleta jako dane (miniatury)
      index.test.tsx      # kolejność rejestru; każde url(#id) wskazuje element z tego samego SVG (też neon w innym kolorze); neonStyle
      dark.tsx            # ciemny zarys (dotychczasowy wygląd)
      light.tsx           # jasny zarys, ciemna trasa i tekst, czarny znak Stravy
      neon.tsx            # neonStyle(accent): trasa i ulice z jednego koloru, woda stała; NEON_ACCENTS (gotowe kolory); poświaty feGaussianBlur + feMerge

  ui/
    LoginScreen.tsx       # przycisk „Connect with Strava” (oficjalny styl) + znak Strava
    ActivityList.tsx      # lista ostatnich biegów (nazwa, data, dystans) do wyboru
    PostcardScreen.tsx    # podgląd pocztówki, stan look (gradient / transparent / motyw mapy) i accent; telefon: kolumna, ≥900px: pocztówka + panel „Style”
    LookPicker.tsx        # kafelki wyglądu z podglądem trasy (aria-pressed) + kółka koloru neonu i własny kolor (<input type="color">)
    DownloadMenu.tsx      # przycisk „Download” z menu (role=menu): PNG image / SVG (vector); Escape, kliknięcie obok, fokus wraca
    RouteThumb.tsx        # miniatura trasy na zarysie mapy (profil THUMB); kolory z tokenów CSS --map-* (lista) albo z MapStyle motywu; style=null = sama trasa
    useMapLayers.ts       # hook: projekcja -> ścieżki mapy {layers, failed}, anulowanie przy odmontowaniu
    useRunStreams.ts      # hook: strumienie otwartego biegu (null = brak/ładowanie/błąd); ?mock=1 -> mockStreams

  assets/brand/strava/    # oficjalne zasoby Stravy (przycisk Connect, znaki Powered by), bez modyfikacji

  lib/
    polyline.ts           # dekoder Google encoded polyline (~20 linii; bez zależności)
    polyline.test.ts
    format.ts             # dystans km, czas h:mm:ss, tempo min/km, data
    format.test.ts
    color.ts              # hexToRgb, rgbToHex, mix (paleta neonu)
    color.test.ts
    exportPng.ts          # SVG -> XMLSerializer -> Blob URL -> Image -> canvas 1080x1920 -> toBlob -> pobranie
    fonts.ts              # FONTS (6 fontów: plik, rodzina, grubość, skala); wybrany TTF jako data URL wstrzykiwany do <style> w SVG (img nie pobiera zewnętrznych fontów)
    photo.ts              # loadPhoto: plik -> canvas 1080x1920 (cover, coverRect) -> JPEG data URL (bez EXIF)
    dataUrl.ts            # fetch -> data URL z cache w pamięci (font)
    runHighlights.ts      # highlights(streams) -> indeksy markerów; TRIM_M = 200 m bez markerów na początku i końcu
    runHighlights.test.ts
    isoRoute.ts           # izometria: Mercator, obrót 45°, Y × 0,5, podniesienie o wysokość (min. 15% pola), dopasowanie do ROUTE_BOX
    isoRoute.test.ts
    routePath.ts          # fitRoute: polyline -> d3-geo geoMercator().fitExtent -> {projection, d}; routePath = samo d
    mapTiles.ts           # czysta funkcja: projekcja trasy + tileUnits -> kafelki XYZ pokrywające płótno; tileUrlFrom (ADR 0004)
    mapTiles.test.ts
    vectorMap.ts          # OpenFreeMap: TileJSON, kolejka ≤4, cache kafelków, dekodowanie MVT, buildMapLayers (scalone budynki dzielone na osobne poligony), profile POSTCARD/THUMB
    vectorMap.test.ts

public/fonts/             # 6 fontów TTF (Barlow Condensed, Bebas Neue, Archivo Black, Space Grotesk, Permanent Marker, Bungee) + OFL.txt i licenses/

docs/
  architecture.md         # ten plik
  adr/                    # decyzje trudne do odwrócenia
```

## Przepływ danych

1. Logowanie: przeglądarka -> `https://www.strava.com/oauth/authorize?client_id=VITE_STRAVA_CLIENT_ID&redirect_uri=<origin>/&scope=activity:read&state=<losowy>` -> Strava wraca na `/?code=...&state=...`.
2. Wymiana kodu: przeglądarka -> `POST /api/strava/token {code}` -> (Vercel: `api/strava/token.ts` | lokalnie: wtyczka w `vite.config.ts`) -> `server/stravaToken.ts` (+ `STRAVA_CLIENT_SECRET`) -> `POST https://www.strava.com/oauth/token` -> `{access_token, refresh_token, expires_at, athlete}` -> `sessionStorage`.
3. Odświeżanie: gdy `expires_at` mija, przeglądarka -> `POST /api/strava/token {refresh_token}` -> ten sam moduł.
4. Dane: przeglądarka -> `GET https://www.strava.com/api/v3/athlete/activities?per_page=30` z `Authorization: Bearer` (bez backendu). Lista zawiera `map.summary_polyline`, `distance`, `moving_time`, `average_heartrate`, `start_date_local` – wystarcza na etap 1, bez pobierania streamów.
5. Strumienie (tylko otwarta pocztówka, ADR 0006): przeglądarka -> `GET /activities/{id}/streams?keys=latlng,altitude,heartrate,velocity_smooth,distance,time&key_by_type=true` -> `normalizeStreams` -> `RunStreams` w stanie `PostcardScreen` (bez cache). Z tego samego źródła: `highlights` (markery, indeksy w strumieniu) i `isoRoute` (widok 3D). Błąd = pocztówka bez markerów i bez 3D.
6. Render: Activity -> sloty (`slots.ts`) + trasa (`polyline.ts` -> `Route.tsx`) -> `<svg>` -> `exportPng.ts` -> plik PNG.
7. Wylogowanie: przeglądarka -> `POST https://www.strava.com/oauth/deauthorize` z tokenem -> czyszczenie `sessionStorage`.

## Kluczowe decyzje

- **Backend = jeden endpoint `POST /api/strava/token`** (kod albo refresh token w body): mniej plików i jedna ścieżka do zamontowania w Vite i Vercel (ADR 0001).
- **Wywołania API Stravy bezpośrednio z przeglądarki**: backend tylko tam, gdzie wymaga go sekret; nie przekazujemy danych biegów przez nasz serwer (ADR 0001).
- **Client ID jako `VITE_STRAVA_CLIENT_ID`**: jest publiczny; backend czyta tę samą zmienną (Vercel i `loadEnv(mode, cwd, '')` widzą wszystkie zmienne), więc jedna para zmiennych w `.env`.
- **Bez routera**: jedna strona, stan w `App.tsx`; callback OAuth rozpoznany po `?code` w URL, potem `history.replaceState` czyści adres.
- **Scope `activity:read`, nie `read_all`**: Strava wtedy wycina strefy prywatności z trasy, co chroni dom użytkownika na publikowanej grafice; kosztem: biegi „Only Me” niewidoczne.
- **Trasa z `summary_polyline`** z listy aktywności: zero dodatkowych zapytań; pełne streamy dopiero gdy potrzebne (przycięcie trasy, wykresy – etap 2/3).
- **D3 tylko `d3-geo`** (`fitExtent` + `geoPath`): jedna funkcja dopasowuje trasę do ramki; `d3-shape`/`d3-scale` dojdą w etapie 3 przy wykresach.
- **Jeden SVG jako źródło prawdy** dla podglądu i eksportu; wszystkie zasoby (font, znak Strava, ziarno) inline, żeby `<img>` z SVG renderował się identycznie (ADR 0002).
- **Model slotu od początku**: `Slot = {id, data: SlotData, form: SlotForm}`; rejestr danych i rejestr form; w etapie 1 `SlotForm = 'number'` (ADR 0002).
- **Testy: Vitest**: współdzieli konfigurację Vite, zero dodatkowej konfiguracji; testy tylko dla logiki (polyline, format, stravaToken).
- **Jednostki: tylko km** w etapie 1.
- **Mapa wektorowa z OpenFreeMap rysowana jako SVG** (bez klucza i bez biblioteki map): kafelki liczone z tej samej projekcji co trasa, dekodowane przez `@mapbox/vector-tile` + `pbf`, jedna ścieżka na warstwę; CARTO usunięte (ADR 0004, zastępuje 0003).
- **Strumienie tylko dla otwartej pocztówki** (limit zapytań Stravy); markery i 3D liczone czystymi funkcjami z jednego `RunStreams`. **W 3D mapa jest podłogą**: izometria jest afiniczna na płaskim płótnie, więc ta sama scena motywu leży pod trasą w `<g transform="matrix(...)">` (`iso.matrix`), z wygaszonymi brzegami i podpisem OSM (ADR 0006).
- **Motywy mapy tylko stylistyczne** (dark, light, neon): te same warstwy mapy, inne kolory, grubości i filtry SVG (lokalne `url(#…)`, więc eksport działa); bez ikon, bez plików graficznych i nowych zależności; miniatury listy bez zmian (ADR 0005). Neon liczony z jednego koloru `accent`.

## Zdjęcie i fonty

- **Zdjęcie jako tło**: `loadPhoto` przycina plik do 1080x1920 na canvasie i zwraca JPEG jako data URL; `PhotoBackground` rysuje go w SVG z czarnym prostokątem przyciemnienia. Plik nie opuszcza przeglądarki, a ponowne zakodowanie usuwa EXIF/GPS. W 3D bez podłogi mapy, trasa biała jak przy gradiencie.
- **Fonty**: `<svg>` pocztówki ma `fontFamily` i `fontWeight` wybranego fontu, teksty je dziedziczą; rozmiar slotów × `scale` fontu (dobrana z szerokości glifów). Do eksportu osadzany jest tylko wybrany font (data URL); pobieranie jest zablokowane, dopóki się nie wczyta. Podgląd w `FontPicker` używa zwykłych `@font-face` z `/fonts/`.

## Otwarte pytania

1. Czy endpoint `oauth/deauthorize` i `api/v3` Stravy pozwalają na CORS z przeglądarki? Jeśli deauthorize nie – dodać `{action: 'deauthorize'}` do tego samego endpointu.
2. Czy Vercel poprawnie bundluje import `../../server/stravaToken` z `api/` w projekcie Vite (oczekujemy tak, przez file tracing) – sprawdzić pierwszym deployem.
3. Wytyczne marki Stravy: wymagany wariant znaku „Powered by Strava” i przycisku „Connect with Strava”, minimalny rozmiar, czy można go wyłączyć na pocztówce (etap 2).
4. `activity:read` vs `activity:read_all` – decyzja właściciela (prywatność vs biegi prywatne).
5. Mile/km: czy etap 1 ma obsługiwać preferencję jednostek sportowca.
6. Biegi bez GPS (bieżnia, VirtualRun bez trasy): pokazać pocztówkę bez trasy czy ukryć je na liście.
7. Który font (licencja OFL) i czy jeden wystarczy do etapu 2.
