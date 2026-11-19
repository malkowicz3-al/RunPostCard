import type { RunStreams } from '../strava/api';

// Strumienie do 3D widoku „Together” na czas otwartej karty, tylko w pamięci:
// sessionStorage mógłby się zapełnić i zablokować zapis sesji logowania.
export const streamCache = new Map<number, RunStreams | null>();

// Przy wylogowaniu i wygaśnięciu sesji: to dane o położeniu.
export const clearStreamCache = () => streamCache.clear();
