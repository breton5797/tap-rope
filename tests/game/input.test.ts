import { describe, expect, it } from 'vitest';
import { keyAction, laneSwipe, sideOf, swipeDirection, actionSwipe } from '../../src/game/input';

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

describe('v5 split controls', () => {
  it('the left half of the canvas is the lane pad, the right half is jump / slide', () => {
    expect(sideOf(10, 360)).toBe('lane');
    expect(sideOf(179, 360)).toBe('lane');
    expect(sideOf(180, 360)).toBe('action');
    expect(sideOf(350, 360)).toBe('action');
  });

  it('a vertical left-thumb swipe maps to a lane direction (up = far = −1)', () => {
    expect(laneSwipe(2, -30)).toBe(-1);
    expect(laneSwipe(-3, 28)).toBe(1);
    expect(laneSwipe(0, -10)).toBeNull(); // too short (< 22px)
    expect(laneSwipe(40, 10)).toBeNull(); // horizontal: no lane meaning
  });

  it('keyboard: ↑↓ lanes, Space/Enter jump, Shift/S slide', () => {
    expect(keyAction('ArrowUp')).toEqual({ lane: -1 });
    expect(keyAction('ArrowDown')).toEqual({ lane: 1 });
    expect(keyAction(' ')).toBe('tap');
    expect(keyAction('Enter')).toBe('tap');
    expect(keyAction('Shift')).toBe('slide');
    expect(keyAction('s')).toBe('slide');
    expect(keyAction('Escape')).toBe('pause');
    expect(keyAction('w')).toBeNull();
  });
});

describe('actionSwipe (R5: slow ↓ drag at a slide tutorial stop)', () => {
  it('normal play keeps the 240 ms window (gameplay / replay unchanged)', () => {
    expect(actionSwipe(0, 40, 200, false)).toBe('down');
    expect(actionSwipe(0, 120, 1000, false)).toBeNull();
  });
  it('while a slide stop is up a slow net ↓ of 26 px counts, with no time limit; other directions keep the window', () => {
    expect(actionSwipe(0, 120, 1000, true)).toBe('down');
    expect(actionSwipe(0, 26, 3000, true)).toBe('down');
    expect(actionSwipe(0, 20, 3000, true)).toBeNull();
    expect(actionSwipe(0, -120, 1000, true)).toBeNull();
    expect(actionSwipe(0, -40, 100, true)).toBe('up');
  });
});
