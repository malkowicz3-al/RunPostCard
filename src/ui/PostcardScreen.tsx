import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Activity } from '../strava/api';
import { Postcard } from '../postcard/Postcard';
import type { TextStyle } from '../postcard/SlotNumber';
import { ROUTE_BOX } from '../postcard/Route';
import { gradientCss, type GradientId } from '../postcard/Background';
import { colorScale, type RouteColor } from '../postcard/routeColor';
import { CAMERA_CENTER, DEFAULT_CAMERA, clampCamera, keepCamera, type Camera } from '../lib/camera';
import { backdropArea, nextBackdropArea, type LoadedArea } from '../lib/backdrop';
import { DEFAULT_FONT, FONTS, loadFontCss, type FontId } from '../lib/fonts';
import { NO_EDIT, loadPhoto, type PhotoEdit } from '../lib/photo';
import { isoRoute } from '../lib/isoRoute';
import { TERRAIN_AUTO_M } from '../lib/dem';
import { hillshade, reliefImage, shadeOverlay } from '../lib/relief';
import { fitRoute } from '../lib/routePath';
import { zoomRegion } from '../lib/zoomRegion';
import { POSTCARD_DETAILED } from '../lib/vectorMap';
import { DATA, resolveLayout, slotBox, slotMenu, swapSlot, type LayoutId, type Overrides, type SlotPick } from '../postcard/slots';
import { THEMES, type ThemeId } from '../postcard/themes';
import { DEFAULT_ACCENT } from '../postcard/themes/neon';
import { DataModal } from './DataModal';
import { PhotoEditor } from './PhotoEditor';
import { ExportControls } from './ExportControls';
import { FontPicker } from './FontPicker';
import { LayoutPicker } from './LayoutPicker';
import { LinePicker } from './LinePicker';
import { LookPicker, type Look } from './LookPicker';
import { MapBackdrop } from './MapBackdrop';
import { PovView, hasWebGL, type PovPaint } from './PovView';
import { useMapLayers } from './useMapLayers';
import { useRegionLayers } from './useRegionLayers';
import { usePersonCutout } from './usePersonCutout';
import { useRunStreams } from './useRunStreams';
import { toDataUrl, useTerrain } from './useTerrain';

const SIZE: [number, number] = [1080, 1920];
const IDENTITY: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
const CANVAS: [number, number, number, number] = [0, 0, 1080, 1920];
const UNBOUNDED: [number, number, number, number] = [-Infinity, -Infinity, Infinity, Infinity];

type Point = { x: number; y: number };

// Czy puszczenie wskaźnika (albo klik) otwiera okno danych slotu: klawiatura zawsze, wskaźnik tylko bez przeciągania i szczypania.
export function shouldOpenSlot({
  down,
  up,
  multiTouch,
  keyboard,
}: {
  down: Point | null;
  up: Point;
  multiTouch: boolean;
  keyboard: boolean;
}): boolean {
  if (keyboard) return true;
  return !multiTouch && !!down && Math.hypot(up.x - down.x, up.y - down.y) <= 6;
}

// Kolory podglądu w oknie danych: to samo tło i kolor tekstu co pocztówka (bez ziarna i filtrów).
function previewColors(look: Look, accent: string, photo: string | undefined, gradient: GradientId): { color: string; bg: CSSProperties } {
  if (look in THEMES) {
    const theme = THEMES[look as ThemeId];
    return { color: theme.render({}, { accent }).text.color, bg: { background: theme.style({ accent }).background } };
  }
  if (look === 'photo' && photo) {
    return { color: '#ffffff', bg: { backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' } };
  }
  if (look === 'transparent') {
    return { color: '#ffffff', bg: { background: 'conic-gradient(#3a3a3f 25%, #2c2c30 0 50%, #3a3a3f 0 75%, #2c2c30 0) 0 0 / 16px 16px' } };
  }
  return { color: '#ffffff', bg: { background: gradientCss(gradient) } };
}

// Domyślne tło: mapa Dark albo Light wg motywu systemu; bez trasy nie ma mapy, więc gradient.
function initialLook(activity: Activity): Look {
  if (!fitRoute(activity.map.summary_polyline, ROUTE_BOX)) return 'gradient';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function PostcardScreen({
  activity,
  onBack,
  onSessionExpired,
}: {
  activity: Activity;
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState<Look>(() => initialLook(activity));
  const [font, setFont] = useState<FontId>(() => (look in THEMES ? THEMES[look as ThemeId].font : DEFAULT_FONT));
  // Stary CSS zostaje, dopóki nowy się nie wczyta; id mówi, dla którego fontu jest.
  const [fontCss, setFontCss] = useState<{ id: FontId; css?: string }>();
  const fontReady = fontCss?.id === font;
  const [photo, setPhoto] = useState<string>();
  // Oryginał zostaje, żeby kolejne edycje nie traciły jakości; edycja jest wypalana w `photo`.
  const [photoFile, setPhotoFile] = useState<Blob>();
  const [photoEdit, setPhotoEdit] = useState<PhotoEdit>(NO_EDIT);
  const [editingPhoto, setEditingPhoto] = useState(false);
  // Wspólny licznik wczytań zdjęcia: wygrywa ostatnie (wolne Apply nie nadpisze nowo wgranego zdjęcia).
  const photoReq = useRef(0);
  const [dim, setDim] = useState(35);
  const [behind, setBehind] = useState(false);
  // „Pick object”: następny klik w zdjęcie wskazuje obiekt (pickAt, 0..1); null = osoba automatycznie.
  const [pickArmed, setPickArmed] = useState(false);
  const [pickAt, setPickAt] = useState<(Point & { href?: string }) | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [gradient, setGradient] = useState<GradientId>('dusk');
  const [textStyle, setTextStyle] = useState<TextStyle>({});
  const [mapFailed, setMapFailed] = useState(false);
  const [view, setView] = useState<'flat' | '3d' | 'pov'>('flat');
  const [povReady, setPovReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const povPaint = useRef<PovPaint | null>(null);
  // W trakcie MP4/GIF scena POV musi zostać ta sama: wybór widoku i wyglądu zablokowany.
  const [exporting, setExporting] = useState(false);
  const [showRoute, setShowRoute] = useState(true);
  const [routeColor, setRouteColor] = useState<RouteColor>('theme');
  const [terrainPick, setTerrainPick] = useState<boolean | null>(null); // null = automatycznie z przewyższenia
  const [layoutId, setLayoutId] = useState<LayoutId>('classic');
  const [overrides, setOverrides] = useState<Partial<Record<LayoutId, Overrides>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const items = useMemo(() => resolveLayout(layoutId, overrides[layoutId]), [layoutId, overrides]);
  const editingItem = items.find((i) => i.slot.id === editing) ?? null;
  // Miejsce wciśnięcia: przeciągnięcie (np. przesuwanie 3D) nie otwiera okna danych.
  const tap = useRef<{ x: number; y: number; id: string | null } | null>(null);
  // Drugi palec w trakcie gestu: aż do puszczenia wszystkich to szczypanie, nie dotknięcie.
  const multiTouch = useRef(false);
  const streams = useRunStreams(activity, onSessionExpired);
  const isMap = look in THEMES;
  const fit = useMemo(() => fitRoute(activity.map.summary_polyline, ROUTE_BOX), [activity]);
  // 3D liczy się na płaskiej projekcji trasy, więc bez niej przycisk nie ma sensu.
  const has3d = !!streams?.altitude && fit !== null;
  const is3d = view === '3d' && has3d;
  // POV (ADR 0010): lot nad mapą motywu (bez motywu mapy: Dark), trasa ze strumieni.
  const webgl = useMemo(hasWebGL, []);
  const hasPov = (streams?.latlng.length ?? 0) >= 2 && fit !== null && webgl;
  const isPov = view === 'pov' && hasPov;
  const povTheme: ThemeId = isMap ? (look as ThemeId) : 'dark';
  const profile = POSTCARD_DETAILED;
  const map = useMapLayers(fit?.projection ?? null, SIZE, profile, isMap || isPov);
  const mapMissing = isMap && !map.layers;
  const mapLoading = isMap && (!map.layers || map.loading);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const moved = camera.zoom !== 1 || camera.x !== 0 || camera.y !== 0;
  // Aktywne wskaźniki nad podglądem (1 = przesuwanie, 2 = szczypanie).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Zmiany kamery z kółka i przeciągania zbieramy i stosujemy raz na klatkę (render długiego biegu jest drogi).
  const frame = useRef(0);
  const queued = useRef<((c: Camera) => Camera)[]>([]);
  const moveCamera = (fn: (c: Camera) => Camera) => {
    queued.current.push(fn);
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const fns = queued.current;
      queued.current = [];
      setCamera((c) => keepCamera(c, fns.reduce((acc, f) => clampCamera(f(acc)), c)));
    });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  // Ostrzejszą mapę doczytujemy dopiero, gdy kamera stoi (bez zapytań w trakcie przesuwania).
  const [settled, setSettled] = useState<Camera>(DEFAULT_CAMERA);
  useEffect(() => {
    const t = setTimeout(() => setSettled(camera), 300);
    return () => clearTimeout(t);
  }, [camera]);
  const baseIso = useMemo(
    () => (is3d && streams && fit ? isoRoute(streams, ROUTE_BOX, fit.projection) : null),
    [is3d, streams, fit],
  );
  // Teren (ADR 0008): tylko dla biegów w górach (rozpiętość wysokości zegarka >= TERRAIN_AUTO_M), wtedy domyślnie włączony.
  // W mieście i na płaskim przycisku Terrain nie ma wcale (decyzja właściciela).
  const mountainous = useMemo(() => {
    const alt = streams?.altitude;
    if (!alt?.length) return false;
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of alt) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return hi - lo >= TERRAIN_AUTO_M;
  }, [streams]);
  const hasTerrain = mountainous && isMap && !mapMissing && fit !== null;
  const terrainOn = hasTerrain && (terrainPick ?? true);
  // Obszar DEM z iso bez DEM i kamery domyślnej (iso z DEM zależy od DEM); margines pokrywa różnicę dopasowania.
  const demArea = useMemo(
    () => (terrainOn ? backdropArea(CANVAS, DEFAULT_CAMERA, 0.3, baseIso?.matrix ?? IDENTITY) : null),
    [terrainOn, baseIso],
  );
  const terrain = useTerrain(fit?.projection ?? null, demArea, terrainOn);
  const dem = terrainOn ? terrain.dem : null;
  const iso = useMemo(
    () => (baseIso && dem && streams && fit ? (isoRoute(streams, ROUTE_BOX, fit.projection, dem) ?? baseIso) : baseIso),
    [baseIso, dem, streams, fit],
  );
  const shade = useMemo(() => (dem ? hillshade(dem) : null), [dem]);
  // Obrazy tylko przy zmianie DEM, iso lub tła motywu (nie przy ruchu kamery). Płasko: cienie PNG niezależne od motywu.
  const shadeImage = useMemo(() => {
    if (!dem || !shade) return undefined;
    const rect: [number, number, number, number] = [dem.x0, dem.y0, dem.x0 + dem.w * dem.cell, dem.y0 + dem.h * dem.cell];
    return { href: toDataUrl(shadeOverlay(dem, shade), 'image/png'), rect };
  }, [dem, shade]);
  // 3D: relief JPEG (do 8 MP); kolor tła odroczony, żeby przeciąganie koloru neonu nie liczyło reliefu przy każdym zdarzeniu.
  const povAccent = useDeferredValue(accent); // suwak koloru nie buduje sceny WebGL co krok
  const reliefBg = useDeferredValue(isMap ? THEMES[look as ThemeId].style({ accent }).background : null);
  const reliefImg = useMemo(() => {
    if (!dem || !shade || !iso || !reliefBg) return undefined;
    const p = reliefImage(dem, shade, iso, { background: reliefBg });
    return { href: toDataUrl(p, 'image/jpeg'), rect: p.rect };
  }, [dem, shade, iso, reliefBg]);
  const terrainImage = !isMap ? undefined : iso ? reliefImg : shadeImage;
  // Płasko: macierz jednostkowa, fragment może wyjść poza płótno (przesunięta kamera); przy zoomie < 1,5 tylko obszar
  // widocznej ramki na poziomie pocztówki (loadRegionLayers zwraca null, gdy cały mieści się na płótnie).
  const regionArea = useRef<LoadedArea | null>(null);
  const region = useMemo(() => {
    if (!isMap) return null;
    // 3D z terenem: relief zastępuje podłogę wektorową, więc ostrzejszej mapy nie pobieramy.
    if (iso && terrainOn && (terrain.loading || dem)) return null;
    const matrix = iso?.matrix ?? IDENTITY;
    // 3D: podłoga bez wygaszania, więc widoczną część poza płótnem doczytujemy zawsze (także przy kamerze domyślnej).
    if (!iso) {
      // Płasko: widok w całości na płótnie = mapa bazowa wystarcza (bez drugiej kopii w eksporcie).
      const [x0, y0, x1, y1] = backdropArea(CANVAS, settled, 0);
      if (settled.zoom < 1.5 && x0 >= 0 && y0 >= 0 && x1 <= SIZE[0] && y1 <= SIZE[1]) return null;
    }
    // Małe przesunięcie w doczytanym obszarze zostawia go (bez nowego zapytania), jak w tle ekranu.
    if (settled.zoom < 1.5) return (regionArea.current = nextBackdropArea(regionArea.current, CANVAS, settled, matrix));
    return zoomRegion(settled, matrix, CAMERA_CENTER, SIZE, 0.15, UNBOUNDED);
  }, [iso, terrainOn, terrain.loading, dem, isMap, settled]);
  const zoomed = useRegionLayers(fit?.projection ?? null, region, profile, isMap);
  const terrainLoading = terrainOn && terrain.loading;
  // Punkt należy do zdjęcia, przy którym go kliknięto: po zmianie zdjęcia nie liczymy go na nowym ani przez jeden render.
  const cutout = usePersonCutout(photo, behind && look === 'photo', pickAt?.href === photo ? pickAt : null);
  // POV czeka na mapę i teren, żeby scena nie budowała się dwa razy.
  const povWaiting = isPov && ((!map.layers && !map.failed) || terrainLoading);
  const loading = mapLoading || zoomed.loading || terrainLoading || cutout.loading || povWaiting;

  useEffect(() => {
    let cancelled = false;
    loadFontCss(font).then((css) => {
      if (!cancelled) setFontCss({ id: font, css });
    });
    return () => {
      cancelled = true;
    };
  }, [font]);

  // settled razem z kamerą, żeby stary zoom nie doczytywał fragmentu przez 300 ms.
  useEffect(() => {
    setCamera(DEFAULT_CAMERA);
    setSettled(DEFAULT_CAMERA);
  }, [activity, is3d]);

  // Płasko przy zoomie 1 nie ma czego przesuwać: kółko i palec przewijają stronę (ctrl+kółko i szczypanie nadal przybliżają).
  const scrollsPage = isPov || (!is3d && camera.zoom <= 1);
  // Listener nie-pasywny, żeby preventDefault blokował przewijanie strony; is3d w zależnościach przez scrollsPage.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!fit || (scrollsPage && !e.ctrlKey)) return;
      e.preventDefault();
      moveCamera((c) => ({ ...c, zoom: c.zoom * Math.exp(-e.deltaY * 0.002) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [is3d, fit, scrollsPage]);

  useEffect(() => {
    setEditing(null);
    setTerrainPick(null);
  }, [activity]);

  useEffect(() => {
    setPickArmed(false);
    setPickAt(null);
  }, [photo, behind, activity]);

  useEffect(() => {
    if (!pickArmed) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickArmed(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickArmed]);

  const opens = (e: { clientX: number; clientY: number }, keyboard = false) =>
    shouldOpenSlot({ down: tap.current, up: { x: e.clientX, y: e.clientY }, multiTouch: multiTouch.current, keyboard });

  const onPointerDown = (e: ReactPointerEvent) => {
    if (pointers.current.size > 0) multiTouch.current = true;
    const hit = (e.target as Element).closest?.('[data-slot]');
    tap.current = { x: e.clientX, y: e.clientY, id: hit?.getAttribute('data-slot') ?? null };
    if (pickArmed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const all = pointers.current;
    const prev = all.get(e.pointerId);
    const svg = currentSvg();
    if (pickArmed || isPov || !prev || !svg) return;
    const next = { x: e.clientX, y: e.clientY };
    const units = SIZE[0] / svg.getBoundingClientRect().width; // px ekranu -> jednostki SVG
    const other = [...all].find(([id]) => id !== e.pointerId)?.[1];
    if (all.size === 1) {
      moveCamera((c) => ({ ...c, x: c.x + (next.x - prev.x) * units, y: c.y + (next.y - prev.y) * units }));
    } else if (other) {
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) moveCamera((c) => ({ ...c, zoom: (c.zoom * after) / before }));
    }
    all.set(e.pointerId, next);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    // Ramka przechwytuje wskaźnik, więc klik może nie dojść do przycisku slotu; dotknięcie łapiemy tutaj.
    if (pickArmed) {
      const r = currentSvg()?.getBoundingClientRect();
      if (e.type !== 'pointerup' || !r || !opens(e)) return;
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      setPickAt({ x, y, href: photo });
      setPickArmed(false);
      return;
    }
    const id = tap.current?.id;
    if (e.type === 'pointerup' && id && opens(e)) setEditing(id);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) multiTouch.current = false;
  };

  // e.detail === 0: klawiatura (Enter/Spacja), bez wskaźnika.
  const onSlotClick = (e: ReactMouseEvent, id: string) => {
    if (opens(e, e.detail === 0)) setEditing(id);
  };

  const pick = (p: SlotPick) => {
    if (editing) setOverrides((o) => ({ ...o, [layoutId]: swapSlot(items, editing, p) }));
    setEditing(null);
  };
  const scale = FONTS[font].scale;
  // Bez wczytanej mapy pocztówka ma gradient, więc podgląd też.
  const preview = previewColors(mapMissing ? 'gradient' : look, accent, photo, gradient);

  // Przy błędzie mapy wracamy do gradientu.
  useEffect(() => {
    if (!map.failed) return;
    setMapFailed(true);
    setLook('gradient');
  }, [map.failed]);

  // Te same właściwości dla podglądu i klatek animacji; stały obiekt, żeby podgląd nie przerysowywał się przy postępie eksportu.
  const person = look === 'photo' ? (cutout.person ?? undefined) : undefined;
  const postcardProps = useMemo((): ComponentProps<typeof Postcard> => ({
    activity,
    fontCss: fontCss?.css,
    font,
    background: isPov
      ? map.layers
        ? 'map'
        : 'transparent'
      : isMap && !mapMissing
        ? 'map'
        : look === 'photo' && photo
          ? 'photo'
          : look === 'transparent'
            ? 'transparent'
            : 'gradient',
    gradient,
    map: map.layers,
    photo: photo ? { href: photo, dim: dim / 100 } : undefined,
    theme: isMap || isPov ? povTheme : undefined,
    accent,
    streams,
    view: is3d ? '3d' : 'flat',
    camera,
    iso,
    refined: zoomed.refined,
    terrain: terrainImage,
    layout: items,
    route: showRoute,
    routeColor,
    textStyle,
    person,
    bare: isPov,
  }), [textStyle, activity, fontCss?.css, font, isMap, mapMissing, look, gradient, photo, map.layers, dim, accent, streams, is3d, camera, iso, zoomed.refined, terrainImage, items, showRoute, routeColor, person, isPov, povTheme]);
  const previewCard = useMemo(() => <Postcard {...postcardProps} />, [postcardProps]);

  const currentSvg = () => previewRef.current?.querySelector('svg') ?? null;

  const choose = (value: Look) => {
    setMapFailed(false);
    setLook(value);
    if (value in THEMES) setFont(THEMES[value as ThemeId].font);
  };

  // Przy błędzie zostaje poprzednie zdjęcie i wygląd.
  const choosePhoto = (file: File) => {
    const n = ++photoReq.current;
    setPhotoBusy(true);
    loadPhoto(file)
      .then((url) => {
        if (n !== photoReq.current) return;
        setPhoto(url);
        setPhotoFile(file);
        setPhotoEdit(NO_EDIT);
        choose('photo');
        setPhotoError(false);
      })
      .catch(() => n === photoReq.current && setPhotoError(true))
      .finally(() => n === photoReq.current && setPhotoBusy(false));
  };

  const applyPhotoEdit = (edit: PhotoEdit) => {
    setEditingPhoto(false);
    if (!photoFile) return;
    const n = ++photoReq.current;
    setPhotoBusy(true);
    loadPhoto(photoFile, 1, edit)
      .then((url) => {
        if (n !== photoReq.current) return;
        setPhoto(url);
        setPhotoEdit(edit);
        setPhotoError(false);
      })
      .catch(() => n === photoReq.current && setPhotoError(true))
      .finally(() => n === photoReq.current && setPhotoBusy(false));
  };

  // Ten sam styl linii na tle ekranu co na pocztówce.
  const lineColor = useMemo(
    () => colorScale(routeColor, streams, activity.max_heartrate) ?? undefined,
    [routeColor, streams, activity.max_heartrate],
  );
  // Tło ekranu tylko przy motywie mapy i po wczytaniu mapy pocztówki, płasko i w 3D (ADR 0007).
  const backdrop = isMap && !mapMissing && fit !== null;

  return (
    <div className={`screen postcard-screen${backdrop ? ' has-backdrop' : ''}`}>
      {backdrop && fit && (
        <MapBackdrop
          frameRef={previewRef}
          projection={fit.projection}
          route={fit.d}
          theme={look as ThemeId}
          accent={accent}
          profile={profile}
          camera={camera}
          settled={settled}
          iso={iso ?? undefined}
          terrain={terrainImage}
          points={fit.points}
          color={lineColor}
        />
      )}
      <div className="top-bar">
        <button className="text-button" aria-label="Back to runs" onClick={onBack}>
          ‹ Runs
        </button>
        <h1 className="run-title">{activity.name}</h1>
      </div>
      <div className="postcard-layout">
        {/* Szachownica tylko na otoczce podglądu, żeby nie trafiła do eksportu. */}
        <div
          className={`postcard-frame${look === 'transparent' ? ' checkerboard' : ''}${fit ? ' pannable' : ''}${scrollsPage ? ' scrolls-page' : ''}${pickArmed ? ' picking' : ''}${isPov ? ' pov-frame' : ''}`}
          ref={previewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // Klawiatura zamiast suwaka: +/- przybliża, strzałki przesuwają (kamera jak przy przeciąganiu).
          tabIndex={fit ? 0 : undefined}
          aria-label={fit ? 'Postcard preview. Plus and minus zoom, arrow keys move the map.' : undefined}
          onKeyDown={(e) => {
            if (!fit || isPov) return;
            const step = 60;
            const keys: Record<string, (c: Camera) => Camera> = {
              '+': (c) => ({ ...c, zoom: c.zoom * 1.25 }),
              '=': (c) => ({ ...c, zoom: c.zoom * 1.25 }),
              '-': (c) => ({ ...c, zoom: c.zoom / 1.25 }),
              ArrowLeft: (c) => ({ ...c, x: c.x + step }),
              ArrowRight: (c) => ({ ...c, x: c.x - step }),
              ArrowUp: (c) => ({ ...c, y: c.y + step }),
              ArrowDown: (c) => ({ ...c, y: c.y - step }),
            };
            const fn = keys[e.key];
            if (!fn) return;
            e.preventDefault();
            moveCamera(fn);
          }}
        >
          {isPov && !povWaiting && streams && fit && (
            <PovView
              streams={streams}
              projection={fit.projection}
              layers={map.layers}
              theme={povTheme}
              accent={povAccent}
              dem={dem}
              color={showRoute ? lineColor : undefined}
              route={showRoute}
              playing={playing}
              paintRef={povPaint}
              onReady={setPovReady}
            />
          )}
          {previewCard}
          {/* Nakładka w HTML obok <svg>, żeby nie trafiła do eksportu. */}
          {items.map((item) => {
            const b = slotBox(item, DATA[item.slot.data].value(activity), scale);
            return (
              <button
                key={item.slot.id}
                className="slot-hit"
                aria-haspopup="dialog"
                data-slot={item.slot.id}
                data-active={editing === item.slot.id}
                aria-label={`${slotMenu(item.slot)} – change`}
                style={{
                  left: `${b.x0 / 10.8}%`,
                  top: `${b.y0 / 19.2}%`,
                  width: `${(b.x1 - b.x0) / 10.8}%`,
                  height: `${(b.y1 - b.y0) / 19.2}%`,
                }}
                onClick={(e) => onSlotClick(e, item.slot.id)}
              />
            );
          })}
        </div>
        <div className="style-panel">
          <h2 className="panel-title">Style</h2>
          <div className="panel-pair" inert={exporting}>
            <LookPicker
              polyline={activity.map.summary_polyline}
              hasRoute={fit !== null}
              look={look}
              onLook={choose}
              accent={accent}
              onAccent={setAccent}
              gradient={gradient}
              onGradient={setGradient}
              photoHref={photo}
              onPhotoFile={choosePhoto}
              photoBusy={photoBusy}
            />
          </div>
          {photoError && <p className="error">Could not read this image. Try a JPEG or PNG.</p>}
          {look === 'photo' && (
            <div className="toggle-row">
              <label className="zoom-control">
                Dim
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={5}
                  value={dim}
                  onChange={(e) => setDim(Number(e.target.value))}
                />
              </label>
              {photoFile && (
                <button
                  className="toggle icon-toggle"
                  aria-label="Edit photo"
                  aria-haspopup="dialog"
                  title="Edit photo"
                  // aria-disabled zamiast disabled: po Apply fokus wraca na ten przycisk.
                  aria-disabled={photoBusy}
                  onClick={() => !photoBusy && setEditingPhoto(true)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
                    <circle cx="16" cy="6" r="2" />
                    <circle cx="10" cy="12" r="2" />
                    <circle cx="18" cy="18" r="2" />
                  </svg>
                </button>
              )}
              {photo && (
                <button className="toggle" aria-pressed={behind} onClick={() => setBehind(!behind)}>
                  Behind
                </button>
              )}
              {photo && behind && (
                <button className="toggle" aria-pressed={pickArmed} onClick={() => setPickArmed(!pickArmed)}>
                  Pick object
                </button>
              )}
              {photo && behind && pickAt && (
                <button className="toggle" onClick={() => setPickAt(null)}>
                  Auto
                </button>
              )}
            </div>
          )}
          {look === 'photo' && pickArmed && <p className="panel-hint">Tap the object on the photo</p>}
          {look === 'photo' && cutout.failed && (
            <p className="error" role="status">
              {pickAt && cutout.failed === 'none'
                ? 'No object found there. Try another spot.'
                : cutout.failed === 'none'
                  ? 'No runner found in this photo. Try one where the person is larger.'
                  : 'Could not load the runner detector. Turn Behind off and on to retry.'}
            </p>
          )}
          <p className="panel-hint">
            Click a stat to change it.{fit && ' Drag, Ctrl + scroll or pinch to move and zoom the map.'}
          </p>
          {fit && (
            <section className="panel-section" inert={exporting}>
              <h3 className="panel-heading">View</h3>
              <div className="toggle-row">
                <div className="toggle-group" role="group" aria-label="View">
                  <button className="toggle" aria-pressed={!is3d && !isPov} onClick={() => setView('flat')}>
                    Flat
                  </button>
                  {has3d && (
                    <button className="toggle" aria-pressed={is3d} onClick={() => setView('3d')}>
                      3D
                    </button>
                  )}
                  <button className="toggle" aria-pressed={isPov} disabled={!hasPov} onClick={() => setView('pov')}>
                    POV{!webgl ? ' (WebGL not available)' : !hasPov && ' (needs streams)'}
                  </button>
                </div>
                {isPov && (
                  <button className="toggle" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
                    {playing ? 'Pause' : 'Play'}
                  </button>
                )}
                <button className="toggle" aria-pressed={showRoute} onClick={() => setShowRoute(!showRoute)}>
                  Route
                </button>
                {hasTerrain && (
                  <button className="toggle" aria-pressed={terrainOn} onClick={() => setTerrainPick(!terrainOn)}>
                    Terrain
                  </button>
                )}
                {moved && !isPov && (
                  <button className="text-button" onClick={() => setCamera((c) => keepCamera(c, DEFAULT_CAMERA))}>
                    Reset view
                  </button>
                )}
              </div>
              {showRoute && (
                <div className="toggle-row zoom-control">
                  Line
                  <LinePicker value={routeColor} onChange={setRouteColor} streams={streams} />
                </div>
              )}
            </section>
          )}
          <div className="panel-pair">
            <FontPicker font={font} onFont={setFont} />
            <LayoutPicker layout={layoutId} onLayout={setLayoutId} />
          </div>
          <div className="toggle-row" role="group" aria-label="Text style">
            Text
            {(
              [
                ['bold', 'Bold'],
                ['italic', 'Italic'],
                ['outline', 'Outline'],
                ['shadow', 'Shadow'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className="toggle" aria-pressed={!!textStyle[k]} onClick={() => setTextStyle((t) => ({ ...t, [k]: !t[k] }))}>
                {label}
              </button>
            ))}
          </div>
          <DataModal
            slot={editingItem}
            activity={activity}
            font={font}
            scale={scale}
            color={preview.color}
            bg={preview.bg}
            streams={streams}
            onPick={pick}
            onClose={() => setEditing(null)}
          />
          <PhotoEditor
            file={editingPhoto ? (photoFile ?? null) : null}
            initial={photoEdit}
            onApply={applyPhotoEdit}
            onClose={() => setEditingPhoto(false)}
          />
          <ExportControls
            name={`runpostcard-${activity.id}`}
            svg={currentSvg}
            frame={(p) => <Postcard {...postcardProps} progress={p} />}
            resetKey={postcardProps}
            disabled={loading || !fontReady || (isPov && !povReady)}
            under={isPov ? (c, p) => povPaint.current?.(c, p) : undefined}
            onBusy={setExporting}
          />
          {loading && (
            <p className="hint" role="status">
              {cutout.loading ? 'Finding runner…' : terrainLoading ? 'Loading terrain…' : 'Loading map…'}
            </p>
          )}
          {terrainImage && (
            <p className="map-attribution">
              Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain Tiles by Mapzen</a> on AWS
              Open Data; 3DEP, SRTM and GMTED2010 courtesy of the U.S. Geological Survey; EU-DEM produced using Copernicus
              data and information funded by the European Union; ETOPO1 by NOAA; and regional sources listed in the link.
            </p>
          )}
          {mapFailed && <p className="error">Could not load the map.</p>}
        </div>
      </div>
    </div>
  );
}
