import type { ComponentType } from 'react';
import type { Activity, RunStreams } from '../strava/api';
import {
  bestSplits,
  cadenceBins,
  climbRates,
  halfHr,
  halfSplits,
  hrBins,
  kmGrades,
  kmSplits,
  paceBins,
  pacingSeries,
  series,
  speedHr,
} from '../lib/chartData';
import {
  formatCadence,
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatElapsed,
  formatElevPerKm,
  formatElevation,
  formatHeartRate,
  formatName,
  formatPace,
  formatRunType,
  formatSpeedKmh,
  formatSteps,
  formatStopped,
  formatTime,
  formatWeekday,
} from '../lib/format';
import {
  AreaChart,
  BarsChart,
  BestChart,
  CadenceChart,
  GainChart,
  GradeChart,
  HrBinsChart,
  LineChart,
  RingChart,
  ScatterChart,
  SparkChart,
  SpeedChart,
  type ChartProps,
} from './SlotChart';
import {
  CadenceHistChart,
  ClimbRateChart,
  EcgChart,
  GaugeChart,
  GoalChart,
  HalvesChart,
  PaceElevChart,
  PaceLineChart,
  PolarChart,
  SkylineChart,
  SplitListChart,
  SwarmChart,
  TrioChart,
  ZoneBarChart,
} from './SlotCharts2';
import { HrDriftChart, PaceBinsChart, PacingChart, PaceStripChart, SplitDeltaChart } from './SlotCharts3';
import { labelAboveY, type LabelPos, type SlotAnchor } from './SlotNumber';

// Slot = co pokazać (data) + jak narysować (form). Nowe dane/formy dopisujemy tylko do rejestrów.
export type SlotData =
  | 'distance'
  | 'time'
  | 'elapsed'
  | 'pace'
  | 'heartrate'
  | 'maxhr'
  | 'elevation'
  | 'speed'
  | 'maxspeed'
  | 'cadence'
  | 'date'
  | 'start'
  | 'name'
  | 'stopped'
  | 'elevkm'
  | 'steps'
  | 'weekday'
  | 'runtype';
export type ChartForm =
  | 'area'
  | 'line'
  | 'bars'
  | 'ring'
  | 'speed'
  | 'cadence'
  | 'hrbins'
  | 'grade'
  | 'gain'
  | 'scatter'
  | 'best'
  | 'spark'
  | 'paceline'
  | 'zonebar'
  | 'splitlist'
  | 'paceelev'
  | 'polar'
  | 'gauge'
  | 'goal'
  | 'swarm'
  | 'skyline'
  | 'cadhist'
  | 'ecg'
  | 'halves'
  | 'climbrate'
  | 'trio'
  | 'pacebins'
  | 'hrdrift'
  | 'splitdelta'
  | 'pacestrip'
  | 'pacing';
export type SlotForm = 'number' | ChartForm;

// id to klucz pozycji w układzie ('main', 'a', 'b'…), nie rodzaj danych.
export type Slot = { id: string; data: SlotData; form: SlotForm };

// Na płótnie 1080x1920: y = linia bazowa wartości, size przed mnożnikiem fontu, maxW = maks. szerokość tekstu.
export type LayoutItem = {
  slot: Slot;
  x: number;
  y: number;
  size: number;
  anchor: SlotAnchor;
  maxW: number;
  labelPos?: LabelPos;
  labelSize?: number;
  box?: Box; // tylko sloty z box przyjmują wykresy; pola liczby wylicza z niego numberIn
};

export const DATA: Record<SlotData, { label: string; menu: string; value: (a: Activity) => string }> = {
  distance: { label: 'DISTANCE (KM)', menu: 'Distance', value: (a) => formatDistanceKm(a.distance) },
  time: { label: 'TIME', menu: 'Moving time', value: (a) => formatDuration(a.moving_time) },
  elapsed: { label: 'ELAPSED', menu: 'Elapsed time', value: (a) => formatElapsed(a.elapsed_time) },
  pace: { label: 'PACE (/KM)', menu: 'Pace', value: (a) => formatPace(a.distance, a.moving_time) },
  heartrate: { label: 'AVG HR', menu: 'Average heart rate', value: (a) => formatHeartRate(a.average_heartrate) },
  maxhr: { label: 'MAX HR', menu: 'Max heart rate', value: (a) => formatHeartRate(a.max_heartrate) },
  elevation: { label: 'ELEV GAIN (M)', menu: 'Elevation gain', value: (a) => formatElevation(a.total_elevation_gain) },
  speed: { label: 'SPEED (KM/H)', menu: 'Average speed', value: (a) => formatSpeedKmh(a.average_speed) },
  maxspeed: { label: 'MAX SPEED (KM/H)', menu: 'Max speed', value: (a) => formatSpeedKmh(a.max_speed) },
  cadence: { label: 'CADENCE (SPM)', menu: 'Cadence', value: (a) => formatCadence(a.average_cadence) },
  date: { label: 'DATE', menu: 'Date', value: (a) => formatDate(a.start_date_local) },
  start: { label: 'START', menu: 'Start time', value: (a) => formatTime(a.start_date_local) },
  name: { label: 'RUN', menu: 'Run name', value: (a) => formatName(a.name) },
  stopped: { label: 'STOPPED', menu: 'Stopped time', value: (a) => formatStopped(a.moving_time, a.elapsed_time) },
  elevkm: { label: 'ELEV / KM', menu: 'Elevation per km', value: (a) => formatElevPerKm(a.total_elevation_gain, a.distance) },
  steps: { label: 'STEPS', menu: 'Steps', value: (a) => formatSteps(a.average_cadence, a.moving_time) },
  weekday: { label: 'DAY', menu: 'Weekday', value: (a) => formatWeekday(a.start_date_local) },
  runtype: { label: 'RUN TYPE', menu: 'Run type', value: (a) => formatRunType(a.workout_type) },
};

// Wykres = forma dla jednych danych; bez strumieni (has = false) slot pokazuje liczbę tych danych.
export const CHARTS: Record<
  ChartForm,
  { data: SlotData; menu: string; label: string; has: (s: RunStreams) => boolean; Component: ComponentType<ChartProps> }
> = {
  area: { data: 'elevation', menu: 'Elevation profile', label: 'ELEVATION', has: (s) => series(s, 'altitude', 2).length > 0, Component: AreaChart },
  line: { data: 'heartrate', menu: 'Heart rate chart', label: 'HEART RATE', has: (s) => series(s, 'heartrate', 2).length > 0, Component: LineChart },
  bars: { data: 'pace', menu: 'Pace per km', label: 'PACE PER KM', has: (s) => kmSplits(s).length > 0, Component: BarsChart },
  ring: { data: 'heartrate', menu: 'Heart rate zones', label: 'HR ZONES', has: (s) => series(s, 'heartrate', 2).length > 0, Component: RingChart },
  speed: { data: 'speed', menu: 'Speed chart', label: 'SPEED', has: (s) => series(s, 'velocity', 2).length > 0, Component: SpeedChart },
  cadence: { data: 'cadence', menu: 'Cadence chart', label: 'CADENCE', has: (s) => series(s, 'cadence', 2).length > 0, Component: CadenceChart },
  hrbins: { data: 'heartrate', menu: 'Heart rate histogram', label: 'HR SPREAD', has: (s) => hrBins(s).length > 0, Component: HrBinsChart },
  grade: { data: 'elevation', menu: 'Grade per km', label: 'GRADE PER KM', has: (s) => kmGrades(s).length > 0, Component: GradeChart },
  gain: { data: 'elevation', menu: 'Cumulative climb', label: 'CLIMB', has: (s) => series(s, 'altitude', 2).length > 0, Component: GainChart },
  scatter: { data: 'pace', menu: 'Speed vs heart rate', label: 'SPEED VS HR', has: (s) => speedHr(s).length > 1, Component: ScatterChart },
  best: { data: 'pace', menu: 'Fastest km', label: 'FASTEST KM', has: (s) => bestSplits(s).length > 0, Component: BestChart },
  spark: { data: 'elevation', menu: 'Elevation spark', label: 'ELEVATION GAIN', has: (s) => series(s, 'altitude', 2).length > 0, Component: SparkChart },
  paceline: { data: 'pace', menu: 'Pace line', label: 'PACE', has: (s) => series(s, 'velocity', 2).length > 0, Component: PaceLineChart },
  zonebar: { data: 'heartrate', menu: 'Zone bar', label: 'TIME IN ZONES', has: (s) => series(s, 'heartrate', 2).length > 0, Component: ZoneBarChart },
  splitlist: { data: 'pace', menu: 'Split list', label: 'SPLITS', has: (s) => kmSplits(s).length > 0, Component: SplitListChart },
  paceelev: {
    data: 'pace',
    menu: 'Pace and elevation',
    label: 'PACE + HILLS',
    has: (s) => series(s, 'velocity', 2).length > 0 && series(s, 'altitude', 2).length > 0,
    Component: PaceElevChart,
  },
  polar: { data: 'pace', menu: 'Pace wheel', label: 'KM WHEEL', has: (s) => kmSplits(s).length > 1, Component: PolarChart },
  gauge: { data: 'heartrate', menu: 'Heart rate gauge', label: 'HR GAUGE', has: (s) => series(s, 'heartrate', 2).length > 0, Component: GaugeChart },
  goal: { data: 'distance', menu: 'Distance goal', label: 'DISTANCE GOAL', has: (s) => s.distance.length > 1, Component: GoalChart },
  swarm: { data: 'pace', menu: 'Pace dots', label: 'KM SPREAD', has: (s) => kmSplits(s).length > 1, Component: SwarmChart },
  skyline: { data: 'elevation', menu: 'Elevation skyline', label: 'PROFILE', has: (s) => series(s, 'altitude', 2).length > 0, Component: SkylineChart },
  cadhist: { data: 'cadence', menu: 'Cadence histogram', label: 'STEP SPREAD', has: (s) => cadenceBins(s).length > 0, Component: CadenceHistChart },
  ecg: { data: 'heartrate', menu: 'Pulse line', label: 'PULSE', has: (s) => series(s, 'heartrate', 2).length > 0, Component: EcgChart },
  halves: { data: 'pace', menu: 'Half splits', label: 'HALVES', has: (s) => halfSplits(s) !== null, Component: HalvesChart },
  climbrate: { data: 'elevation', menu: 'Climb rate', label: 'CLIMB RATE', has: (s) => climbRates(s).length > 0, Component: ClimbRateChart },
  trio: { data: 'elapsed', menu: 'Highlights', label: 'HIGHLIGHTS', has: (s) => s.distance.length > 1, Component: TrioChart },
  pacebins: { data: 'pace', menu: 'Pace histogram', label: 'PACE SPREAD', has: (s) => paceBins(s).length > 0, Component: PaceBinsChart },
  hrdrift: { data: 'heartrate', menu: 'Heart rate drift', label: 'HR DRIFT', has: (s) => halfHr(s) !== null, Component: HrDriftChart },
  splitdelta: { data: 'pace', menu: 'Splits vs average', label: 'VS AVERAGE', has: (s) => kmSplits(s).length > 1, Component: SplitDeltaChart },
  pacestrip: { data: 'pace', menu: 'Pace strip', label: 'PACE MAP', has: (s) => series(s, 'velocity', 2).length > 0, Component: PaceStripChart },
  pacing: { data: 'time', menu: 'Even pace', label: 'EVEN PACE', has: (s) => pacingSeries(s, 2).length > 0, Component: PacingChart },
};

export const slotMenu = (s: Slot) => (s.form === 'number' ? DATA[s.data].menu : CHARTS[s.form].menu);

// Wykresy wzdłuż dystansu: w animacji odsłaniają się z trasą. Reszta (km, strefy, histogramy) stoi gotowa.
export const ALONG_ROUTE: ReadonlySet<ChartForm> = new Set<ChartForm>([
  'area', 'line', 'speed', 'cadence', 'gain', 'spark', 'paceline', 'paceelev', 'skyline', 'ecg', 'pacestrip', 'pacing',
]);

// Wykres do narysowania w slocie albo null (wtedy liczba tych samych danych).
export function chartFor(item: LayoutItem, streams: RunStreams | null | undefined) {
  const { form } = item.slot;
  return form !== 'number' && item.box && streams && CHARTS[form].has(streams) ? CHARTS[form] : null;
}

export type LayoutId =
  | 'classic'
  | 'hero'
  | 'grid'
  | 'dashboard'
  | 'stackLeft'
  | 'topBottom'
  | 'minimal'
  | 'magazine'
  | 'corners'
  | 'bigPair'
  | 'poster'
  | 'hud'
  | 'scoreboard'
  | 'splits'
  | 'pulse'
  | 'duo'
  | 'climb'
  | 'strip'
  | 'table'
  | 'sidebar'
  | 'ticker'
  | 'halfPair'
  | 'stacked'
  | 'compare'
  | 'paceHero'
  | 'spread'
  | 'drift'
  | 'paceMap'
  | 'even';

const item = (
  id: string,
  data: SlotData,
  x: number,
  y: number,
  size: number,
  anchor: SlotAnchor,
  maxW: number,
  labelPos?: LabelPos,
): LayoutItem => ({ slot: { id, data, form: 'number' }, x, y, size, anchor, maxW, ...(labelPos && { labelPos }) });

// Liczba z etykietą pod spodem, wyśrodkowana w box (z zapasem na skalę fontu do 1.1).
export function numberIn(box: Box): Pick<LayoutItem, 'x' | 'y' | 'size' | 'anchor' | 'maxW'> {
  return {
    x: (box.x0 + box.x1) / 2,
    y: box.y1 - 78,
    size: Math.min(220, (box.y1 - box.y0 - 90) / 0.85),
    anchor: 'middle',
    maxW: box.x1 - box.x0 - 40,
  };
}

const chart = (id: string, form: ChartForm, x0: number, y0: number, x1: number, y1: number): LayoutItem => {
  const box = { x0, y0, x1, y1 };
  return { slot: { id, data: CHARTS[form].data, form }, box, ...numberIn(box) };
};

export const LAYOUTS: Record<LayoutId, { id: LayoutId; name: string; items: LayoutItem[] }> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    items: [
      item('main', 'distance', 540, 1420, 300, 'middle', 960),
      item('a', 'time', 270, 1640, 100, 'middle', 240),
      item('b', 'pace', 540, 1640, 100, 'middle', 240),
      item('c', 'heartrate', 810, 1640, 100, 'middle', 240),
      // Bez etykiety: z nią prostokąt slotu nachodzi na znak Stravy i podpis mapy.
      item('d', 'date', 540, 1790, 56, 'middle', 400, 'none'),
    ],
  },
  hero: {
    id: 'hero',
    name: 'Hero',
    items: [
      item('main', 'distance', 540, 1560, 380, 'middle', 960),
      item('a', 'time', 300, 1730, 90, 'middle', 440),
      item('b', 'pace', 780, 1730, 90, 'middle', 440),
    ],
  },
  grid: {
    id: 'grid',
    name: 'Grid 2x2',
    items: [
      item('a', 'distance', 300, 1360, 170, 'middle', 440),
      item('b', 'time', 780, 1360, 170, 'middle', 440),
      item('c', 'pace', 300, 1620, 170, 'middle', 440),
      item('d', 'heartrate', 780, 1620, 170, 'middle', 440),
    ],
  },
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    items: [
      item('a', 'distance', 200, 1360, 120, 'middle', 300),
      item('b', 'time', 540, 1360, 120, 'middle', 300),
      item('c', 'pace', 880, 1360, 120, 'middle', 300),
      item('d', 'heartrate', 200, 1620, 120, 'middle', 300),
      item('e', 'elevation', 540, 1620, 120, 'middle', 300),
      item('f', 'date', 880, 1620, 120, 'middle', 300),
    ],
  },
  stackLeft: {
    id: 'stackLeft',
    name: 'Stack left',
    items: [
      item('main', 'distance', 70, 1370, 200, 'start', 940),
      item('a', 'time', 70, 1540, 110, 'start', 440),
      item('b', 'pace', 70, 1710, 110, 'start', 440),
      item('c', 'heartrate', 1010, 1710, 110, 'end', 440),
    ],
  },
  topBottom: {
    id: 'topBottom',
    name: 'Top & bottom',
    items: [
      item('a', 'date', 60, 150, 64, 'start', 480),
      item('b', 'time', 1020, 150, 64, 'end', 480),
      item('main', 'distance', 540, 1480, 260, 'middle', 960),
      item('c', 'pace', 300, 1700, 110, 'middle', 440),
      item('d', 'heartrate', 780, 1700, 110, 'middle', 440),
    ],
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    items: [item('main', 'distance', 540, 1560, 420, 'middle', 960)],
  },
  magazine: {
    id: 'magazine',
    name: 'Magazine',
    items: [
      item('name', 'name', 60, 170, 100, 'start', 960, 'none'),
      item('date', 'date', 60, 225, 40, 'start', 600, 'none'),
      item('main', 'distance', 60, 1480, 300, 'start', 960),
      item('a', 'time', 60, 1700, 100, 'start', 440),
      item('b', 'pace', 540, 1700, 100, 'start', 440),
    ],
  },
  corners: {
    id: 'corners',
    name: 'Corners',
    items: [
      item('a', 'distance', 60, 150, 80, 'start', 460),
      item('b', 'time', 1020, 150, 80, 'end', 460),
      item('c', 'pace', 60, 1720, 80, 'start', 460),
      item('d', 'heartrate', 1020, 1720, 80, 'end', 460),
    ],
  },
  bigPair: {
    id: 'bigPair',
    name: 'Big pair',
    items: [
      item('main', 'distance', 540, 1410, 240, 'middle', 960),
      item('a', 'time', 540, 1690, 240, 'middle', 960),
    ],
  },
  // Wykresy pod polem trasy (y >= 1200) i nad znakiem Stravy (y < 1820).
  poster: {
    id: 'poster',
    name: 'Poster',
    items: [item('main', 'distance', 540, 1440, 220, 'middle', 960), chart('chart', 'area', 60, 1530, 1020, 1800)],
  },
  hud: {
    id: 'hud',
    name: 'HUD',
    items: [
      item('a', 'distance', 60, 150, 80, 'start', 460),
      item('b', 'time', 1020, 150, 80, 'end', 460),
      chart('chart', 'line', 60, 1210, 1020, 1480),
      item('c', 'pace', 60, 1640, 100, 'start', 440),
      item('d', 'heartrate', 1020, 1640, 100, 'end', 440),
    ],
  },
  scoreboard: {
    id: 'scoreboard',
    name: 'Scoreboard',
    items: [
      item('a', 'distance', 200, 1320, 110, 'middle', 300),
      item('b', 'time', 540, 1320, 110, 'middle', 300),
      item('c', 'heartrate', 880, 1320, 110, 'middle', 300),
      chart('chart', 'bars', 60, 1420, 1020, 1790),
    ],
  },
  splits: {
    id: 'splits',
    name: 'Split sheet',
    items: [
      chart('chart', 'bars', 60, 1200, 1020, 1600),
      item('a', 'distance', 300, 1700, 100, 'middle', 440),
      item('b', 'time', 780, 1700, 100, 'middle', 440),
    ],
  },
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    items: [
      chart('chart', 'ring', 60, 1210, 1020, 1580),
      item('a', 'distance', 200, 1700, 100, 'middle', 300),
      item('b', 'time', 540, 1700, 100, 'middle', 300),
      item('c', 'pace', 880, 1700, 100, 'middle', 300),
    ],
  },
  duo: {
    id: 'duo',
    name: 'Two charts',
    items: [
      item('a', 'distance', 200, 1320, 110, 'middle', 300),
      item('b', 'time', 540, 1320, 110, 'middle', 300),
      item('c', 'pace', 880, 1320, 110, 'middle', 300),
      chart('left', 'speed', 60, 1420, 520, 1790),
      chart('right', 'cadence', 560, 1420, 1020, 1790),
    ],
  },
  climb: {
    id: 'climb',
    name: 'Climb',
    items: [
      chart('chart', 'grade', 60, 1200, 1020, 1470),
      item('a', 'distance', 300, 1690, 110, 'middle', 440),
      chart('gain', 'gain', 560, 1500, 1020, 1790),
    ],
  },
  // Pasek nad polem trasy (y < 260).
  strip: {
    id: 'strip',
    name: 'Top strip',
    items: [
      chart('chart', 'spark', 60, 40, 1020, 240),
      item('main', 'distance', 540, 1480, 260, 'middle', 960),
      item('a', 'time', 300, 1700, 110, 'middle', 440),
      item('b', 'pace', 780, 1700, 110, 'middle', 440),
    ],
  },
  table: {
    id: 'table',
    name: 'Stats & table',
    items: [
      item('main', 'distance', 70, 1350, 150, 'start', 440),
      item('a', 'time', 70, 1540, 110, 'start', 440),
      item('b', 'heartrate', 70, 1710, 110, 'start', 440),
      chart('chart', 'best', 560, 1210, 1020, 1790),
    ],
  },
  sidebar: {
    id: 'sidebar',
    name: 'Sidebar',
    items: [
      chart('chart', 'paceline', 60, 1210, 640, 1790),
      item('a', 'distance', 1020, 1300, 90, 'end', 340),
      item('b', 'time', 1020, 1510, 90, 'end', 340),
      item('c', 'heartrate', 1020, 1720, 90, 'end', 340),
    ],
  },
  ticker: {
    id: 'ticker',
    name: 'Ticker',
    items: [
      chart('chart', 'paceelev', 60, 1200, 1020, 1560),
      item('a', 'distance', 180, 1700, 80, 'middle', 210),
      item('b', 'time', 420, 1700, 80, 'middle', 210),
      item('c', 'pace', 660, 1700, 80, 'middle', 210),
      item('d', 'heartrate', 900, 1700, 80, 'middle', 210),
    ],
  },
  halfPair: {
    id: 'halfPair',
    name: 'Half pair',
    items: [
      item('main', 'distance', 540, 1440, 220, 'middle', 960),
      chart('left', 'polar', 60, 1530, 520, 1800),
      chart('right', 'gauge', 560, 1530, 1020, 1800),
    ],
  },
  stacked: {
    id: 'stacked',
    name: 'Chart stack',
    items: [
      chart('goal', 'goal', 60, 40, 1020, 240),
      chart('chart', 'ecg', 60, 1200, 1020, 1480),
      chart('zones', 'zonebar', 60, 1510, 1020, 1790),
    ],
  },
  compare: {
    id: 'compare',
    name: 'Split compare',
    items: [
      chart('chart', 'halves', 60, 1200, 1020, 1500),
      item('a', 'distance', 300, 1690, 110, 'middle', 440),
      chart('splits', 'splitlist', 560, 1530, 1020, 1800),
    ],
  },
  paceHero: {
    id: 'paceHero',
    name: 'Pace hero',
    items: [
      item('main', 'pace', 540, 1480, 240, 'middle', 960),
      item('a', 'distance', 300, 1700, 110, 'middle', 440),
      item('b', 'time', 780, 1700, 110, 'middle', 440),
    ],
  },
  spread: {
    id: 'spread',
    name: 'Pace spread',
    items: [
      chart('chart', 'pacebins', 60, 1200, 1020, 1500),
      item('a', 'distance', 300, 1700, 110, 'middle', 440),
      item('b', 'time', 780, 1700, 110, 'middle', 440),
    ],
  },
  drift: {
    id: 'drift',
    name: 'HR drift',
    items: [
      item('main', 'pace', 70, 1350, 150, 'start', 440),
      item('a', 'distance', 70, 1540, 110, 'start', 440),
      item('b', 'time', 70, 1710, 110, 'start', 440),
      chart('chart', 'hrdrift', 560, 1210, 1020, 1790),
    ],
  },
  paceMap: {
    id: 'paceMap',
    name: 'Pace map',
    items: [
      chart('chart', 'pacestrip', 60, 40, 1020, 240),
      item('main', 'distance', 540, 1480, 260, 'middle', 960),
      item('a', 'time', 300, 1700, 110, 'middle', 440),
      item('b', 'heartrate', 780, 1700, 110, 'middle', 440),
    ],
  },
  even: {
    id: 'even',
    name: 'Even pace',
    items: [
      chart('chart', 'pacing', 60, 1200, 1020, 1500),
      item('a', 'distance', 180, 1700, 80, 'middle', 210),
      item('b', 'elapsed', 420, 1700, 80, 'middle', 210),
      item('c', 'pace', 660, 1700, 80, 'middle', 210),
      item('d', 'heartrate', 900, 1700, 80, 'middle', 210),
    ],
  },
};

export const LAYOUT_ORDER: LayoutId[] = [
  'classic',
  'hero',
  'grid',
  'dashboard',
  'stackLeft',
  'topBottom',
  'minimal',
  'magazine',
  'corners',
  'bigPair',
  'poster',
  'hud',
  'scoreboard',
  'splits',
  'pulse',
  'duo',
  'climb',
  'strip',
  'table',
  'sidebar',
  'ticker',
  'halfPair',
  'stacked',
  'compare',
  'paceHero',
  'spread',
  'drift',
  'paceMap',
  'even',
];

// Zmiany w slotach jednego układu: id slotu -> dane i forma.
export type SlotPick = { data: SlotData; form: SlotForm };
export type Overrides = Partial<Record<string, SlotPick>>;

export function resolveLayout(id: LayoutId, overrides?: Overrides): LayoutItem[] {
  return LAYOUTS[id].items.map((i) => {
    const o = overrides?.[i.slot.id];
    return o ? { ...i, slot: { ...i.slot, ...o } } : i;
  });
}

export const defaultLayout = resolveLayout('classic');

const same = (a: SlotPick, b: SlotPick) => a.data === b.data && a.form === b.form;

// Para już pokazana w innym slocie zamienia się miejscami, żeby nic się nie powtarzało. Wyjątek: tamten slot
// bez box nie przyjmie wypieranego wykresu, więc wtedy bez zamiany (powtórzenie dopuszczone).
export function swapSlot(items: LayoutItem[], slotId: string, pick: SlotPick): Overrides {
  const map: Overrides = Object.fromEntries(items.map((i) => [i.slot.id, { data: i.slot.data, form: i.slot.form }]));
  const self = items.find((i) => i.slot.id === slotId);
  const target = map[slotId];
  if (!self || !target || same(target, pick) || (pick.form !== 'number' && !self.box)) return map;
  const other = items.find((i) => i.slot.id !== slotId && same(i.slot, pick));
  if (other && (target.form === 'number' || other.box)) map[other.slot.id] = target;
  map[slotId] = pick;
  return map;
}

// Szerokość tekstu w em: przybliżenie bez pomiaru w przeglądarce (działa też w testach i eksporcie).
export function est(text: string): number {
  let em = 0;
  for (const ch of text) em += /\d/.test(ch) ? 0.55 : ': .,–'.includes(ch) ? 0.3 : 0.62;
  return em;
}

// Rozmiar fontu, przy którym tekst mieści się w maxW; nigdy nie powiększa. Bez dolnej granicy:
// 28-znakowa nazwa przy granicy 0.35 nie mieści się w żadnym slocie i nachodzi na sąsiadów.
export function fitSize(value: string, fs: number, maxW: number): number {
  const em = est(value);
  return em > 0 ? Math.min(fs, maxW / em) : fs;
}

// Etykieta ma odstęp liter labelSize/9 na znak, więc liczy się do szerokości.
const labelEm = (label: string) => est(label) + Array.from(label).length / 9;

// Rozmiary po skali fontu i dopasowaniu; labelSize przed skalą (tak jak bierze go SlotNumber).
export function fitted(item: LayoutItem, value: string, scale: number) {
  const size = fitSize(value, item.size * scale, item.maxW);
  const label = DATA[item.slot.data].label;
  const ls = (item.labelSize ?? 36) * scale;
  const labelSize = Math.min(ls, item.maxW / labelEm(label)) / scale;
  return { size, labelSize, label, labelWidth: labelEm(label) * labelSize * scale };
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

// Prostokąt zajęty przez wartość i etykietę (szacunek); dla nakładki, miniatur i testów geometrii.
// Slot z box zajmuje cały box (wykres albo liczba w nim).
export function slotBox(item: LayoutItem, value: string, scale: number): Box {
  if (item.box) return item.box;
  const { size, labelSize, labelWidth } = fitted(item, value, scale);
  const pos = item.labelPos ?? 'below';
  const w = Math.max(est(value) * size, pos === 'none' ? 0 : labelWidth);
  const x0 = item.anchor === 'start' ? item.x : item.anchor === 'end' ? item.x - w : item.x - w / 2;
  const top = item.y - 0.75 * size;
  const y0 = pos === 'above' ? labelAboveY(item.y, size) - 0.75 * labelSize * scale : top;
  const y1 = pos === 'below' ? item.y + 68 : item.y + 0.2 * size;
  return { x0, y0, x1: x0 + w, y1 };
}
