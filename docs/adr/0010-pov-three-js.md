# 0010. POV: lot wzdłuż trasy w Three.js (leniwy chunk)

Wycofane: funkcja POV usunięta decyzją właściciela (20 XI 2026).

Zmienione przez 0011: brak podglądu i widoku POV; eksport tylko MP4.

## Kontekst
Etap 6 planu animacji: widok „POV”, kamera leci za biegaczem nad mapą motywu, z budynkami i terenem, z eksportem MP4/GIF. Izometria SVG (ADR 0006, 0008) nie daje perspektywy z bliska ani zasłaniania; rysowanie perspektywy w SVG klatka po klatce byłoby wolne i bez bufora głębi. Właściciel zgodził się na Three.js tylko dla POV.

## Decyzja
- **Three.js 0.187.0** (MIT), wersja przypięta. Ładowany tylko przez `import('../pov/scene')` z `PovView`, czyli przy wyborze POV. Build: osobny chunk `scene-*.js` ok. 536 kB (136 kB gzip); główny chunk urósł o ok. 4 kB. Kto nie otwiera POV, nie pobiera Three.js.
- **Dane osobno od obiektów Three** (`src/pov/data.ts`, testy w node): lokalny układ metryczny (x wschód, z południe, y wysokość, metry od środka trasy na płótnie; 1 px = R·cos(lat)/scale), trasa wygładzona i próbkowana co 10 m, ścieżka kamery (150 m za, 80 m nad biegaczem, patrzy 250 m przed siebie, kierunek wytłumiony średnią ±150 m, Catmull-Rom między próbkami, zawsze ≥ 20 m nad terenem), wstęga z kolorami `colorScale`, bryły z obrysów. `src/pov/scene.ts` tylko składa z tego siatki.
- **Podłoga = mapa motywu jako tekstura:** scena SVG motywu (`THEMES[t].render(...).scene`, bez faktury papieru) dla całego płótna 1080x1920 rasteryzowana przez `Image` do canvasa 2048x4096 (1024x2048, gdy GPU nie ma tekstur 4096) → `CanvasTexture`. Te same warstwy co pocztówka, bez nowych zapytań. Z terenem: siatka 256x455 podniesiona do DEM (×1,5), mapa oświetlona; bez terenu płaska, bez cieniowania, a trasa na wysokości zegarka (×1–3) z półprzezroczystą kurtyną do podłogi, jak w 3D.
- **Budynki:** do 3000 największych obrysów jako jedna siatka (ściany + dach z `ShapeUtils`), kolor budynku motywu, podstawa na wysokości terenu w środku obrysu. Kształty motywów z etapu 5 (dachy, wieże) tylko w SVG 3D.
- **Kolory bez zarządzania barwą** (`ColorManagement.enabled = false`, wyjście liniowe): tekstura i wierzchołki wyglądają jak SVG.
- **Nakładka:** ta sama pocztówka w trybie `bare` (bez tła, mapy i trasy) nad canvasem; statystyki, znak Stravy i podpis mapy jak zwykle.
- **Eksport:** wspólny `ExportControls`/`encodeVideo`; nowy parametr `under` rysuje klatkę WebGL na canvasie eksportu przed nakładką SVG. Osobny `WebGLRenderer` (`preserveDrawingBuffer`) w rozmiarze klatki (MP4 1080x1920, GIF 432x768), tworzony przy pierwszym eksporcie. PNG = bieżąca klatka; SVG w POV wyłączony (scena nie jest wektorem). Liczniki dystansu i czasu rosną jak w animacji rysowania (nakładka rasteryzowana co klatkę, jak dotąd).
- Zwalnianie: przy zmianie danych i odmontowaniu `dispose` geometrii, materiałów, tekstury i rendererów (`forceContextLoss`); każda budowa dostaje nowy canvas.

## Ograniczenia
- Tekstura ma 2–5 m na piksel (całe płótno pocztówki), więc z bliska mapa jest miękka. Lepiej: kafelki o wyższym zoomie pod kamerą (później, jeśli trzeba).
- Podgląd 30 kl./s na sztywno, bez obniżania jakości na słabym GPU; na telefonie scena z terenem (116 tys. wierzchołków) i 3000 brył może zwolnić. Pixel ratio najwyżej 2.
- Zmiana koloru neonu przebudowuje scenę (nowa tekstura).
- Bez WebGL przycisk POV nieaktywny z podpisem.
