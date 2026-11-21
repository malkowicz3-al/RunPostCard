# 0014. Obrót sceny (Rotate)

## Kontekst
Decyzja właściciela (21 XI 2026): trasę i mapę można obrócić, żeby bieg lepiej leżał w kadrze 9:16. Sterowanie: suwak, obrót dwoma palcami i Shift+kółko. Statystyki, znak Stravy i podpis OSM zostają prosto.

## Decyzja
- `Camera` dostaje opcjonalne `angle` (stopnie, domyślnie 0, `wrapAngle` do [−180, 180]). Bez obrotu `cameraTransform` i `applyCamera` dają dokładnie stary wynik.
- **2D:** obraca się grupa kamery (mapa z trasą) wokół środka płótna: `s = C + pan + zoom·R(angle)·(p − C)`; `unapplyCamera` to odwrotność. `backdropArea` i `zoomRegion` liczą rogi widoku przez `unapplyCamera`, więc doczytany obszar pokrywa obrócony widok. `clampCamera` liczy zakres przesunięcia z obróconego pudełka trasy; przy obrocie zoom może spaść poniżej 1, żeby obrócona trasa mieściła się w kadrze.
- **3D:** to samo `angle` jest azymutem izometrii: `isoRoute(..., azimuth)` obraca kierunek patrzenia (macierz liczona z kąta, przy 0 równa staremu 45°), trasa jest dopasowywana do pudełka przy każdym kącie. Reszta (tło, mapa, `Postcard`) dostaje kamerę z `angle` 0. `Buildings3D` liczy skalę z `Math.hypot(a, 2·b)` zamiast założenia 45°.
- **Teren:** `relief.ts` ma macierz na sztywno dla azymutu 0, więc w 3D z Terrain obrót jest zablokowany (suwak ukryty, azymut 0). W 2D z Terrain obrót działa; obszar DEM nie zależy od kąta.
- **Sterowanie** (`PostcardScreen`): suwak Rotate w sekcji View (krok 5°); dwa palce: `twistDegrees` z martwą strefą 10° (szczypanie nie obraca przypadkiem); Shift+kółko (`deltaX || deltaY`, bo przeglądarki z Shiftem podają `deltaX`); Reset view zeruje też kąt. Bez klawiatury.
- **Behind:** przycięcie trasy „obręczą” liczone poza grupą kamery, w przestrzeni ekranu, więc działa przy dowolnym kącie.
- Ekran Together bez zmian.

## Konsekwencje
- Stan kamery tylko w pamięci, bez nowych zależności.
- Przy obrocie rogi widoku w gęstym mieście mogą stracić najmniejsze budynki (limit 5000 brył).
- W 3D skala trasy zmienia się nieco z kątem (dopasowanie do pudełka); akceptujemy.
- Odrzucone: obrót przez filtr albo obrót całego SVG (obróciłby statystyki i znaki).
