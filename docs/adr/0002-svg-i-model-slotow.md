# 0002. Jeden SVG jako źródło pocztówki i model slotów

## Kontekst
Pocztówka ma być podglądana, edytowana (etapy 2–4) i eksportowana do PNG w przeglądarce. Elementy (dystans, tempo, tętno…) mają mieć konfigurowalne dane i formę graficzną od początku, choć w etapie 1 jest tylko forma „liczba”.

## Decyzja
- Pocztówka to jeden komponent `<svg viewBox="0 0 1080 1920">` (wymiary docelowe w pikselach eksportu). Eksport serializuje ten sam SVG i rysuje go na canvas; nie ma osobnej ścieżki renderu.
- Wszystko w SVG jest samowystarczalne: font osadzony jako data URL, znak Strava inline, ziarno przez `feTurbulence`.
- Slot: `{id, data: SlotData, form: SlotForm}`. `SlotData` -> rejestr (etykieta, wartość z `Activity`); `SlotForm` -> rejestr komponentów SVG. Układ to lista slotów z pozycją.

## Konsekwencje
- Podgląd = eksport (WYSIWYG) i jedna technologia; nowe formy (wykres, pierścień) to nowe komponenty w rejestrze.
- Każdy zewnętrzny zasób (zdjęcie w etapie 2, nowe fonty) musi być wstrzyknięty jako data URL przed eksportem.
- Efekty niedostępne w SVG (np. część filtrów CSS) są wykluczone; Safari bywa niekonsekwentny przy rysowaniu SVG z filtrami na canvas – wymaga testu.
- Zmiana na render canvas/HTML później oznaczałaby przepisanie wszystkich form slotów.
