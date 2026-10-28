// Office feel pack (v2 plan Task C, spec §4): pure helpers behind the run cycle, jump/slide poses, boss
// throws, prop life, speed lines and judge-aligned flying props.
import { describe, expect, it } from 'vitest';
import { initialPlayer } from '../../src/core/physics';
import { heroPose, runFrame, STRIDE, type PoseCtx } from '../../src/office/render/hero-frames';
import { flyingPropCenter, propMotion } from '../../src/office/render/props';
import { THROW_JOIN_GAP, bossThrowFrame, launchFor, throwArc } from '../../src/office/render/boss-throw';
import { speedLineCount } from '../../src/office/render/floor-flow';
import { computeView } from '../../src/office/render/view';
import { PLAYER_X, type PlayerState } from '../../src/types';
import { LANE_STEP, depthScale } from '../../src/render/layout';

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

describe('heroPose (F4 / F11, Ludo art contract)', () => {
  const air: PlayerState = { ...p0, grounded: false, height: 30, level: 1, airTime: 0.2, vy: 100 };
  const full = has(['jump1', 'jump2', 'jump3', 'jump4', 'jump5', 'jump6', 'jump7', 'jump8', 'slide1', 'slide2', 'slide3', 'slide4', 'hit1', 'hit2', 'hit3', 'hit4']);

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

  it('1단 plays jump1..8 over the airborne time; jump8 lands; falls back to the still jump frame', () => {
    expect(heroPose({ ...air, airTime: 0.01 }, { ...base, art: full }).frame).toBe('jump1');
    expect(heroPose({ ...air, airTime: 0.22 }, { ...base, art: full }).frame).toBe('jump5');
    expect(heroPose({ ...air, airTime: 0.43 }, { ...base, art: full }).frame).toBe('jump8');
    expect(heroPose(p0, { ...base, landAge: 0.03, art: full }).frame).toBe('jump8');
    expect(heroPose({ ...air, airTime: 0.22 }, base).frame).toBe('jump');
  });

  it('2단 / 3단 never flip: a stretch and at most ±15° tilt (a full spin read as a fall)', () => {
    const two = { ...air, level: 2 as const };
    expect(heroPose(two, { ...base, boostAge: 0.2, art: full }).frame).toBe('jump4');
    for (const age of [0, 0.1, 0.2, 0.3, 0.45]) {
      expect(Math.abs(heroPose(two, { ...base, boostAge: age }).rot)).toBeLessThanOrEqual((15 * Math.PI) / 180 + 1e-9);
    }
    expect(heroPose(two, { ...base, boostAge: 0.2 }).sy).toBeGreaterThan(1);
    expect(heroPose(two, { ...base, boostAge: 1 }).rot).toBe(0);
    expect(heroPose({ ...air, level: 3 }, { ...base, boostAge: 0.1, art: full }).frame).toBe('jump');
    expect(heroPose({ ...air, level: 3 }, { ...base, boostAge: 0.1 }).rot).not.toBe(0);
  });

  it('slides with zero delay: dive frames over ~80 ms, hold slide4, reverse on exit; a fast-fall shows the dive', () => {
    const sl: PlayerState = { ...p0, sliding: true, slideAge: 0, slideTime: 0.55 };
    expect(heroPose(sl, { ...base, art: full }).frame).toBe('slide1');
    expect(heroPose({ ...sl, slideAge: 0.05 }, { ...base, art: full }).frame).toBe('slide2');
    expect(heroPose({ ...sl, slideAge: 0.3 }, { ...base, art: full }).frame).toBe('slide4');
    expect(heroPose({ ...sl, slideAge: 0.5, slideTime: 0.05 }, { ...base, art: full }).frame).toBe('slide2');
    expect(heroPose({ ...air, pendingSlide: true }, { ...base, art: full }).frame).toBe('slide1');
    expect(heroPose(sl, base).frame).toBe('slide');
    expect(heroPose({ ...sl, slideAge: 0.3 }, base).sy).toBe(1);
  });

  it('hit plays hit1..4 over the hit window; win overrides', () => {
    expect(heroPose(air, { ...base, hitAge: 0.01, art: full }).frame).toBe('hit1');
    expect(heroPose(air, { ...base, hitAge: 0.4, art: full }).frame).toBe('hit4');
    expect(heroPose(air, { ...base, hitAge: 0.1 }).frame).toBe('hit');
    expect(heroPose(p0, { ...base, win: true }).frame).toBe('win');
  });
});

describe('bossThrowFrame (F5, boss-<slot>-throw1..6)', () => {
  it('plays throw1..6 across ATTACK_LEAD, the last frame as the prop leaves the hand', () => {
    expect(bossThrowFrame(1.6, 0.5)).toBe(1);
    expect(bossThrowFrame(0.5, 0.5)).toBe(6);
    expect(bossThrowFrame(1.0, 0.5)).toBeGreaterThan(1);
    expect(bossThrowFrame(1.0, 0.5)).toBeLessThan(6);
    expect(bossThrowFrame(2, 0.5)).toBe(0);
    expect(bossThrowFrame(0.2, 0.5)).toBe(0);
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

describe('laneGeometry (F8)', () => {
  it('office lanes sit at least 45% of the hero height apart on a phone, nearer lanes larger', () => {
    const heroH = 92 * 1.2; // HERO_H rig px × RIG_SIZE
    expect(LANE_STEP).toBeGreaterThanOrEqual(0.45 * heroH);
    expect(depthScale(2) - depthScale(0)).toBeGreaterThan(0.2);
  });
});

describe('boss backpedal and exit (F9)', () => {
  it('bobs at stride rate in place, and only slides out left after its gauge ran out', async () => {
    const { BOSS_PHOTO_RIGS, bossExit } = await import('../../src/office/render/boss-rigs');
    const rig = BOSS_PHOTO_RIGS.warden!;
    const v = computeView(390, 844, 2);
    const out = { dx: 0, dy: 0, rot: 0 };
    const b = { id: 'warden', phase: 0, hp: 0.5, state: 'fight', stateAge: 1, attack: null } as const;
    bossExit.at = Number.NEGATIVE_INFINITY;
    const dys = [0.1, 0.2, 0.3].map((t) => { rig.motion!(b, v, t, out); return out.dy; });
    expect(out.dx).toBe(0);
    expect(new Set(dys).size).toBeGreaterThan(1);
    bossExit.at = 10;
    rig.motion!(b, v, 10.5, out);
    expect(out.dx).toBeLessThan(0);
    rig.motion!(b, v, 12, out);
    expect(out.dx).toBeLessThan(-v.w * 0.8);
    bossExit.at = Number.NEGATIVE_INFINITY;
  });
});

describe('pickup sprites (F7)', () => {
  it('coins in a collect part become the stage collectible; other pickups use their office sprite', async () => {
    const { pickupSprite, collectibleFor } = await import('../../src/office/render/collectibles');
    const { STAGE_MISSIONS } = await import('../../src/office/core/missions');
    const parts = STAGE_MISSIONS['w2-s10'];
    const k = parts.findIndex((m) => m.collectible !== undefined);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(collectibleFor(1, k)).toBe(parts[k].collectible);
    const beat = { part: k } as never;
    expect(pickupSprite('coin', beat, 1)).toBe(`collect-${parts[k].collectible}`);
    expect(pickupSprite('shield', beat, 1)).toBe('pickup-shield');
    expect(pickupSprite('coin', undefined, 1)).toBe('pickup-coin');
    expect(collectibleFor(1, undefined)).toBeNull();
  });
});

describe('stackItems (beam stacks read as a thrown bundle)', () => {
  it('a 2단/3단 beam is a column of small items at the beam heights, a 1단 beam stays one prop', async () => {
    const { stackItems, STACK_ITEM } = await import('../../src/office/render/props');
    const { BEAM_H } = await import('../../src/render/layout');
    expect(stackItems(1)).toHaveLength(0);
    for (const level of [2, 3]) {
      const items = stackItems(level);
      expect(items.map((i) => i.height)).toEqual(BEAM_H.slice(0, level));
      expect(new Set(items.map((i) => i.rot)).size).toBe(level);
    }
    expect(STACK_ITEM).toBeLessThan(BEAM_H[1] - BEAM_H[0] + 8);
  });
});

describe('popupShift (F11)', () => {
  it('keeps the enlarged judge popups on screen above the hero', async () => {
    const { popupShift } = await import('../../src/office/render/popups');
    expect(popupShift(108, 40, 60)).toBe(0);
    expect(popupShift(108, 100, 60)).toBeGreaterThan(0);
    expect(108 + popupShift(108, 100, 60) - 60).toBeGreaterThanOrEqual(100 - 1e-9);
  });
});

describe('boss framing (perf + AD: one scan per boss, same frame for every pose)', () => {
  it('frames the idle figure in a fixed-aspect box (room for the throwing arm), bottom on its feet', async () => {
    const { frameRectFrom, FRAME_ASPECT } = await import('../../src/office/render/boss-art');
    const r = frameRectFrom({ x: 300, y: 40, w: 200, h: 900 }, 768, 1024);
    expect(r.w / r.h).toBeCloseTo(FRAME_ASPECT, 2);
    expect(r.y + r.h).toBeCloseTo(940, 6);
    expect(r.x + r.w / 2).toBeCloseTo(400, 6);
    const edge = frameRectFrom({ x: 0, y: 10, w: 300, h: 1000 }, 768, 1024);
    expect(edge.x).toBeGreaterThanOrEqual(0);
    expect(edge.x + edge.w).toBeLessThanOrEqual(768);
  });
});

describe('judge popups (art review)', () => {
  it('fade to about half within 0.15 s so they never hide the hero, then out', async () => {
    const { popupAlpha } = await import('../../src/office/render/popups');
    expect(popupAlpha(0, 0.8)).toBe(1);
    expect(popupAlpha(0.15, 0.8)).toBeCloseTo(0.5, 2);
    expect(popupAlpha(0.4, 0.8)).toBeLessThanOrEqual(0.5);
    expect(popupAlpha(0.8, 0.8)).toBe(0);
  });
});
