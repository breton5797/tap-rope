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
    const moves: number[][] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === 'stroke' ? () => { strokes++; } : k === 'moveTo' ? (x: number, y: number) => { moves.push([x, y]); } : () => undefined),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const v = computeView(390, 844, 2);
    setThrowFrame(true, v);
    const held: VisibleObstacle = { id: '5-0', kind: 'floor', level: 1, from: null, timeUntil: 1.7, height: 0, lanes: null, sudden: false };
    const { throwHand } = await import('../../src/office/render/boss-throw');
    const hand = { ...throwHand() };
    drawBlackout(ctx, v, [held], 0.8, 0.9);
    setThrowFrame(false, v);
    expect(strokes).toBe(1);
    // the outline sits at the hand (held: arc step 0), not at the prop's off-screen path
    expect(Math.abs(moves[0][0] - hand.x)).toBeLessThan(40);
    expect(Math.abs(moves[0][1] - hand.y)).toBeLessThan(40);
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

describe('combo beats (review HIGH)', () => {
  const ob = (kind: VisibleObstacle['kind'], o: Partial<VisibleObstacle> = {}): VisibleObstacle =>
    ({ id: '7-0', kind, level: 1, from: null, timeUntil: 0.8, height: 0, lanes: null, sudden: false, ...o });

  it('signs every hazard of the beat: lane + rear head-height → 뒤에서! 옆으로! + 숙여!', async () => {
    const { beatHint } = await import('../../src/office/render/readability');
    expect(beatHint([ob('guard', { lanes: [0, 1] }), ob('high', { from: 'back' })])).toBe('뒤에서! 옆으로! + 숙여!');
    expect(beatHint([ob('chaser', { lanes: [1] }), ob('beam', { level: 2, from: 'front' })])).toBe('뒤에서! 옆으로! + 점프 2단!');
    expect(beatHint([ob('floor'), ob('drone')])).toBe('점프! + 낮게!');
    expect(beatHint([ob('beam', { level: 3 })])).toBe('점프 3단!');
    expect(beatHint([ob('beam', { level: 1 }), ob('beam', { level: 2 })])).toBe('점프 2단!');
  });
});

describe('colleague (high five)', () => {
  it('stands in a lane next to the hero, never on top of it', async () => {
    const { colleagueLane } = await import('../../src/office/render/surprise-fx');
    for (const lane of [0, 0.5, 1, 1.5, 2]) expect(Math.abs(colleagueLane(lane) - lane)).toBeGreaterThanOrEqual(0.5);
  });
});

describe('popups stay on screen', () => {
  it('shift right at the left edge and left at the right edge', async () => {
    const { popupShift } = await import('../../src/office/render/popups');
    expect(popupShift(108, 40, 400, 90)).toBeGreaterThan(0);
    expect(popupShift(380, 40, 400, 60)).toBeLessThan(0);
    expect(popupShift(200, 40, 400, 30)).toBe(0);
  });
});
