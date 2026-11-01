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

describe('rear / stay-low signs scan every hazard (review BLOCK)', () => {
  const ob = (kind: VisibleObstacle['kind'], tu: number, o: Partial<VisibleObstacle> = {}): VisibleObstacle =>
    ({ id: `${Math.round(tu * 10)}-0`, kind, level: 1, from: null, timeUntil: tu, height: 0, lanes: null, sudden: false, ...o });

  it('A: a front lane hazard + a rear head-height beam in one beat still gets the rear mark', async () => {
    const { scanSigns } = await import('../../src/office/render/readability');
    const s = scanSigns([ob('guard', 1.0, { lanes: [0] }), ob('high', 1.0, { from: 'back' })]);
    expect(s.rearHeights.length).toBe(1);
    expect(s.laneBeats.length).toBe(1);
  });

  it('B: a rear chaser behind a nearer front drop is marked from WARN_LEAD on (not after the drop passes)', async () => {
    const { scanSigns, rearMarked } = await import('../../src/office/render/readability');
    const { WARN_LEAD } = await import('../../src/types');
    const chaser = ob('chaser', WARN_LEAD, { lanes: [1] });
    const s = scanSigns([ob('drop', 0.4, { lanes: [0] }), chaser]);
    expect(s.rearHeights.length).toBe(1);
    expect(rearMarked(chaser)).toBe(true);
    expect(rearMarked(ob('chaser', 1.5, { lanes: [1] }))).toBe(false);
  });

  it('rear jump vs rear slide marks sit at different heights; a drone anywhere ahead shows the band', async () => {
    const { scanSigns } = await import('../../src/office/render/readability');
    const s = scanSigns([ob('beam', 0.8, { from: 'back' }), ob('high', 0.9, { from: 'back' }), ob('drone', 1.1)]);
    expect(new Set(s.rearHeights).size).toBe(2);
    expect(s.drone).toBe(true);
    expect(scanSigns([ob('floor', 0.5), ob('high', 0.7)]).laneBeats.length).toBe(0);
  });
});

describe('rear / drone signs across beats (re-review)', () => {
  const ob = (id: string, kind: VisibleObstacle['kind'], tu: number, o: Partial<VisibleObstacle> = {}): VisibleObstacle =>
    ({ id, kind, level: 1, from: null, timeUntil: tu, height: 0, lanes: null, sudden: true, ...o });

  it('scenario B: a front drop at 0.4 s + a rear chaser at 1.0 s in a later beat — arrow now, first shown ≥ WARN_LEAD ahead', async () => {
    const { scanSigns, markedThisFrame } = await import('../../src/office/render/readability');
    const { WARN_LEAD } = await import('../../src/types');
    const s = scanSigns([ob('4-0', 'drop', 0.4, { lanes: [0] }), ob('9-0', 'chaser', 1.0, { lanes: [1] })]);
    expect(s.rearHeights.length).toBe(1);
    expect(markedThisFrame().has('9-0')).toBe(true);
    expect(markedThisFrame().has('4-0')).toBe(false);
    // walk the chaser in from far away: the first frame with the arrow is at least WARN_LEAD before it arrives
    let first = -1;
    for (let tu = 2; tu > 0; tu -= 1 / 60) {
      if (scanSigns([ob('4-0', 'drop', tu - 0.6, { lanes: [0] }), ob('9-0', 'chaser', tu, { lanes: [1] })]).rearHeights.length > 0) {
        first = tu;
        break;
      }
    }
    expect(first).toBeGreaterThanOrEqual(WARN_LEAD);
  });

  it('a drone in a later (non-nearest) beat still gets the stay-low band', async () => {
    const { scanSigns } = await import('../../src/office/render/readability');
    expect(scanSigns([ob('3-0', 'floor', 0.3), ob('6-0', 'drone', 0.9)]).drone).toBe(true);
  });

  it('the "!" is suppressed only for the rear hazards marked this frame', async () => {
    const { scanSigns, markedThisFrame } = await import('../../src/office/render/readability');
    scanSigns([ob('1-0', 'beam', 0.8, { from: 'back' })]);
    expect(markedThisFrame().has('1-0')).toBe(true);
    scanSigns([ob('2-0', 'beam', 1.5, { from: 'back' })]); // beyond SIGN_LEAD: keeps its "!" path
    expect(markedThisFrame().has('2-0')).toBe(false);
    expect(markedThisFrame().has('1-0')).toBe(false);
  });
});
