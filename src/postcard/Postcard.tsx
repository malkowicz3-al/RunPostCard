import { useMemo, type ReactNode } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import { DEFAULT_CAMERA, cameraTransform, type Camera } from '../lib/camera';
import { type Cutout } from '../lib/cutout';
import { isoRoute, type IsoRoute as IsoData } from '../lib/isoRoute';
import type { Rect } from '../lib/mapTiles';
import { fitRoute } from '../lib/routePath';
import { TERRAIN_ATTRIBUTION } from '../lib/dem';
import { DEFAULT_FONT, FONTS, fontStack, type FontId } from '../lib/fonts';
import { MAP_ATTRIBUTION, type Building, type MapLayers } from '../lib/vectorMap';
import { Buildings3D } from './Buildings3D';
import { Background, type GradientId } from './Background';
import { MapBackground } from './MapBackground';
import { IsoRoute } from './IsoRoute';
import { PhotoBackground } from './PhotoBackground';
import { Route, ROUTE_BOX } from './Route';
import { colorScale, routeLegend, type RouteColor } from './routeColor';
import { RouteLegend } from './RouteLegend';
import { StravaMark } from './StravaMark';
import { SlotNumber, type TextStyle } from './SlotNumber';
import { DATA, chartFor, defaultLayout, fitted, type LayoutItem } from './slots';
import { THEMES, type ThemeId } from './themes';

// Obraz terenu (data URL) i jego prostokąt: płasko w jednostkach płótna mapy, w 3D w jednostkach pocztówki przed kamerą.
export type TerrainImage = { href: string; rect: Rect };

export const terrainImage = ({ href, rect: [x0, y0, x1, y1] }: TerrainImage) => (
  <image href={href} x={x0} y={y0} width={x1 - x0} height={y1 - y0} preserveAspectRatio="none" />
);

export type PostcardBackground = 'gradient' | 'transparent' | 'map' | 'photo';
// Podpis mapy pionowo przy prawej krawędzi: początek linii bazowej, tekst biegnie w górę.
const ATTRIBUTION_AT: [number, number] = [1056, 1890];

export function Postcard({
  activity,
  fontCss,
  font = DEFAULT_FONT,
  background = 'gradient',
  gradient,
  map,
  photo,
  theme = 'dark',
  accent,
  streams,
  view = 'flat',
  camera = DEFAULT_CAMERA,
  iso: givenIso,
  refined,
  terrain,
  layout = defaultLayout,
  route = true,
  person,
  routeColor = 'theme',
  textStyle,
  progress = 1,
  glow = 0,
  mapDim = 0,
}: {
  activity: Activity;
  fontCss?: string;
  font?: FontId;
  background?: PostcardBackground;
  gradient?: GradientId;
  map?: MapLayers;
  photo?: { href: string; dim: number };
  theme?: ThemeId;
  accent?: string;
  streams?: RunStreams | null;
  view?: 'flat' | '3d';
  camera?: Camera;
  iso?: IsoData | null; // policzone wyżej (ekran i tak go potrzebuje), inaczej liczone tutaj
  refined?: { rect: Rect; layers: MapLayers }; // ostrzejsza mapa przybliżonego fragmentu (płasko lub podłoga 3D)
  terrain?: TerrainImage; // tylko z tłem map: 3D relief zamiast podłogi i brył, płasko cieniowanie nad mapą
  layout?: LayoutItem[];
  route?: boolean; // false: tylko tło i statystyki (np. na własnym zdjęciu)
  person?: Cutout; // wycinanka osoby lub obiektu ze zdjęcia (ADR 0009): przed tym, co zasłania częściowo
  textStyle?: TextStyle; // pogrubienie, kursywa, kontur, cień tekstu danych
  routeColor?: RouteColor; // styl linii trasy; 'theme' lub brak danych: kolor motywu (3D: nachylenie)
  progress?: number; // animacja rysowania (0..1): trasa do tego ułamka, dystans i czas rosną; 1 = gotowa pocztówka
  glow?: number; // poświata trasy 0..100; 0 = bez filtra
  mapDim?: number; // przyciemnienie mapy pod trasą 0..100; 0 = bez prostokąta
}) {
  // Jedna projekcja dla mapy i trasy („scena”).
  const polyline = activity.map.summary_polyline;
  const fit = useMemo(() => fitRoute(polyline, ROUTE_BOX), [polyline]);
  const iso = useMemo(
    () => (view === '3d' && streams && fit ? (givenIso ?? isoRoute(streams, ROUTE_BOX, fit.projection)) : null),
    [view, streams, fit, givenIso],
  );
  const showMap = background === 'map' && !!fit && !!map;
  const hasIso = !!iso;
  // W 3D z bryłami podłoga bez płaskich budynków.
  const floor = (l: MapLayers): MapLayers => (hasIso && l.buildings ? { ...l, building: undefined } : l);
  // Mapa i jej fragment w useMemo: w klatkach animacji zmienia się tylko trasa i liczby, ciężka mapa zostaje tym samym elementem.
  const out = useMemo(() => (showMap ? THEMES[theme].render(floor(map!), { accent }) : null), [showMap, theme, map, hasIso, accent]);
  const style = useMemo(() => THEMES[theme].style({ accent }), [theme, accent]);
  const relief = out ? terrain : undefined;
  // Bryły ze środkiem w ostrzejszym fragmencie biorą obrysy z niego, pozostałe z mapy bazowej.
  const buildings = useMemo((): Building[] | null => {
    if (!iso || !(map?.buildings || refined?.layers.buildings)) return null;
    const base = map?.buildings ?? [];
    if (!refined) return base;
    const [x0, y0, x1, y1] = refined.rect;
    const inside = ({ ring }: Building) => {
      const x = ring.reduce((sum, [px]) => sum + px, 0) / ring.length;
      const y = ring.reduce((sum, [, py]) => sum + py, 0) / ring.length;
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    };
    return [...base.filter((b) => !inside(b)), ...(refined.layers.buildings ?? []).filter(inside)];
  }, [iso, map, refined]);
  const lineColor = useMemo(
    () => colorScale(routeColor, streams, activity.max_heartrate) ?? undefined,
    [routeColor, streams, activity.max_heartrate],
  );
  const legend = useMemo(() => (route && fit ? routeLegend(routeColor, streams) : null), [route, fit, routeColor, streams]);
  const text = out?.text ?? { color: '#ffffff' };
  const { weight, scale } = FONTS[font];
  // Własne tło warstwy zakrywa mapę podstawową w prostokącie; defs motywu (filtry, wzory) są już w scene.
  const refinedMap = useMemo(
    () =>
      out &&
      refined && (
        <>
          <defs>
            <clipPath id="refined-clip">
              <rect
                x={refined.rect[0]}
                y={refined.rect[1]}
                width={refined.rect[2] - refined.rect[0]}
                height={refined.rect[3] - refined.rect[1]}
              />
            </clipPath>
          </defs>
          <g clipPath="url(#refined-clip)">
            <MapBackground layers={floor(refined.layers)} style={style} rect={refined.rect} />
          </g>
        </>
      ),
    [out, refined, style, hasIso],
  );

  const behind = background === 'photo' && !!photo && !!person;
  // Linia podziału trasy („obręcz”): środek jej obrysu w układzie trasy, czyli pod transformacją kamery.
  const mid = iso
    ? (iso.points.reduce((m, [, y]) => Math.min(m, y), Infinity) + iso.points.reduce((m, [, y]) => Math.max(m, y), -Infinity)) / 2
    : fit
      ? (fit.bounds[0][1] + fit.bounds[1][1]) / 2
      : 0;
  // Za obiektem zawsze tylko górna część trasy; statystyki zawsze przed (decyzja właściciela, ADR 0009).
  const splitRoute = route && behind;
  const clipped = (part: 'behind' | 'front' | undefined, node: ReactNode) =>
    part ? <g clipPath={`url(#route-${part})`}>{node}</g> : node;
  const routeInner = (part?: 'behind' | 'front') =>
    iso
      ? route && (
          <g transform={cameraTransform(camera)}>
            {clipped(
              part,
              <IsoRoute
                iso={iso}
                flat={out?.route.stroke}
                filter={out?.route.filter}
                dash={out?.route.dash}
                zoom={camera.zoom}
                onSurface={!!relief}
                color={lineColor}
                progress={progress}
                gradientId={part === 'front' ? 'iso-curtain-grad-front' : undefined}
              />,
            )}
          </g>
        )
      : fit &&
        route && (
          <g transform={cameraTransform(camera)}>{clipped(part, <Route {...out?.route} d={fit.d} zoom={camera.zoom} points={fit.points} color={lineColor} progress={progress} />)}</g>
        );
  const routeLayer = (part?: 'behind' | 'front') => {
    const node = routeInner(part);
    return glow > 0 && node ? <g filter="url(#route-glow)">{node}</g> : node;
  };
  const slotNode = (item: LayoutItem) => {
    const value = DATA[item.slot.data].value(activity);
    const chart = chartFor(item, streams); // sprawdza box i streams
    if (chart) {
      return (
        <chart.Component
          key={item.slot.id}
          box={item.box!}
          streams={streams!}
          activity={activity}
          label={chart.label}
          value={value}
          scale={scale}
        />
      );
    }
    // Rozmiar z wartości końcowej, żeby rosnąca liczba nie skakała.
    const { size, labelSize, label } = fitted(item, value, scale);
    const grows = progress < 1 && (item.slot.data === 'distance' || item.slot.data === 'time');
    const shown = grows
      ? DATA[item.slot.data].value({ ...activity, distance: activity.distance * progress, moving_time: Math.round(activity.moving_time * progress) })
      : value;
    return (
      <SlotNumber
        key={item.slot.id}
        x={item.x}
        y={item.y}
        size={size}
        scale={scale}
        anchor={item.anchor}
        labelPos={item.labelPos}
        labelSize={labelSize}
        label={label}
        value={shown}
        look={textStyle}
      />
    );
  };

  return (
    <svg
      className="postcard"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1080 1920"
      fontFamily={fontStack(font)}
      fontWeight={weight}
    >
      {fontCss && <style>{fontCss}</style>}
      {background === 'photo' && photo && <PhotoBackground {...photo} />}
      {behind && (
        <defs>
          {splitRoute && (
            <>
              <clipPath id="route-behind">
                <rect x={-1e5} y={-1e5} width={2e5} height={1e5 + mid} />
              </clipPath>
              <clipPath id="route-front">
                <rect x={-1e5} y={mid} width={2e5} height={1e5} />
              </clipPath>
            </>
          )}
          {/* Ten sam wynik co czarny prostokąt Dim z opacity = dim, bez ponownego liczenia wycinanki. */}
          <filter id="person-dim" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope={1 - photo.dim} />
              <feFuncG type="linear" slope={1 - photo.dim} />
              <feFuncB type="linear" slope={1 - photo.dim} />
            </feComponentTransfer>
          </filter>
        </defs>
      )}
      {glow > 0 && route && (
        <defs>
          {/* Jak Glow z motywu Neon; obszar = płótno, bo procent obrysu ucina albo chowa prostą trasę (zerowa wysokość). */}
          <filter id="route-glow" filterUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={4 + glow * 0.14} result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              {glow > 50 && <feMergeNode in="glow" />}
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {background === 'gradient' && <Background gradient={gradient} />}
      {iso ? (
        <g>
          {out && <rect width={1080} height={1920} fill={style.background} />}
          <g transform={cameraTransform(camera)}>
            {relief && terrainImage(relief)}
            {out && !relief && (
              // Podłoga 3D: ta sama mapa co w widoku płaskim, przekształcona macierzą izometrii; poza płótnem dochodzi fragment refined.
              <g transform={`matrix(${iso.matrix.join(' ')})`}>
                {out.scene}
                {refinedMap}
              </g>
            )}
            {out && !relief && buildings && (
              <Buildings3D
                buildings={buildings}
                matrix={iso.matrix}
                pxPerM={iso.pxPerM}
                color={style.colors.building}
                fill={style.fills?.building}
                filter={style.filters?.building}
                shape={style.buildings3d}
                accent={style.colors.mid}
              />
            )}
          </g>
          {/* Faktura papieru w przestrzeni płótna (jak w widoku płaskim), nie na pochylonej i powiększanej podłodze. */}
          {out?.overlay}
          {out && mapDim > 0 && <rect width={1080} height={1920} fill="#000" opacity={mapDim / 100} />}
          {(!behind || splitRoute) && routeLayer(splitRoute ? 'behind' : undefined)}
        </g>
      ) : (
        <g>
          {/* Przesunięta kamera odsłania obszar poza płótnem, zanim dojdą kafelki: tło motywu zamiast pustki. */}
          {out && <rect width={1080} height={1920} fill={style.background} />}
          <g transform={cameraTransform(camera)}>
            {out?.scene}
            {refinedMap}
            {relief && terrainImage(relief)}
          </g>
          {out?.overlay}
          {out && mapDim > 0 && <rect width={1080} height={1920} fill="#000" opacity={mapDim / 100} />}
          {(!behind || splitRoute) && routeLayer(splitRoute ? 'behind' : undefined)}
        </g>
      )}
      {behind && (
        <>
          <g filter="url(#person-dim)">{terrainImage(person)}</g>
          {routeLayer(splitRoute ? 'front' : undefined)}
        </>
      )}
      {textStyle?.shadow && (
        <defs>
          <filter id="text-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx={0} dy={6} stdDeviation={8} floodColor="#000000" floodOpacity={0.55} />
          </filter>
        </defs>
      )}
      <g color={text.color} filter={text.filter}>
        <g fontStyle={textStyle?.italic ? 'italic' : undefined} filter={textStyle?.shadow ? 'url(#text-shadow)' : undefined}>
          {layout.map((item) => slotNode(item))}
        </g>
      </g>
      <StravaMark x={60} y={1820} variant={out?.mark} />
      {legend && <RouteLegend legend={legend} color={text.color} />}
      {out && (
        <text
          transform={`translate(${ATTRIBUTION_AT.join(' ')}) rotate(-90)`}
          fontSize={18}
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
          fill={text.color}
          opacity={0.6}
        >
          {relief ? `${MAP_ATTRIBUTION} · ${TERRAIN_ATTRIBUTION}` : MAP_ATTRIBUTION}
        </text>
      )}
    </svg>
  );
}
