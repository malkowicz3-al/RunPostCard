// Typ biegu ze Stravy (workout_type: 0/null zwykły, 1 zawody, 2 długi, 3 trening jakościowy); lista i pocztówka.
export type RunKind = 'training' | 'long' | 'workout' | 'race';
const KINDS: Record<number, RunKind> = { 1: 'race', 2: 'long', 3: 'workout' };
export const RUN_TAGS: Record<RunKind, string> = { training: 'TRAINING', long: 'LONG RUN', workout: 'WORKOUT', race: 'RACE' };

export const runKind = (workoutType?: number | null): RunKind => KINDS[workoutType ?? 0] ?? 'training';
