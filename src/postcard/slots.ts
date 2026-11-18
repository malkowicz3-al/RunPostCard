import type { ComponentType } from 'react';
import type { Activity } from '../strava/api';
import {
  formatCadence,
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatElapsed,
  formatElevation,
  formatHeartRate,
  formatName,
  formatPace,
  formatSpeedKmh,
  formatTime,
} from '../lib/format';
import { labelAboveY, SlotNumber, type LabelPos, type SlotAnchor, type SlotProps } from './SlotNumber';

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
  | 'name';
export type SlotForm = 'number';

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
};

export const FORMS: Record<SlotForm, ComponentType<SlotProps>> = {
  number: SlotNumber,
};

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
  | 'bigPair';

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
];

// Zmiany danych w slotach jednego układu: id slotu -> dane.
export type Overrides = Partial<Record<string, SlotData>>;

export function resolveLayout(id: LayoutId, overrides?: Overrides): LayoutItem[] {
  return LAYOUTS[id].items.map((i) => {
    const data = overrides?.[i.slot.id];
    return data ? { ...i, slot: { ...i.slot, data } } : i;
  });
}

export const defaultLayout = resolveLayout('classic');

// Dane już pokazane w innym slocie zamieniają się miejscami, żeby nic się nie powtarzało.
export function swapSlot(items: LayoutItem[], slotId: string, data: SlotData): Overrides {
  const map: Overrides = Object.fromEntries(items.map((i) => [i.slot.id, i.slot.data]));
  const target = map[slotId];
  if (!target || target === data) return map;
  const other = items.find((i) => i.slot.data === data);
  if (other) map[other.slot.id] = target;
  map[slotId] = data;
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
export function slotBox(item: LayoutItem, value: string, scale: number): Box {
  const { size, labelSize, labelWidth } = fitted(item, value, scale);
  const pos = item.labelPos ?? 'below';
  const w = Math.max(est(value) * size, pos === 'none' ? 0 : labelWidth);
  const x0 = item.anchor === 'start' ? item.x : item.anchor === 'end' ? item.x - w : item.x - w / 2;
  const top = item.y - 0.75 * size;
  const y0 = pos === 'above' ? labelAboveY(item.y, size) - 0.75 * labelSize * scale : top;
  const y1 = pos === 'below' ? item.y + 68 : item.y + 0.2 * size;
  return { x0, y0, x1: x0 + w, y1 };
}
