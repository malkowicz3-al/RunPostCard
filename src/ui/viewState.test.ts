import { describe, expect, it } from 'vitest';
import { toggleView } from './viewState';

describe('toggleView', () => {
  it('przełącza 2D/3D, bez 3D zawsze płasko', () => {
    expect(toggleView('flat', true)).toBe('3d');
    expect(toggleView('3d', true)).toBe('flat');
    expect(toggleView('flat', false)).toBe('flat');
    expect(toggleView('3d', false)).toBe('flat');
  });
});
