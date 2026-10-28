// Office feel pack (v2 plan Task C, spec §4): pure helpers behind the run cycle, jump/slide poses, boss
// throws, prop life, speed lines and judge-aligned flying props.
import { describe, expect, it } from 'vitest';
import { initialPlayer } from '../../src/core/physics';
import { heroPose, runFrame, STRIDE, type PoseCtx } from '../../src/office/render/hero-frames';
import { flyingPropCenter, propMotion } from '../../src/office/render/props';
import { THROW_JOIN_GAP, launchFor, throwArc } from '../../src/office/render/boss-throw';
import { speedLineCount } from '../../src/office/render/floor-flow';
import { computeView } from '../../src/office/render/view';
import { PLAYER_X, type PlayerState } from '../../src/types';

const p0 = initialPlayer();
const has = (names: string[]) => { const s = new Set(names); return (n: string) => s.has(n); };
const base: PoseCtx = {
  running: true, hitAge: Infinity, win: false, scroll: 0, landAge: Infinity, jumpAge: Infinity, boostAge: Infinity,
  runFrames: 4, art: has([]),
};

describe('runFrame (F3: cycle locked to scroll distance)', () => {
  it('advances one frame per stride/frameCount px of scroll, whatever the frame rate', () => {
    expect([0, 24, 48, 72, 96].map((s) => runFrame(s, 96, 4))).toEqual([0, 1, 2, 3, 0]);
    expect([0, 12, 24, 84].map((s) => runFrame(s, 96, 8))).toEqual([0, 1, 2, 7]);
    expect(runFrame(23.9, 96, 4)).toBe(0);
    expect(runFrame(-1, 96, 4)).toBeGreaterThanOrEqual(0);
  });

  it('heroPose uses run1..run8 when 8 frames exist, else run1..run4', () => {
    expect(heroPose(p0, { ...base, scroll: STRIDE * 0.5 }).frame).toBe('run3');
    expect(heroPose(p0, { ...base, scroll: STRIDE * 0.5, runFrames: 8 }).frame).toBe('run5');
  });
});

describe('heroPose (F4)', () => {
  const air: PlayerState = { ...p0, grounded: false, height: 30, level: 1, airTime: 0.2, vy: 100 };

  it('stretches at take-off and squashes with dust on landing, neutral otherwise', () => {
    const up = heroPose({ ...air, airTime: 0.02 }, { ...base, jumpAge: 0.02 });
    expect(up.sy).toBeGreaterThan(1.05);
    expect(up.sx).toBeLessThan(1);
    const land = heroPose(p0, { ...base, landAge: 0.02 });
    expect(land.sy).toBeLessThan(0.95);
    expect(land.sx).toBeGreaterThan(1);
    expect(land.dust).toBeGreaterThan(0.5);
    const calm = heroPose(p0, { ...base, landAge: 0.5 });
    expect([calm.sx, calm.sy, calm.rot, calm.dust]).toEqual([1, 1, 0, 0]);
  });

  it('2단 spins one turn (frame or rotation cue), 3단 glides', () => {
    const two = { ...air, level: 2 as const };
    expect(heroPose(two, { ...base, boostAge: 0.2 }).frame).toBe('jump');
    expect(Math.abs(heroPose(two, { ...base, boostAge: 0.2 }).rot)).toBeGreaterThan(1);
    expect(heroPose(two, { ...base, boostAge: 0.2, art: has(['jump-spin']) }).frame).toBe('jump-spin');
    expect(heroPose(two, { ...base, boostAge: 0.2, art: has(['jump-spin']) }).rot).toBe(0);
    expect(heroPose(two, { ...base, boostAge: 1 }).rot).toBe(0);
    expect(heroPose({ ...air, level: 3 }, { ...base, boostAge: 0.1, art: has(['jump-glide']) }).frame).toBe('jump-glide');
    expect(heroPose({ ...air, level: 3 }, { ...base, boostAge: 0.1 }).rot).not.toBe(0);
  });

  it('slides in and out with a scale change, using slide-in / slide-hold art when present', () => {
    const sl: PlayerState = { ...p0, sliding: true, slideAge: 0.03, slideTime: 0.5 };
    expect(heroPose(sl, base).frame).toBe('slide');
    expect(heroPose(sl, base).sy).toBeLessThan(1);
    expect(heroPose(sl, { ...base, art: has(['slide-in', 'slide-hold']) }).frame).toBe('slide-in');
    expect(heroPose({ ...sl, slideAge: 0.3 }, { ...base, art: has(['slide-in', 'slide-hold']) }).frame).toBe('slide-hold');
    expect(heroPose({ ...sl, slideAge: 0.3 }, base).sy).toBe(1);
    expect(heroPose({ ...sl, slideAge: 0.5, slideTime: 0.03 }, base).sy).toBeGreaterThan(1);
  });

  it('hit and win override everything', () => {
    expect(heroPose(air, { ...base, hitAge: 0.1 }).frame).toBe('hit');
    expect(heroPose(p0, { ...base, win: true }).frame).toBe('win');
  });
});

describe('launchFor (F5)', () => {
  it('the boss throws front attacks, stomps for a guard, and never throws what comes from behind or above', () => {
    expect(launchFor('floor', null)).toBe('throw');
    expect(launchFor('ceiling', null)).toBe('throw');
    expect(launchFor('drone', null)).toBe('throw');
    expect(launchFor('beam', 'front')).toBe('throw');
    expect(launchFor('high', 'front')).toBe('throw');
    expect(launchFor('guard', null)).toBe('stomp');
    expect(launchFor('beam', 'back')).toBeNull();
    expect(launchFor('high', 'back')).toBeNull();
    expect(launchFor('chaser', null)).toBeNull();
    expect(launchFor('drop', null)).toBeNull();
    expect(launchFor('coin', null)).toBeNull();
  });

  it('the arc leaves the hand, rises, and lands exactly on the prop path at the join time', () => {
    const hand = { x: 300, y: 300 };
    const land = { x: 250, y: 470 };
    const start = throwArc(hand, land, 0);
    expect([start.x, start.y]).toEqual([300, 300]);
    const end = throwArc(hand, land, 1);
    expect(end.x).toBeCloseTo(250, 9);
    expect(end.y).toBeCloseTo(470, 9);
    expect(throwArc(hand, land, 0.3).y).toBeLessThan(300);
    expect(THROW_JOIN_GAP).toBeGreaterThan(0);
  });
});

describe('propMotion (F6)', () => {
  it('gives every prop its own life and stays small (hit boxes unchanged)', () => {
    const plane = [0, 0.1, 0.2].map((t) => propMotion('paper-plane', t).dy);
    expect(new Set(plane).size).toBeGreaterThan(1);
    expect(propMotion('golf', 0.5).rot).not.toBe(propMotion('golf', 0).rot);
    expect(propMotion('clipboard', 0.25).rot).not.toBe(0);
    for (const id of ['paper-plane', 'golf', 'clipboard', 'papers', 'cart', 'door', 'postit', 'unknown']) {
      for (const t of [0, 0.13, 0.77, 3.1]) {
        const m = propMotion(id, t);
        expect(Math.abs(m.dx), id).toBeLessThanOrEqual(4);
        expect(Math.abs(m.dy), id).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe('speedLineCount (F1)', () => {
  it('streaks only in 칼퇴 모드 (fever), none with reduced motion', () => {
    expect(speedLineCount(false, false)).toBe(0);
    expect(speedLineCount(true, false)).toBeGreaterThanOrEqual(8);
    expect(speedLineCount(true, true)).toBe(0);
  });
});

describe('flyingPropCenter (F2)', () => {
  it('centres a flying prop on the beam head, so it covers the hero exactly at judge time', () => {
    const v = computeView(390, 844, 2);
    for (const from of ['front', 'back'] as const) expect(flyingPropCenter(from, 0, v)).toBeCloseTo(PLAYER_X, 9);
    expect(flyingPropCenter('front', 0.3, v)).toBeGreaterThan(PLAYER_X);
    expect(flyingPropCenter('back', 0.3, v)).toBeLessThan(PLAYER_X);
  });
});
