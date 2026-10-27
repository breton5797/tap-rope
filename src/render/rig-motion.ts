// v7.1 reaction layers for the operative (GDD-v7.1 §2), driven by the impact cues (cues.ts): each
// takes the seconds since its cue and bends the base pose (run / air / slide) for a fraction of a
// second — take-off crouch and stretch, landing absorb scaled by the jump level, lane banking with
// a crossover step, edge-bump stagger, PERFECT evasive tucks and the slide pop-up. Pure functions
// of (pose, age): clampPose in drawRig stays the final joint-range guard.
import type { Pose } from './rig-skeleton';
import { clamp } from './util';

function smooth(e0: number, e1: number, x: number): number {
  const k = clamp((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
}

function mix(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** take-off: crouch until ~0.06s after the jump cue, then the stretch until ~0.2s */
export const CROUCH_T = 0.06;

/** crouch weight (1 at the cue → 0 by ~0.07s) */
export function crouchK(age: number): number {
  return age < 0 ? 0 : 1 - smooth(0.035, 0.075, age);
}

/** stretch weight (rises as the crouch releases, gone by ~0.22s) */
export function stretchK(age: number): number {
  return age < 0 ? 0 : smooth(0.035, 0.075, age) * (1 - smooth(0.12, 0.22, age));
}

/** Take-off from the ground: loaded crouch (knees, hips, arms back) → full-body stretch (legs
 * driven straight, arms thrown up, chest open). */
export function applyTakeoff(p: Pose, age: number): void {
  const c = crouchK(age);
  const s = stretchK(age);
  if (c <= 0.001 && s <= 0.001) return;
  p.spine += 0.32 * c - 0.12 * s;
  p.head += 0.1 * c - 0.15 * s;
  for (let i = 0; i < 2; i++) {
    const l = p.legs[i];
    l.hip = mix(l.hip, 0.75 - i * 0.2, c);
    l.knee = mix(l.knee, 1.5 - i * 0.15, c);
    l.ankle = mix(l.ankle, 0.35, c);
    l.hip = mix(l.hip, i === 0 ? 0.25 : -0.3, s);
    l.knee = mix(l.knee, i === 0 ? 0.35 : 0.12, s);
    l.ankle = mix(l.ankle, -0.45, s);
    const a = p.arms[i];
    a.hip = mix(a.hip, -0.85, c);
    a.knee = mix(a.knee, 0.5, c);
    a.hip = mix(a.hip, 2.35 - i * 0.25, s);
    a.knee = mix(a.knee, 0.35, s);
  }
}

/** Vertical squash / stretch of the whole figure at take-off (sy; sx keeps the volume). */
export function takeoffStretch(age: number): number {
  return 1 - 0.08 * crouchK(age) + 0.07 * stretchK(age);
}

/** Landing absorb strength by seconds since the land cue: a 30ms load, ~0.12s recovery. */
export function landCurve(age: number): number {
  if (age < 0 || age > 0.2) return 0;
  return age < 0.03 ? 0.6 + 0.4 * (age / 0.03) : 1 - smooth(0.03, 0.17, age);
}

/** knee-bend depth per jump level (1 = a hop, 3 = a heavy drop from the top of the flip) */
export function landDepth(level: number): number {
  return 0.65 + 0.32 * (clamp(level, 1, 3) - 1);
}

/** Lane switch (k = 0..1 progress, dir ±1): bank into the move, crossover step, arms out. */
export function applyBank(p: Pose, k: number, dir: number): void {
  if (k <= 0 || k >= 1) return;
  const b = Math.sin(k * Math.PI);
  p.spine += 0.1 * b;
  p.head -= 0.08 * b;
  // the trailing leg crosses over in front of the lead leg mid-switch
  const lead = p.legs[dir > 0 ? 0 : 1];
  const trail = p.legs[dir > 0 ? 1 : 0];
  lead.hip = mix(lead.hip, -0.1, 0.5 * b);
  lead.knee = mix(lead.knee, 0.4, 0.5 * b);
  trail.hip = mix(trail.hip, 0.75, 0.6 * b);
  trail.knee = mix(trail.knee, 1.2, 0.6 * b);
  p.arms[1].hip = mix(p.arms[1].hip, 1.35, 0.55 * b);
  p.arms[1].knee = mix(p.arms[1].knee, 0.45, 0.55 * b);
  p.arms[0].hip = mix(p.arms[0].hip, -0.6, 0.4 * b);
}

/** small hop over the lane line (px, up) */
export function bankHop(k: number): number {
  return k <= 0 || k >= 1 ? 0 : 3.5 * Math.sin(k * Math.PI);
}

/** Edge-lane bump wobble (−1..1, decaying in ~0.45s). */
export function bumpWobble(age: number): number {
  if (age < 0 || age > 0.6) return 0;
  return Math.sin(age * 26) * Math.exp(-age * 7);
}

/** Bump stagger: shoulder checks the wall, torso rocks, arms out, knees soften. */
export function applyBump(p: Pose, age: number): void {
  const w = bumpWobble(age);
  if (w === 0) return;
  const env = Math.exp(-age * 7);
  p.x -= 2.5 * env;
  p.spine += -0.3 * w;
  p.head += 0.22 * w;
  for (const a of p.arms) {
    a.hip = mix(a.hip, 1.6, 0.5 * env);
    a.knee = mix(a.knee, 0.35, 0.5 * env);
  }
  for (const l of p.legs) l.knee += 0.35 * env;
}

/** PERFECT / GOOD evasion envelope: in and out over ~0.32s. */
export function evadeK(age: number): number {
  return age < 0 || age > 0.32 ? 0 : Math.sin((age / 0.32) * Math.PI);
}

/** Evasive tuck by obstacle zone: legs fold over a 'low' beam, the head ducks under a 'high' one,
 * the torso turns away from a 'side' hazard (the turn itself is evadeTwist). s = 0..1 strength. */
export function applyEvade(p: Pose, age: number, zone: 'low' | 'high' | 'side', s: number): void {
  const e = evadeK(age) * s;
  if (e <= 0.001) return;
  if (zone === 'low') {
    for (const l of p.legs) {
      l.hip += 0.55 * e;
      l.knee += 0.9 * e;
      l.ankle += 0.3 * e;
    }
    p.spine += 0.18 * e;
    p.arms[1].hip = mix(p.arms[1].hip, 1.9, 0.6 * e);
  } else if (zone === 'high') {
    // chin to chest, shoulders flattened, the free arm pulled in tight
    p.head += 0.5 * e;
    p.spine -= 0.12 * e;
    p.arms[0].hip = mix(p.arms[0].hip, 0.3, 0.6 * e);
    p.arms[0].knee = mix(p.arms[0].knee, 2.2, 0.6 * e);
  } else {
    p.spine += 0.12 * e;
    for (const a of p.arms) {
      a.hip = mix(a.hip, 0.9, 0.6 * e);
      a.knee = mix(a.knee, 2.1, 0.6 * e);
    }
  }
}

/** Torso turn for a 'side' evasion, as a horizontal scale of the figure (1 = profile). */
export function evadeTwist(age: number, s: number): number {
  return 1 - 0.32 * evadeK(age) * s;
}

/** Slide exit (k = 0..1 over the last ~0.1s of the slide): torso swings up, rear leg pushes,
 * arms drive forward — the pop back onto the feet. */
export function applySlidePop(p: Pose, k: number): void {
  if (k <= 0) return;
  const e = smooth(0, 1, k);
  p.spine = mix(p.spine, 0.35, e);
  p.head = mix(p.head, -0.15, e);
  p.y = mix(p.y, -24, e);
  p.x = mix(p.x, 0, e);
  p.legs[0].hip = mix(p.legs[0].hip, 0.7, e);
  p.legs[0].knee = mix(p.legs[0].knee, 1.0, e);
  p.legs[1].hip = mix(p.legs[1].hip, 0.15, e);
  p.legs[1].knee = mix(p.legs[1].knee, 1.5, e);
  p.arms[0].hip = mix(p.arms[0].hip, 1.4, e);
  p.arms[1].hip = mix(p.arms[1].hip, -0.4, e);
}

/** Boost twist as a horizontal scale (a turn about the vertical axis): level 2 a half-turn
 * shoulder dip, level 3 a full pirouette through the flip. 1 = profile, −1 = facing back. */
export function boostTwist(spin: number, level: number): number {
  if (spin <= 0 || spin >= 1) return 1;
  if (level >= 3) {
    const c = Math.cos(smooth(0.08, 0.8, spin) * Math.PI * 2);
    // never fully edge-on: a sliver of the body stays visible
    return Math.sign(c || 1) * Math.max(0.18, Math.abs(c));
  }
  return 1 - 0.35 * Math.sin(spin * Math.PI);
}
