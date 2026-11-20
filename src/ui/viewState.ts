// Jeden przycisk 2D/3D: przełącza widok; bez danych do 3D zostaje płasko.
export type View = 'flat' | '3d';

export const toggleView = (v: View, has3d: boolean): View => (has3d && v === 'flat' ? '3d' : 'flat');
