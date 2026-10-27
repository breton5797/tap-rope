// Operative skeleton (GDD-v6 §3): ~7.5 heads, 88 logical px tall at scale 1, side view facing +x.
// A pose is a set of joint angles (pelvis → spine → neck/head, hips → knees → ankles, shoulders →
// elbows); forward kinematics writes the joint positions into one reusable buffer. Angles are
// radians measured from "straight down", positive = rotated toward +x (forward).
import { clamp } from './util';

/** segment lengths (px at scale 1) */
export const THIGH = 22;
export const SHIN = 21;
export const FOOT = 7.5;
export const SPINE = 26;
export const NECK = 4;
export const HEAD_R = 5.6; // head is ~11.7 tall (1/7.5 of 88)
export const UPPER_ARM = 15.5;
export const FOREARM = 13.5;
export const STAND_HIP_H = THIGH + SHIN + 3;

export interface Limb {
  hip: number; // thigh absolute angle (legs) or shoulder flexion relative to the spine (arms)
  knee: number; // bend: legs fold backward, arms fold forward (elbow)
  ankle: number; // foot flex (legs only)
}

export interface Pose {
  /** pelvis offset from the feet origin (y < 0 = up) */
  x: number;
  y: number;
  /** whole-body rotation about the body centre (flips) */
  rot: number;
  spine: number; // lean from vertical, + = forward
  head: number; // head tilt relative to the spine, + = chin down
  legs: [Limb, Limb]; // 0 = near (camera) side, 1 = far side
  arms: [Limb, Limb];
  /** snap the lowest foot to the floor (grounded poses) */
  plant: boolean;
}

export function newPose(): Pose {
  const l = (): Limb => ({ hip: 0, knee: 0, ankle: 0 });
  return { x: 0, y: -STAND_HIP_H, rot: 0, spine: 0, head: 0, legs: [l(), l()], arms: [l(), l()], plant: true };
}

/** Human joint ranges (radians). Every pose goes through clampPose before it is drawn, so blends
 * and layered reactions (landing + hit + lean) can never fold a limb the wrong way. */
export const RANGE = {
  spine: [-1.15, 1.15],
  head: [-0.55, 0.6],
  /** hip flexion = thigh angle + spine lean (thigh relative to the torso) */
  hipFlex: [-0.45, 2.25],
  knee: [0, 2.4],
  ankle: [-0.6, 0.8],
  /** shoulder flexion relative to the torso (− = arm behind the body) */
  shoulder: [-1.05, 2.9],
  elbow: [0.05, 2.45],
} as const;

export function clampPose(p: Pose): void {
  p.spine = clamp(p.spine, RANGE.spine[0], RANGE.spine[1]);
  p.head = clamp(p.head, RANGE.head[0], RANGE.head[1]);
  for (const l of p.legs) {
    l.hip = clamp(l.hip + p.spine, RANGE.hipFlex[0], RANGE.hipFlex[1]) - p.spine;
    l.knee = clamp(l.knee, RANGE.knee[0], RANGE.knee[1]);
    l.ankle = clamp(l.ankle, RANGE.ankle[0], RANGE.ankle[1]);
  }
  for (const a of p.arms) {
    a.hip = clamp(a.hip, RANGE.shoulder[0], RANGE.shoulder[1]);
    a.knee = clamp(a.knee, RANGE.elbow[0], RANGE.elbow[1]);
  }
}

// ---------- forward kinematics into a reusable joint buffer ----------

export const J = new Float64Array(40);
/** joint slots in J (x at i, y at i + 1) */
export const P = {
  Pelvis: 0, Chest: 2, Neck: 4, Head: 6,
  Hip0: 8, Knee0: 10, Ankle0: 12, Toe0: 14,
  Hip1: 16, Knee1: 18, Ankle1: 20, Toe1: 22,
  Sh0: 24, El0: 26, Hand0: 28,
  Sh1: 30, El1: 32, Hand1: 34,
} as const;
const JOINTS_END = 36;

function set(i: number, x: number, y: number): void {
  J[i] = x;
  J[i + 1] = y;
}

/** point at angle a (from straight down, + forward) and distance len from joint i */
function from(i: number, a: number, len: number, out: number): void {
  set(out, J[i] + Math.sin(a) * len, J[i + 1] + Math.cos(a) * len);
}

export function solve(p: Pose): void {
  set(P.Pelvis, p.x, p.y);
  // spine points up: angle π (straight up) minus forward lean
  from(P.Pelvis, Math.PI - p.spine, SPINE, P.Chest);
  from(P.Chest, Math.PI - p.spine - p.head * 0.4, NECK, P.Neck);
  from(P.Neck, Math.PI - p.spine - p.head, HEAD_R + 0.5, P.Head);
  for (let k = 0; k < 2; k++) {
    const leg = p.legs[k];
    const o = k === 0 ? P.Hip0 : P.Hip1;
    set(o, p.x + (k === 0 ? 0.6 : -0.6), p.y);
    from(o, leg.hip, THIGH, o + 2);
    const shin = leg.hip - leg.knee;
    from(o + 2, shin, SHIN, o + 4);
    from(o + 4, shin + Math.PI / 2 - leg.ankle, FOOT, o + 6);
    const arm = p.arms[k];
    const s = k === 0 ? P.Sh0 : P.Sh1;
    // shoulder joints sit 3px below the chest point, slightly behind the spine line
    from(P.Chest, -p.spine, 3, s);
    J[s] += k === 0 ? -0.4 : -1.2;
    const ua = -p.spine + arm.hip;
    from(s, ua, UPPER_ARM, s + 2);
    from(s + 2, ua + arm.knee, FOREARM, s + 4);
  }
  if (p.plant) {
    // lift / drop the whole body so the lowest heel or toe rests on the floor (y = 0)
    const low = Math.max(J[P.Ankle0 + 1] + 2, J[P.Toe0 + 1] + 0.8, J[P.Ankle1 + 1] + 2, J[P.Toe1 + 1] + 0.8);
    for (let i = 1; i < JOINTS_END; i += 2) J[i] -= low;
  }
}
