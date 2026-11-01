// Office hazard readability (ambiguity audit): one colour + one sign per move, pickups read as "good".
import { describe, expect, it } from 'vitest';
import { calloutHint, safeLanes, pickupSize, HERO_PX } from '../../src/office/render/readability';
import { drawBlackout } from '../../src/office/render/surprise-fx';
import { computeView } from '../../src/office/render/view';
import type { VisibleObstacle } from '../../src/types';

describe('calloutHint', () => {
  it('names the jump level, the move and a rear attack', () => {
    expect(calloutHint('beam', 1, false)).toBe('점프!');
    expect(calloutHint('beam', 2, false)).toBe('점프 2단!');
    expect(calloutHint('beam', 3, false)).toBe('점프 3단!');
    expect(calloutHint('floor', 1, false)).toBe('점프!');
    expect(calloutHint('high', 1, false)).toBe('숙여!');
    expect(calloutHint('ceiling', 1, false)).toBe('숙여!');
    expect(calloutHint('drone', 1, false)).toBe('낮게!');
    expect(calloutHint('guard', 1, false)).toBe('옆으로!');
    expect(calloutHint('high', 1, true)).toBe('뒤에서! 숙여!');
    expect(calloutHint('chaser', 1, true)).toBe('뒤에서! 옆으로!');
  });
});

describe('safeLanes', () => {
  it('lists the lanes a lane attack leaves open', () => {
    expect(safeLanes([0, 1])).toEqual([2]);
    expect(safeLanes([1])).toEqual([0, 2]);
    expect(safeLanes([])).toEqual([0, 1, 2]);
  });
});

describe('pickupSize', () => {
  it('collectibles ~0.45× and pickups ~0.4× the hero height', () => {
    expect(pickupSize(true)).toBeCloseTo(0.45 * HERO_PX, 6);
    expect(pickupSize(false)).toBeCloseTo(0.4 * HERO_PX, 6);
  });
});

describe('blackout outline pass', () => {
  it('strokes an outline for every hazard on screen while the dark overlay is on', () => {
    let strokes = 0;
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'stroke' ? () => { strokes++; } : () => undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const o = (kind: VisibleObstacle['kind'], lanes: VisibleObstacle['lanes'], tu = 1): VisibleObstacle =>
      ({ id: '3-0', kind, level: 1, from: null, timeUntil: tu, height: 0, lanes, sudden: false });
    drawBlackout(ctx, computeView(390, 844, 2), [o('floor', null), o('guard', [1])], 0.8, 0.9);
    expect(strokes).toBe(4); // floor in 3 lanes + guard in 1
  });

  it('outlines a prop held in the boss\'s hand where it is drawn (not off screen on its path)', async () => {
    const { setThrowFrame } = await import('../../src/office/render/boss-throw');
    let strokes = 0;
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'stroke' ? () => { strokes++; } : () => undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const v = computeView(390, 844, 2);
    setThrowFrame(true, v);
    const held: VisibleObstacle = { id: '5-0', kind: 'floor', level: 1, from: null, timeUntil: 1.7, height: 0, lanes: null, sudden: false };
    drawBlackout(ctx, v, [held], 0.8, 0.9);
    setThrowFrame(false, v);
    expect(strokes).toBe(1);
  });
});

describe('rear attacks', () => {
  it('rear beams and chasers are marked by the 뒤에서 arrow, not the v8 "!" sign', async () => {
    const { isRearAttack } = await import('../../src/office/render/warnings');
    expect(isRearAttack({ kind: 'beam', from: 'back' })).toBe(true);
    expect(isRearAttack({ kind: 'chaser', from: null })).toBe(true);
    expect(isRearAttack({ kind: 'drop', from: null })).toBe(false);
    expect(isRearAttack({ kind: 'beam', from: 'front' })).toBe(false);
  });
});
