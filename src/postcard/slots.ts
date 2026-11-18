import type { ComponentType } from 'react';
import type { Activity } from '../strava/api';
import {
  formatDate,
  formatDistanceKm,
  formatDuration,
  formatHeartRate,
  formatPace,
} from '../lib/format';
import { SlotNumber, type SlotProps } from './SlotNumber';

// Slot = co pokazać (data) + jak narysować (form). Nowe dane/formy dopisujemy tylko do rejestrów.
export type SlotData = 'distance' | 'time' | 'pace' | 'heartrate' | 'date';
export type SlotForm = 'number';

export type Slot = { id: string; data: SlotData; form: SlotForm };

// Pozycja i rozmiar na płótnie 1080x1920 (współrzędne środka tekstu).
export type LayoutItem = { slot: Slot; x: number; y: number; size: number };

export const DATA: Record<SlotData, { label: string; value: (a: Activity) => string }> = {
  distance: { label: 'DISTANCE (KM)', value: (a) => formatDistanceKm(a.distance) },
  time: { label: 'TIME', value: (a) => formatDuration(a.moving_time) },
  pace: { label: 'PACE (/KM)', value: (a) => formatPace(a.distance, a.moving_time) },
  heartrate: { label: 'AVG HR', value: (a) => formatHeartRate(a.average_heartrate) },
  date: { label: 'DATE', value: (a) => formatDate(a.start_date_local) },
};

export const FORMS: Record<SlotForm, ComponentType<SlotProps>> = {
  number: SlotNumber,
};

export const defaultLayout: LayoutItem[] = [
  { slot: { id: 'distance', data: 'distance', form: 'number' }, x: 540, y: 1420, size: 300 },
  { slot: { id: 'time', data: 'time', form: 'number' }, x: 270, y: 1640, size: 100 },
  { slot: { id: 'pace', data: 'pace', form: 'number' }, x: 540, y: 1640, size: 100 },
  { slot: { id: 'heartrate', data: 'heartrate', form: 'number' }, x: 810, y: 1640, size: 100 },
  { slot: { id: 'date', data: 'date', form: 'number' }, x: 540, y: 1790, size: 56 },
];
