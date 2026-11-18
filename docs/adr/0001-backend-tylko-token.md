# 0001. Backend tylko do tokenu; API Stravy wołane z przeglądarki

## Kontekst
Wymiana kodu OAuth i odświeżanie tokenu wymagają `client_secret`, więc nie mogą działać w przeglądarce. Projekt jest bez bazy, uruchamiany lokalnie (Vite) albo na Vercel; logika ma być w jednym module z dwoma cienkimi wejściami.

## Decyzja
- Jedna funkcja `server/stravaToken.ts`: `(body, env) -> {status, json}`; body to `{code}` albo `{refresh_token}`. Nie zna HTTP frameworka.
- Jeden endpoint `POST /api/strava/token`: `api/strava/token.ts` (Vercel) i wtyczka `configureServer` w `vite.config.ts` (lokalnie) tylko tłumaczą żądanie na wywołanie funkcji.
- Token trafia do przeglądarki (`sessionStorage`); zapytania o aktywności i deautoryzacja idą z przeglądarki prosto do Stravy.

## Konsekwencje
- Serwer nic nie przechowuje i nie widzi danych biegów; minimalny kod i koszt hostingu.
- Access/refresh token żyje w przeglądarce: XSS daje do niego dostęp. Łagodzenie: brak zewnętrznych skryptów, `sessionStorage` domyślnie, scope tylko do odczytu.
- Jeśli któryś endpoint Stravy nie wspiera CORS, trzeba go dodać jako kolejną akcję tego samego modułu.
- Przejście później na tokeny w ciasteczkach httpOnly wymagałoby proxy dla wszystkich wywołań API – duża zmiana.
