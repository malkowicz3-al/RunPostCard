# 0007. Wykresy w slotach, kamera w widoku płaskim, mapa na cały ekran, panel z listami

## Kontekst
Prośby właściciela (zdecydowane):
1. Panel stylu w kategoriach (Background, Map style, Font, Layout, Data…). Każda kategoria to rozwijana lista (jak `FontPicker`), a opcje mają podgląd: motywy miniaturę mapy, układy miniaturę, fonty krój. Kolor neonu dalej dostępny.
2. Wykresy w slotach, nie tylko liczby: profil przewyższeń, linia tętna w kolorach stref, tempo na km (słupki, najszybszy wyróżniony), pierścień udziału stref tętna. Dane z `RunStreams` (ADR 0006), a strumieni może brakować. Do tego ok. 5 układów z wykresami.
3. Zoom i przesuwanie w widoku płaskim, tak jak w 3D, z ostrzejszą mapą po przybliżeniu.
4. Usunięcie Highlights (markery „tylko zaśmiecają”).
5. Podpis mapy (licencja) zostaje, ale ma być mniejszy i dyskretny, a w eksporcie czytelny.
6. Przy motywie mapy ta sama mapa wypełnia cały ekran za panelem. Pocztówkę wyznacza ramka, a mapa poza ramką jest przyciemniona o ok. 50% i nie trafia do eksportu.

Ograniczenia:
- Jeden SVG pocztówki jest źródłem prawdy dla podglądu i eksportu (ADR 0002).
- Motywy mają filtry i faktury z obszarem równym płótnu 1080x1920 (`userSpaceOnUse`, ADR 0005), a ich `id` są stałe (`neon-streets`…).
- Motywy (`src/postcard/themes/*`) zmienia równolegle inny agent.
- Bez nowych zależności. Najmniejsza zmiana: usuwanie jest lepsze niż dodawanie.

## Decyzja

### 1. Highlights: usunięte z kodu
- Usuwamy `src/postcard/RouteMarkers.tsx`, `src/lib/runHighlights.ts` i jego test, prop `highlights` oraz `flatPoints`/`isoPoints` w `Postcard`, a także przycisk i stan w `PostcardScreen`.
- Kod zostaje w historii gita. `TRIM_M` wróci we wspólnym module razem z przycięciem trasy w etapie 3 (ADR 0006 przewidywał przeniesienie).
- Punkty 4 i 5 ADR 0006 dotyczące markerów przestają obowiązywać. Strumienie i 3D zostają.

### 2. Podpis mapy
- Pionowo wzdłuż prawej krawędzi, od dołu: `transform="rotate(-90)"`, środek linii bazowej ok. x = 1056, początek przy y ≈ 1890. `fontSize` 18, `opacity` 0.6, `system-ui` 600, kolor `text.color`.
- Pozycja jest w jednej stałej w `Postcard.tsx`. Test geometrii slotów pilnuje, żeby żaden slot (także `box` wykresu) nie wchodził w pas x > 1030.

### 3. Wykresy jako formy slotu
- `SlotForm = 'number' | ChartForm`, gdzie `ChartForm = 'area' | 'line' | 'bars' | 'ring'`. Model `Slot = {id, data, form}` się nie zmienia. Wykres to para danych i formy:
  - `area`: profil wysokości, dane `elevation`;
  - `line`: tętno w kolorach stref, dane `heartrate`;
  - `bars`: tempo na km z wyróżnionym najszybszym, dane `pace`;
  - `ring`: udział stref tętna, dane `heartrate`.

  Rejestr `CHARTS: Record<ChartForm, {data, menu, label, has(streams), Component}>` jest w `slots.ts`.
- **Gdzie mieszczą się wykresy:** `LayoutItem` dostaje opcjonalne `box?: Box` (bezwzględny prostokąt na płótnie). Tylko sloty z `box` przyjmują wykresy. Dla takich slotów pola liczby (`x, y, size, anchor, maxW`) wylicza z `box` helper `numberIn(box)`, więc autor układu podaje tylko prostokąt.
- **Degradacja:** gdy forma jest wykresem, a `streams` brak albo `CHARTS[form].has(streams)` jest fałszywe, slot rysuje liczbę tych samych danych (`elevation` → przewyższenie, `heartrate` → śr. tętno, `pace` → tempo). Nie ma pustych pól ani stanów błędu.
- **Obliczenia** są w czystych funkcjach `src/lib/chartData.ts`, bez DOM i z testami:
  - `series(s, key, n≈200)`: próbkowanie po dystansie;
  - `kmSplits(s)`: czas na każdy pełny km, a ostatni niepełny tylko przy ≥ 300 m, przeliczony na tempo;
  - `zoneShare(s, maxHr)`: udział czasu w 5 strefach.

  Strefy to progi 60/70/80/90% tętna maksymalnego. `maxHr` = `activity.max_heartrate`, a bez niego maksimum strumienia. To przybliżenie, bo prawdziwe strefy sportowca wymagają scope `profile:read_all`.
- **Rysowanie** jest w `src/postcard/SlotChart.tsx`: cztery małe komponenty, zwykłe `<path>`/`<rect>`/`<circle>`, bez d3-shape (ścieżka z punktów to kilka linii).
  - Kolor `currentColor` z przezroczystością. Najszybszy słupek ma pełne krycie, pozostałe 0.45.
  - Kolory stref to jedna stała paleta 5 kolorów, jedyny wyjątek od `currentColor`.
  - Etykieta wykresu jest w lewym górnym rogu `box` i skaluje się jak etykiety liczb (`scale` fontu).
  - Eksport bez zmian, bo to czysty SVG.
- **Okno zmiany (`DataModal`):**
  - Lista ma dwie grupy: „Numbers” (zawsze) i „Charts” (tylko gdy slot ma `box` i `has(streams)`).
  - Podgląd wykresu to ten sam komponent w `<svg>` o proporcjach `box`. Okno dostaje `streams`.
- **Zamiana:** `Overrides = Partial<Record<slotId, {data, form}>>`, `swapSlot(items, slotId, {data, form})`.
  - Para już obecna w innym slocie zamienia się miejscami.
  - Wyjątek: gdy tamten slot nie przyjmie wypieranej pary (wykres do slotu bez `box`), zamiany nie ma i powtórzenie jest dopuszczone.
- **Nakładka kliknięć:** dla slotu z `box` nakładka zajmuje cały `box`, a dla pozostałych zostaje `slotBox` jak dziś.
- **Nowe układy** (5, nazwy ogólne): `poster` (duży dystans + profil wysokości na całą szerokość), `hud` (4 liczby w rogach + pas linii tętna), `scoreboard` (rząd liczb + słupki tempa), `splits` (duże słupki tempa + 2 liczby), `pulse` (pierścień stref + liczby). `ROUTE_BOX` bez zmian, a wykresy leżą pod nim (y ≥ 1200).

### 4. Kamera w widoku płaskim
- `Camera`, `DEFAULT_CAMERA`, `CAMERA_CENTER` i `clampCamera` przechodzą do `src/lib/camera.ts`, razem z nowymi `cameraTransform(c): string` (dziś ten sam napis jest dwa razy w `Postcard.tsx`) i `clampCamera(c, view)`.
- Widok płaski ma ciasne ograniczenie: przeskalowane płótno zawsze przykrywa ramkę, czyli `x ∈ [−(1080−Cx)(z−1), Cx(z−1)]`, a dla `y` analogicznie. Przy zoomie 1 nie ma przesuwania, więc poza mapą nie widać pustki.
- Gałąź płaska w `Postcard` ma ten sam porządek co 3D:
  1. `<g transform=camera>` z mapą i ostrzejszym fragmentem;
  2. `overlay` motywu w przestrzeni płótna;
  3. `<g transform=camera>` z trasą o grubości `width / zoom`.

  Gradient i zdjęcie się nie przesuwają.
- Ostrzejsza mapa korzysta z istniejącego mechanizmu:
  - `zoomRegion` dostaje parametr `floor: Rect` (domyślnie dzisiejszy). Widok płaski podaje macierz jednostkową i `[0,0,1080,1920]`.
  - `useRegionLayers` działa w obu widokach.
- Gesty (kółko, przeciąganie, szczypanie), suwak Zoom i Reset działają w obu widokach. Warunki `is3d` w obsłudze wskaźnika znikają.

### 5. Mapa na cały ekran: osobny SVG tła, nie większa scena
- **Wybór:** pod pocztówką leży osobny `<svg class="map-backdrop">` (`src/ui/MapBackdrop.tsx`), `position: absolute` w kontenerze ekranu pocztówki, `aria-hidden`.
  - SVG pocztówki zostaje bez zmian: 1080x1920 i ten sam eksport. Eksport jest więc dokładnie pocztówką z samej konstrukcji.
- **Wspólny układ współrzędnych:** tło używa jednostek pocztówki. `viewBox` liczy czysta funkcja `backdropViewBox(screenRect, frameRect)` z `src/lib/backdrop.ts`: jednostka = 1080 / szerokość ramki, a początek = przesunięcie ramki względem kontenera. Rozmiary aktualizuje `ResizeObserver`. Różnica prostokątów nie zależy od przewijania.
- **Ta sama projekcja** (`fit.projection`), więc ulice przechodzą przez krawędź ramki bez przesunięcia.
- **Warstwy dla większego obszaru:** nowa funkcja `loadAreaLayers(projection, size, profile, rect, signal)` w `vectorMap.ts` (prostokąt może wychodzić poza płótno, `mapTiles` i `buildMapLayers` już to obsługują).
  - Najpierw próbuje tego samego poziomu kafelków co pocztówka (szew niewidoczny).
  - Powyżej `MAX_AREA_TILES = 32` schodzi o poziom (`k = 0.5`, potem `0.25`), z `precision` ×2 i `minBuildingArea` ×4.
  - Hook: `useRegionLayers` dostaje opcjonalny parametr `load` (domyślnie `loadRegionLayers`), więc nie ma drugiej kopii logiki anulowania.
- **Obszar** = `viewBox` przekształcony odwrotnością kamery (stojącej, `settled`) z marginesem 15%. Doczytanie następuje po zatrzymaniu kamery, a kafelki są w cache.
- **Kamera:** tło dostaje bieżącą kamerę i ten sam `cameraTransform`, więc przesuwa się i przybliża razem z pocztówką. Tło nie ma własnego ostrzejszego fragmentu.
- **Rysowanie tła:**
  1. `<rect>` w kolorze `style.background` na cały `viewBox`;
  2. `<g transform=camera>` z `MapBackground` (paleta z `theme.style({accent})` bez `filters`, `fill` i `fills`) i ścieżką trasy (żeby przy zoomie widać było, gdzie trasa wychodzi z kadru);
  3. czarny `<rect opacity=0.5>`.

  `MapBackground` dostaje opcjonalny prop `rect` (dziś stałe 1080x1920). Motywy się nie zmieniają.
- **Bez filtrów i faktur motywu poza ramką (świadomie):**
  - Filtry mają obszar 1080x1920 i ucięłyby się poza płótnem.
  - Rozmycia na całym ekranie przy każdej klatce kamery są drogie.
  - `id` filtrów i wzorów zdublowane w dwóch SVG w jednym dokumencie kolidowałyby.
  - Kolory, grubości i kreski są te same, a różnicę łagodzi przyciemnienie.
- **Kiedy tło jest widoczne:** tylko przy motywie mapy, w widoku płaskim i po wczytaniu mapy pocztówki. W 3D (podłoga z wygaszonymi brzegami nie ma ciągu dalszego), przy gradiencie, zdjęciu i przezroczystym tle ekran wygląda jak dziś.
- **Ramka:** `outline` na `.postcard-frame`.
- **Panel:** półprzezroczyste tło `--surface` (bez `backdrop-filter`, bo jest drogi nad dużym SVG).
- **Telefon:** panel pod pocztówką jak dziś, a tło pokrywa cały kontener, także za panelem. Przy wysokiej stronie limit kafelków obniża poziom.

### 6. Panel z rozwijanymi listami
- Ogólny `src/ui/Select.tsx` powstaje z `FontPicker` (listbox, klawiatura, Escape, kliknięcie obok, otwieranie w górę, `moveIndex`). Ma `options {id, label, group?}`, `preview(id) => ReactNode` i `onOpen` (`FontPicker` używa go do leniwego wczytania wszystkich krojów). Podglądy renderują się tylko przy otwartej liście.
- Kolejność sekcji:

  | Sekcja | Opcje | Dodatkowo |
  |---|---|---|
  | Background | Gradient / Transparent / Photo / Map | Photo: zmiana pliku + Dim |
  | Map style | 13 motywów z `RouteThumb`, tylko przy Map | kółka neonu (gdy Neon), Details |
  | View | Flat / 3D | Zoom + Reset w obu widokach |
  | Font | `FontPicker` na `Select` | |
  | Layout | `Select` z miniaturą `Mini` (prostokąty `box` widoczne) | |
  | Data | przyciski slotów jak dziś | |
  | Download | | |

- Stan się nie zmienia: `look` zostaje, a wybór „Map” ustawia ostatni motyw (domyślnie `dark`).

## Alternatywy odrzucone
- **Jedna większa scena SVG (viewBox większy niż pocztówka, eksport jako wycinek):**
  - eksport musiałby zmieniać `viewBox` i wycinać elementy spoza kadru;
  - filtry motywów (obszar 1080x1920) i tak ucięłyby się poza płótnem;
  - każda klatka kamery przerysowywałaby całość z filtrami;
  - trzeba by zmienić wszystkie motywy, które równolegle zmienia inny agent.
- **Tło jako zmniejszona kopia pocztówki rozciągnięta CSS:** inna skala daje skok grubości linii na krawędzi ramki, bez ciągłości.
- **Kafelki tła zawsze o poziom rzadsze:** prościej, ale szew byłby widoczny także na małych ekranach, na których budżet wystarcza.
- **Wykresy jako nowe `SlotData` (np. `elevProfile`) z formą wynikającą z danych:** łamie model „dane + forma” i podwaja wpisy w `DATA`.
- **d3-shape / d3-scale / biblioteka wykresów:** 4 proste kształty to kilkadziesiąt linii, więc zależność się nie opłaca. Decyzja o bibliotece wykresów z CLAUDE.md jest zamknięta: bez biblioteki.
- **Zachowanie markerów bez UI:** martwy kod z testami do utrzymania, a historia gita wystarcza.

## Zmiana po wdrożeniu (decyzja właściciela)
- Widok płaski ma to samo ograniczenie kamery co 3D (środek trasy zostaje na płótnie), więc przesuwanie działa też przy zoomie 1. Lukę poza płótnem wypełnia `loadRegionLayers`: gdy gęstsze kafelki nic nie dają, fragment wychodzący poza płótno dostaje mapę na poziomie pocztówki (`loadAreaLayers`). Zanim kafelki dojdą, widać tło motywu.
- Tło ekranu działa także w 3D: `MapBackdrop` rysuje mapę z macierzą izometrii i trasę `IsoRoute` (bez filtrów), a obszar do doczytania liczy odwrotność kamery i macierzy.
- Podłoga 3D na pocztówce nie jest już wygaszana na brzegach (maska `iso-floor-fade` usunięta, zastępuje ADR 0006): widoczną część poza płótnem zawsze doczytuje fragment `refined`, także przy kamerze domyślnej. Płasko fragment powstaje tylko, gdy widok wychodzi poza płótno albo przy zoomie ≥ 1,5.

## Konsekwencje
- Eksport bez zmian; tło ekranu nie może trafić do pliku.
- Poza ramką motyw wygląda prościej (bez poświaty i faktur). Gdyby właściciel tego chciał, motywy musiałyby dostać parametr obszaru filtrów: zmiana w każdym pliku `themes/*`.
- Do 32 dodatkowych kafelków przy pierwszym wyborze mapy na dużym ekranie (OpenFreeMap: kolejka ≤ 4). `tileCache` nie ma limitu, więc przy długim przesuwaniu pamięć rośnie. Na razie to akceptujemy, a limit LRU dodamy dopiero przy problemie.
- Przy schodzeniu poziomu (bardzo duże ekrany) szew na krawędzi ramki jest możliwy. Przykrywa go ramka i przyciemnienie.
- Na telefonie przeciąganie po pocztówce przesuwa mapę zamiast strony, także w widoku płaskim (`touch-action: none`). Stronę przewija się poza pocztówką.
- Strefy tętna są przybliżone (procent tętna maksymalnego), a nie strefami użytkownika ze Stravy.
- `Overrides` zmienia kształt. Stan jest tylko w pamięci, więc nie ma migracji.
- Zero nowych zależności.
