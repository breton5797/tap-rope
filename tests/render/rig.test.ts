import { describe, expect, it } from 'vitest';
import {
  applyLand, applyRecoil, applyStumble, hitCurve, poseAir, poseCivRun, poseCrouchRun, poseIdle, poseRun, poseSlide,
  poseVault,
} from '../../src/render/rig-poses';
import { clampPose, J, newPose, P, RANGE, solve, type Pose } from '../../src/render/rig-skeleton';

const within = (v: number, r: readonly [number, number]): boolean => v >= r[0] - 1e-9 && v <= r[1] + 1e-9;

function inRange(p: Pose): boolean {
  if (!within(p.spine, RANGE.spine) || !within(p.head, RANGE.head)) return false;
  for (const l of p.legs) {
    if (!within(l.hip + p.spine, RANGE.hipFlex) || !within(l.knee, RANGE.knee) || !within(l.ankle, RANGE.ankle)) return false;
  }
  return p.arms.every((a) => within(a.hip, RANGE.shoulder) && within(a.knee, RANGE.elbow));
}

/** highest point of the figure above the floor (head top ≈ head centre − 6) */
function top(p: Pose): number {
  clampPose(p);
  solve(p);
  let min = J[P.Head + 1] - 6;
  for (let i = 1; i < 36; i += 2) min = Math.min(min, J[i]);
  return -min;
}

describe('operative rig joint ranges', () => {
  it('clampPose pulls any layered pose back into human ranges', () => {
    const p = newPose();
    poseRun(p, 1.3);
    applyLand(p, 1);
    applyLand(p, 1);
    applyRecoil(p, 1);
    p.legs[1].knee = 3.5;
    p.arms[0].knee = -1;
    expect(inRange(p)).toBe(false);
    clampPose(p);
    expect(inRange(p)).toBe(true);
  });

  it('authored poses already sit inside the ranges (the clamp is a guard, not the animation)', () => {
    const p = newPose();
    for (let k = 0; k < 24; k++) {
      const ph = (k / 24) * Math.PI * 2;
      for (const make of [() => poseRun(p, ph), () => poseCivRun(p, ph), () => poseCrouchRun(p, ph), () => poseIdle(p, k)]) {
        make();
        expect(inRange(p)).toBe(true);
      }
      for (const level of [1, 2, 3]) {
        poseAir(p, level, 400 - k * 40, k / 23, false);
        expect(inRange(p)).toBe(true);
      }
      poseVault(p, 400 - k * 40);
      expect(inRange(p)).toBe(true);
      poseSlide(p, k * 0.02);
      expect(inRange(p)).toBe(true);
    }
  });

  it('flips are tucked mid-rotation: knees folded, hips never past the tuck limit', () => {
    const p = newPose();
    for (const level of [2, 3]) {
      poseAir(p, level, 0, 0.5, false);
      expect(p.rot).toBeGreaterThan(0);
      for (const l of p.legs) {
        expect(l.knee).toBeGreaterThan(1.8);
        expect(l.hip + p.spine).toBeLessThanOrEqual(RANGE.hipFlex[1] + 1e-9);
      }
    }
  });
});

describe('escort (civilian) motion', () => {
  it('never rotates: hurdle and crouch-run keep the body upright', () => {
    const p = newPose();
    for (const vy of [600, 0, -600]) {
      poseVault(p, vy);
      expect(p.rot).toBe(0);
    }
    poseCrouchRun(p, 1);
    expect(p.rot).toBe(0);
    applyStumble(p, 1);
    clampPose(p);
    expect(inRange(p)).toBe(true);
  });

  it('crouch-run is a real duck-walk: far lower than standing (88px), head near the 46px beam line', () => {
    const p = newPose();
    for (let k = 0; k < 12; k++) {
      poseCrouchRun(p, (k / 12) * Math.PI * 2);
      expect(top(p)).toBeLessThan(52);
    }
  });
});

describe('slide and hit', () => {
  it('knee slide keeps the whole figure under 42px', () => {
    const p = newPose();
    poseSlide(p, 0.3);
    expect(top(p)).toBeLessThan(42);
  });

  it('hit recoil peaks fast and is gone within half a second', () => {
    expect(hitCurve(0.07)).toBeCloseTo(1);
    expect(hitCurve(0.5)).toBeLessThan(0.1);
    expect(hitCurve(-1)).toBe(0);
  });
});
