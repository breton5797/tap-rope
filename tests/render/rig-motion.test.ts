import { describe, expect, it } from 'vitest';
import {
  applyBank, applyBump, applyEvade, applySlidePop, applyTakeoff, bankHop, boostTwist, bumpWobble, crouchK, evadeK,
  evadeTwist, landCurve, landDepth, stretchK, takeoffStretch,
} from '../../src/render/rig-motion';
import { poseAir, poseRun, poseSlide, SLIDE_TOP } from '../../src/render/rig-poses';
import { clampPose, J, newPose, P, RANGE, solve, type Pose } from '../../src/render/rig-skeleton';

const within = (v: number, r: readonly [number, number]): boolean => v >= r[0] - 1e-9 && v <= r[1] + 1e-9;

function inRange(p: Pose): boolean {
  if (!within(p.spine, RANGE.spine) || !within(p.head, RANGE.head)) return false;
  for (const l of p.legs) {
    if (!within(l.hip + p.spine, RANGE.hipFlex) || !within(l.knee, RANGE.knee) || !within(l.ankle, RANGE.ankle)) return false;
  }
  return p.arms.every((a) => within(a.hip, RANGE.shoulder) && within(a.knee, RANGE.elbow));
}

function top(p: Pose): number {
  clampPose(p);
  solve(p);
  let min = J[P.Head + 1] - 6.8;
  for (let i = 1; i < 36; i += 2) min = Math.min(min, J[i]);
  return -min;
}

describe('take-off', () => {
  it('crouches first (~0.06s), then stretches, then hands back to the leap', () => {
    expect(crouchK(0)).toBe(1);
    expect(crouchK(0.03)).toBe(1);
    expect(crouchK(0.08)).toBe(0);
    expect(stretchK(0)).toBe(0);
    expect(stretchK(0.1)).toBeGreaterThan(0.9);
    expect(stretchK(0.25)).toBe(0);
    expect(takeoffStretch(0)).toBeLessThan(1);
    expect(takeoffStretch(0.1)).toBeGreaterThan(1);
    expect(takeoffStretch(1)).toBe(1);
  });

  it('crouch bends the knees and throws the arms back; stretch straightens the legs and raises the arms', () => {
    const c = newPose();
    poseAir(c, 1, 600, 1, false);
    applyTakeoff(c, 0);
    const s = newPose();
    poseAir(s, 1, 600, 1, false);
    applyTakeoff(s, 0.1);
    expect(c.legs[0].knee).toBeGreaterThan(s.legs[0].knee + 0.8);
    expect(c.arms[0].hip).toBeLessThan(0);
    expect(s.arms[0].hip).toBeGreaterThan(2);
  });
});

describe('landing', () => {
  it('absorbs instantly and recovers in ~0.12–0.17s', () => {
    expect(landCurve(0)).toBeGreaterThan(0.5);
    expect(landCurve(0.03)).toBeCloseTo(1);
    expect(landCurve(0.17)).toBe(0);
    expect(landCurve(-1)).toBe(0);
  });

  it('a 3단 drop lands deeper than a hop', () => {
    expect(landDepth(3)).toBeGreaterThan(landDepth(2));
    expect(landDepth(2)).toBeGreaterThan(landDepth(1));
    expect(landDepth(9)).toBe(landDepth(3));
  });
});

describe('lane moves, bumps and evasions', () => {
  it('bank and hop peak mid-switch and vanish when settled', () => {
    expect(bankHop(0.5)).toBeGreaterThan(3);
    expect(bankHop(1)).toBe(0);
    const p = newPose();
    poseRun(p, 1);
    const spine = p.spine;
    applyBank(p, 1, 1);
    expect(p.spine).toBe(spine);
    applyBank(p, 0.5, 1);
    expect(p.spine).toBeGreaterThan(spine);
  });

  it('bump wobble rings out within ~0.6s', () => {
    expect(Math.abs(bumpWobble(0.06))).toBeGreaterThan(0.3);
    expect(bumpWobble(0.7)).toBe(0);
  });

  it('evasions fold the legs (low), duck the head (high), turn the torso (side)', () => {
    expect(evadeK(0.16)).toBeCloseTo(1);
    expect(evadeK(0.4)).toBe(0);
    const base = newPose();
    poseAir(base, 1, 0, 1, false);
    const low = newPose();
    poseAir(low, 1, 0, 1, false);
    applyEvade(low, 0.16, 'low', 1);
    expect(low.legs[0].knee).toBeGreaterThan(base.legs[0].knee + 0.5);
    const high = newPose();
    poseSlide(high, 0.3);
    const head = high.head;
    applyEvade(high, 0.16, 'high', 1);
    expect(high.head).toBeGreaterThan(head);
    expect(evadeTwist(0.16, 1)).toBeLessThan(0.75);
    expect(evadeTwist(1, 1)).toBe(1);
  });

  it('every layered reaction stays inside the human ranges after the clamp', () => {
    for (let k = 0; k < 12; k++) {
      const age = k * 0.03;
      for (const zone of ['low', 'high', 'side'] as const) {
        const p = newPose();
        poseRun(p, k);
        applyBank(p, (k + 0.5) / 12, k % 2 ? 1 : -1);
        applyBump(p, age);
        applyEvade(p, age, zone, 1);
        applyTakeoff(p, age);
        clampPose(p);
        expect(inRange(p)).toBe(true);
      }
    }
  });
});

describe('slide and boost', () => {
  it('the settled slide stays under the ceiling-laser line at the 1.2x drawing size', () => {
    const p = newPose();
    for (const age of [0.1, 0.2, 0.3, 0.45]) {
      poseSlide(p, age);
      expect(top(p)).toBeLessThan(SLIDE_TOP);
    }
    expect(SLIDE_TOP * 1.2).toBeLessThan(46);
  });

  it('the slide exit pops the torso up toward the run', () => {
    const p = newPose();
    poseSlide(p, 0.4);
    const low = top(p);
    applySlidePop(p, 1);
    expect(top(p)).toBeGreaterThan(low + 15);
  });

  it('3단 pirouettes through facing back; 2단 only dips', () => {
    let minus = false;
    for (let s = 0; s <= 1; s += 0.02) if (boostTwist(s, 3) < 0) minus = true;
    expect(minus).toBe(true);
    for (let s = 0; s <= 1; s += 0.02) {
      expect(boostTwist(s, 2)).toBeGreaterThan(0.6);
      expect(Math.abs(boostTwist(s, 3))).toBeGreaterThanOrEqual(0.18);
    }
    expect(boostTwist(1, 3)).toBe(1);
  });

  it('reduced motion keeps the flip tucked but barely rotated', () => {
    const p = newPose();
    poseAir(p, 3, 0, 0.5, false, true);
    expect(Math.abs(p.rot)).toBeLessThan(0.35);
  });
});
