# Architektura – etap 1

Zakres: logowanie Stravą, lista ostatnich biegów, wybór, domyślna pocztówka 9:16 (gradient z ziarnem, trasa, dystans + czas, tempo, śr. tętno, data), pobranie PNG, znak „Powered by Strava”.

## Struktura plików

```
.env.example              # VITE_STRAVA_CLIENT_ID=, STRAVA_CLIENT_SECRET= (puste)
index.html                # punkt wejścia Vite
package.json              # zależności: react, react-dom, d3-geo; dev: vite, @vitejs/plugin-react, typescript, vitest, @types/*
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
    api.ts                # GET /athlete/activities bezpośrednio z przeglądarki, filtr biegów (sport_type Run/TrailRun/VirtualRun), typ Activity
  
  postcard/
    slots.ts              # model slotu {id, data, form}, rejestr danych (data -> etykieta + wartość z Activity), domyślny układ 9:16
    Postcard.tsx          # jeden <svg viewBox="0 0 1080 1920">: tło, trasa, sloty, znak Strava; ten sam SVG idzie do eksportu
    Background.tsx        # gradient + ziarno przez filtr feTurbulence (kod, bez obrazków)
    Route.tsx             # <path> trasy z gotowej ścieżki; ROUTE_BOX = obszar trasy na płótnie
    MapBackground.tsx     # tryb tła "map": kafelki CARTO dark_all jako <image> z data URL, z tej samej projekcji co trasa (ADR 0003)
    SlotNumber.tsx        # forma "liczba" (jedyna w etapie 1); rejestr form w slots.ts mapuje form -> komponent
    StravaMark.tsx        # oficjalny biały znak „Powered by Strava” jako <image> z data URL (import ?raw, bez modyfikacji pliku)

  ui/
    LoginScreen.tsx       # przycisk „Connect with Strava” (oficjalny styl) + znak Strava
    ActivityList.tsx      # lista ostatnich biegów (nazwa, data, dystans) do wyboru
    PostcardScreen.tsx    # podgląd pocztówki, wybór tła (gradient / przezroczyste / mapa), pobieranie kafelków, „Download PNG”/SVG
    RouteThumb.tsx        # miniatura trasy na kafelkach CARTO (light_all/dark_all wg motywu, zwykłe URL-e)
    useColorScheme.ts     # motyw systemu (matchMedia z nasłuchem zmian)

  assets/brand/strava/    # oficjalne zasoby Stravy (przycisk Connect, znaki Powered by), bez modyfikacji

  lib/
    polyline.ts           # dekoder Google encoded polyline (~20 linii; bez zależności)
    polyline.test.ts
    format.ts             # dystans km, czas h:mm:ss, tempo min/km, data
    format.test.ts
    exportPng.ts          # SVG -> XMLSerializer -> Blob URL -> Image -> canvas 1080x1920 -> toBlob -> pobranie
    fonts.ts              # font pocztówki (TTF) jako data URL wstrzykiwany do <style> w SVG (img nie pobiera zewnętrznych fontów)
    dataUrl.ts            # fetch -> data URL z cache w pamięci (font, kafelki mapy)
    routePath.ts          # fitRoute: polyline -> d3-geo geoMercator().fitExtent -> {projection, d}; routePath = samo d
    mapTiles.ts           # czysta funkcja: projekcja trasy -> kafelki XYZ pokrywające płótno; tileUrl dla CARTO @2x (ADR 0003)
    mapTiles.test.ts

public/fonts/             # Barlow Condensed Bold (TTF) + OFL.txt

docs/
  architecture.md         # ten plik
  adr/                    # decyzje trudne do odwrócenia
```

## Przepływ danych

1. Logowanie: przeglądarka -> `https://www.strava.com/oauth/authorize?client_id=VITE_STRAVA_CLIENT_ID&redirect_uri=<origin>/&scope=activity:read&state=<losowy>` -> Strava wraca na `/?code=...&state=...`.
2. Wymiana kodu: przeglądarka -> `POST /api/strava/token {code}` -> (Vercel: `api/strava/token.ts` | lokalnie: wtyczka w `vite.config.ts`) -> `server/stravaToken.ts` (+ `STRAVA_CLIENT_SECRET`) -> `POST https://www.strava.com/oauth/token` -> `{access_token, refresh_token, expires_at, athlete}` -> `sessionStorage`.
3. Odświeżanie: gdy `expires_at` mija, przeglądarka -> `POST /api/strava/token {refresh_token}` -> ten sam moduł.
4. Dane: przeglądarka -> `GET https://www.strava.com/api/v3/athlete/activities?per_page=30` z `Authorization: Bearer` (bez backendu). Lista zawiera `map.summary_polyline`, `distance`, `moving_time`, `average_heartrate`, `start_date_local` – wystarcza na etap 1, bez pobierania streamów.
5. Render: Activity -> sloty (`slots.ts`) + trasa (`polyline.ts` -> `Route.tsx`) -> `<svg>` -> `exportPng.ts` -> plik PNG.
6. Wylogowanie: przeglądarka -> `POST https://www.strava.com/oauth/deauthorize` z tokenem -> czyszczenie `sessionStorage`.

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
- **Mapa z kafelków CARTO (dane OSM) bez biblioteki map**: kafelki liczone z tej samej projekcji co trasa; na pocztówce osadzane jako data URL, w miniaturach zwykłe URL-e (ADR 0003).

## Otwarte pytania

1. Czy endpoint `oauth/deauthorize` i `api/v3` Stravy pozwalają na CORS z przeglądarki? Jeśli deauthorize nie – dodać `{action: 'deauthorize'}` do tego samego endpointu.
2. Czy Vercel poprawnie bundluje import `../../server/stravaToken` z `api/` w projekcie Vite (oczekujemy tak, przez file tracing) – sprawdzić pierwszym deployem.
3. Wytyczne marki Stravy: wymagany wariant znaku „Powered by Strava” i przycisku „Connect with Strava”, minimalny rozmiar, czy można go wyłączyć na pocztówce (etap 2).
4. `activity:read` vs `activity:read_all` – decyzja właściciela (prywatność vs biegi prywatne).
5. Mile/km: czy etap 1 ma obsługiwać preferencję jednostek sportowca.
6. Biegi bez GPS (bieżnia, VirtualRun bez trasy): pokazać pocztówkę bez trasy czy ukryć je na liście.
7. Który font (licencja OFL) i czy jeden wystarczy do etapu 2.
