import { describe, expect, it } from 'vitest';
import { swipeDirection } from '../../src/game/input';

describe('swipeDirection', () => {
  it('ignores short movements (still a plain tap)', () => {
    expect(swipeDirection(10, -12)).toBeNull();
    expect(swipeDirection(0, 0)).toBeNull();
  });

  it('classifies by the dominant axis; screen y grows downwards', () => {
    expect(swipeDirection(4, -40)).toBe('up');
    expect(swipeDirection(-6, 35)).toBe('down');
    expect(swipeDirection(-50, 20)).toBe('left');
    expect(swipeDirection(30, -10)).toBe('right');
  });

  it('respects a custom threshold', () => {
    expect(swipeDirection(0, -20, 15)).toBe('up');
    expect(swipeDirection(0, -20, 30)).toBeNull();
  });
});
