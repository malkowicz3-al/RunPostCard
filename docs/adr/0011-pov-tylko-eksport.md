# 0011. POV tylko jako eksport MP4 (bez podglądu)

## Kontekst
POV z ADR 0010 miał podgląd na żywo: scena WebGL pod nakładką pocztówki, z własnym zegarem lotu. Nakładka miała stały postęp 1, a lot własny czas, więc statystyki nie zgadzały się z miejscem na trasie. Podgląd trzymał też stale kontekst WebGL (bateria telefonu, błędy przy przebudowie sceny), a przyciski Flat/3D/POV i Still/Animated zajmowały dużo miejsca w panelu.

## Decyzja
- **Brak widoku POV na ekranie.** W sekcji View zostają dwa pojedyncze przyciski z etykietą stanu bieżącego i ikoną przełączenia: „2D”/„3D” (tylko gdy jest 3D) i „Still”/„Animated”.
- **POV tylko jako plik:** pozycja „POV video (MP4)” w menu Download w obu trybach (Still i Animated). Nieaktywna z podpisem bez WebCodecs H.264 albo bez WebGL i strumieni biegu. Plik `runpostcard-<id>-pov.mp4`.
- **Scena budowana na czas eksportu** (`src/pov/export.ts`, ładowany przez `import()` razem z Three.js): jeden renderer poza ekranem (`preserveDrawingBuffer`), zawsze zwalniany (`dispose` i `forceContextLoss`), także po błędzie i Cancel. Błąd kontekstu WebGL = komunikat „Could not create the POV video.”.
- **Jeden postęp p (ułamek dystansu) dla wszystkiego:** kamera, rosnąca trasa i liczniki nakładki z tej samej listy klatek, więc statystyki zgadzają się z miejscem lotu.
- **Momenty** (`src/pov/moments.ts`): najwyższe tętno, najszybsze tempo (5–95% dystansu) i najwyższy punkt (gdy rozpiętość ≥ 30 m); najwyżej 3, bliżej niż 8% dystansu wygrywa tętno, potem tempo. Pomijamy pierwsze 5% i ostatnie 3%.
- **Międzyczasy** (`kind: 'split'`): poniżej półmaratonu co 1 km (`KM 3 · 5:12 /km`), od półmaratonu co 5 km (`10 KM · 26:40 · 5:20 /km`, czas i tempo odcinka); czas z interpolacji `streams.time`, bez niego sam numer. Pomijane w ostatnich 300 m i w promieniu 300 m od momentu kluczowego. Razem najwyżej 40 postojów.
- **Czas** (`src/pov/timeline.ts`): lot bez postojów 20 s + 3 s/km, w granicach 30–70 s. Każdy postój w strefie ±150 m (zwężanej, gdy sąsiedzi bliżej, więc strefy nie nachodzą) dodaje 2 s (międzyczas) albo 2,5 s (moment kluczowy) gładkim garbem (1 − x²)⁴; na końcu 1,5 s postoju. Klatki z odwrócenia T(p).
- **Napis momentu** w nakładce SVG (`banner` w `Postcard`): tabliczka z tekstem w foncie i stylu tekstu statystyk, ok. 90 px nad punktem trasy (25 m nad nią w scenie), z kreską w kolorze trasy motywu; wchodzi i znika w ćwiartkach strefy. Punkt rzutowany tą samą kamerą co Three.js (`project` w `src/pov/data.ts`); za kamerą lub poza kadrem napis znika. Tabliczka nie wychodzi poza kartę.
- **Budynki**: zawsze w POV (warstwy z `extrude`), kolor motywu przesunięty o 40% ku bieli na ciemnym tle i ku czerni na jasnym, najmniej 12 m. Kamera 120 m za biegaczem i 55 m nad nim.
- Poświata (Glow) i Map dim nie działają w POV; wygląd bez mapy (gradient, zdjęcie, przezroczyste) leci nad mapą Dark.

## Konsekwencje
- Brak GIF-a, PNG i SVG z POV oraz brak podglądu: efekt widać dopiero w pobranym pliku.
- Eksport dłuższy niż zwykłe MP4: 30–70 s lotu plus postoje (10 km z 9 międzyczasami i 3 momentami ok. 75 s filmu), każda klatka to render WebGL i rasteryzacja nakładki SVG.
- Warstwy mapy wczytują się przy każdym biegu ze strumieniami i WebGL (także przy tle bez mapy), żeby POV miał podłogę; bez nich podłoga jednolita.
- Napis szacuje szerokość z liczby znaków; przy bardzo szerokich fontach tekst może wyjść poza tabliczkę.
