// Procedural poses for the rig (GDD-v6 §3). Legs use absolute thigh angles; arms are relative to
// the torso. Everything stays inside human joint ranges (clampPose is the final guard): flips are
// tucked (knees to chest, hands on shins, spine curled, never folded flat at the hip), and the
// escorted scientist has a separate civilian set: run, a single hurdle for any jump, a crouch-run
// under slide lasers and a stumble on hits — never copying the agent's acrobatics.
import { RANGE, STAND_HIP_H, type Limb, type Pose } from './rig-skeleton';
import { clamp } from './util';

function setLimb(l: Limb, hip: number, knee: number, ankle = 0): void {
  l.hip = hip;
  l.knee = knee;
  l.ankle = ankle;
}

function mix(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function smooth(e0: number, e1: number, x: number): number {
  const k = clamp((x - e0) / (e1 - e0), 0, 1);
  return k * k * (3 - 2 * k);
}

function reset(p: Pose, plant: boolean): void {
  p.rot = 0;
  p.plant = plant;
  p.x = 0;
  p.y = -STAND_HIP_H;
}

/** Run cycle at phase ph (radians): opposed arms and legs, forward lean, steady head. */
export function poseRun(p: Pose, ph: number): void {
  reset(p, true);
  p.y = -STAND_HIP_H + 2 - 1.6 * Math.cos(ph * 2);
  p.spine = 0.22;
  p.head = -0.18;
  for (let i = 0; i < 2; i++) {
    const q = ph + i * Math.PI;
    const s = Math.sin(q);
    const c = Math.cos(q);
    // thigh swings ±; the knee folds hard while the leg recovers forward, flexes on stance
    setLimb(p.legs[i], 0.1 + 0.62 * s, 0.32 + 1.3 * Math.max(0, c) ** 1.3 + 0.12 * Math.max(0, -s), 0.1 * c);
    const a = Math.sin(ph + (1 - i) * Math.PI);
    setLimb(p.arms[i], 0.2 + 0.75 * a, 1.45 + 0.3 * a);
  }
}

/** Standing ready stance with slow breathing. */
export function poseIdle(p: Pose, t: number): void {
  const br = Math.sin(t * 1.6);
  reset(p, true);
  p.spine = 0.07 + 0.012 * br;
  p.head = -0.06;
  setLimb(p.legs[0], 0.1, 0.18);
  setLimb(p.legs[1], -0.08, 0.1);
  setLimb(p.arms[0], 0.12 + 0.02 * br, 0.55);
  setLimb(p.arms[1], 0.02 + 0.02 * br, 0.45);
}

/** Airborne agent: 1 = running leap; 2 = tucked front flip (spin 0..1); 3 = flip with an
 * overhead arm drive and a kick-out before landing; dive = feet-first drop into a slide. */
export function poseAir(p: Pose, level: number, vy: number, spin: number, dive: boolean): void {
  reset(p, false);
  p.y = -STAND_HIP_H + 4;
  if (dive) {
    p.spine = -0.08;
    p.head = 0.2;
    setLimb(p.legs[0], 0.6, 0.25, -0.3);
    setLimb(p.legs[1], 0.15, 1.1);
    setLimb(p.arms[0], 1.6, 0.7);
    setLimb(p.arms[1], 1.95, 0.5);
    return;
  }
  const rise = clamp(vy / 700, -1, 1);
  const fall = Math.max(0, -rise);
  if (level >= 2 && spin < 1) {
    flip(p, spin, level >= 3);
    return;
  }
  // leap: lead knee driven up, trailing leg behind, arms counter-swinging; legs reach for the
  // floor on the way down
  p.spine = 0.2 - rise * 0.05;
  p.head = -0.16;
  setLimb(p.legs[0], 1.0 + 0.12 * rise - 0.4 * fall, 1.45 - 0.85 * fall, 0.15);
  setLimb(p.legs[1], -0.3 + 0.2 * (1 - rise) + 0.25 * fall, 1.0 + 0.2 * (1 - rise) - 0.5 * fall);
  setLimb(p.arms[0], -0.5 + 0.6 * fall, 1.2 - 0.4 * fall);
  setLimb(p.arms[1], 1.25 - 0.3 * fall, 0.7);
}

/** Tucked front flip. Tuck builds in the first 18% of the spin and opens over the last 28%. */
function flip(p: Pose, s: number, drive: boolean): void {
  const f = smooth(0, 0.18, s) * (1 - smooth(0.72, 1, s));
  p.rot = s * s * (3 - 2 * s) * Math.PI * 2;
  p.y = -STAND_HIP_H + 6;
  p.spine = 0.15 + 0.55 * f;
  p.head = 0.45 * f;
  setLimb(p.legs[0], 0.3 + 1.2 * f, 0.35 + 2.0 * f, 0.4 * f);
  setLimb(p.legs[1], 0.22 + 1.2 * f, 0.45 + 1.9 * f, 0.4 * f);
  // hands grab the shins in the tuck
  let sh = 0.35 + 0.95 * f;
  let el = 0.6 + 1.05 * f;
  if (drive) {
    // arms thrown overhead to start the rotation, then out again for the landing; legs kick out
    const up = 1 - smooth(0.04, 0.26, s) + 0.7 * smooth(0.7, 0.95, s);
    sh = mix(sh, 2.5, up);
    el = mix(el, 0.35, up);
    const kick = smooth(0.66, 0.9, s);
    p.spine = mix(p.spine, 0.05, kick);
    setLimb(p.legs[0], mix(p.legs[0].hip, 0.3, kick), mix(p.legs[0].knee, 0.2, kick), p.legs[0].ankle);
    setLimb(p.legs[1], mix(p.legs[1].hip, 0.1, kick), mix(p.legs[1].knee, 0.3, kick), p.legs[1].ankle);
  }
  setLimb(p.arms[0], sh, el);
  setLimb(p.arms[1], sh - 0.12, el);
}

/** Knee slide: front leg along the floor, rear knee folded under, torso leaned back, rear hand
 * skimming the floor. Top of the pose stays under ~42px (ceiling lasers end at 46). */
export function poseSlide(p: Pose, age: number): void {
  const k = clamp(age / 0.08, 0, 1);
  reset(p, false);
  p.x = -4;
  p.y = -9.5;
  p.spine = -0.95 * k + 0.2 * (1 - k);
  p.head = 0.58 * k;
  setLimb(p.legs[0], 1.48, 0.12, -0.3);
  setLimb(p.legs[1], 0.55, 2.4, 0.4);
  setLimb(p.arms[0], mix(0.9, -0.3, k), 0.9);
  setLimb(p.arms[1], mix(-0.3, -1.0, k), 0.15);
}

/** Landing absorb (q = 1 right at touchdown → 0): knees bend, hips sink, torso pitches forward. */
export function applyLand(p: Pose, q: number): void {
  if (q <= 0) return;
  p.spine += 0.28 * q;
  for (const l of p.legs) {
    l.hip += 0.4 * q;
    l.knee += 0.8 * q;
  }
  for (const a of p.arms) a.hip += 0.3 * q;
}

/** Hit strength over time since the hit: a sharp 50ms onset, then a quick recovery. */
export function hitCurve(age: number): number {
  if (age < 0) return 0;
  return age < 0.05 ? age / 0.05 : Math.exp(-(age - 0.05) * 6);
}

/** Stagger after the snap: one catch step forward between ~0.12s and ~0.45s after the hit. */
export function staggerCurve(age: number): number {
  return age > 0.12 && age < 0.45 ? Math.sin((Math.PI * (age - 0.12)) / 0.33) : 0;
}

/** Agent hit recoil, by seconds since the hit: the torso snaps back hard (head whipped, near arm
 * up to guard, far arm flung, knees buckle), then a stagger step forward to catch the balance. */
export function applyRecoil(p: Pose, age: number): void {
  const r = hitCurve(age);
  const st = staggerCurve(age);
  if (r <= 0.001 && st <= 0) return;
  p.x -= 5 * r - 1.5 * st;
  p.spine += -0.62 * r + 0.22 * st;
  p.head += -0.34 * r + 0.15 * st;
  const n = p.arms[0];
  n.hip = mix(n.hip, 1.0, 0.85 * r);
  n.knee = mix(n.knee, 2.1, 0.85 * r);
  const f = p.arms[1];
  f.hip = mix(f.hip, -0.95, 0.8 * r);
  f.knee = mix(f.knee, 0.3, 0.8 * r);
  // knees buckle on the snap; the near leg reaches forward for the catch step
  for (const l of p.legs) l.knee += 0.4 * r;
  const lead = p.legs[0];
  lead.hip = mix(lead.hip, 0.75, 0.6 * st);
  lead.knee = mix(lead.knee, 0.55, 0.6 * st);
  f.hip = mix(f.hip, 0.9, 0.5 * st);
  // the hips can't hyperextend: as the torso whips back, a trailing thigh is dragged under the body
  for (const l of p.legs) l.hip = Math.max(l.hip, RANGE.hipFlex[0] - p.spine);
}

// ---------- the escorted scientist ----------

/** Civilian run: shorter, less athletic stride, arms pumping loosely, head pushed forward. */
export function poseCivRun(p: Pose, ph: number): void {
  reset(p, true);
  p.y = -STAND_HIP_H + 2 - 1.2 * Math.cos(ph * 2);
  p.spine = 0.17;
  p.head = -0.02;
  for (let i = 0; i < 2; i++) {
    const q = ph + i * Math.PI;
    const s = Math.sin(q);
    const c = Math.cos(q);
    setLimb(p.legs[i], 0.08 + 0.52 * s, 0.3 + 1.05 * Math.max(0, c) ** 1.3 + 0.1 * Math.max(0, -s), 0.08 * c);
    const a = Math.sin(ph + (1 - i) * Math.PI);
    setLimb(p.arms[i], 0.18 + 0.5 * a, 1.25 + 0.2 * a);
  }
}

/** Crouch-run under slide lasers: bent double on the balls of the feet, head down, a hand on the
 * back of the head. A grown adult can't fold under the 46px beam line; this is as low as a real
 * duck-walk gets (~50px), and the beam has swept past before the scientist reaches it. */
export function poseCrouchRun(p: Pose, ph: number): void {
  reset(p, true);
  p.spine = 1.0;
  p.head = 0.25;
  for (let i = 0; i < 2; i++) {
    const q = ph + i * Math.PI;
    const s = Math.sin(q);
    const c = Math.cos(q);
    setLimb(p.legs[i], 1.15 + 0.1 * s, 2.0 + 0.3 * Math.max(0, c), -0.5);
  }
  setLimb(p.arms[0], 2.1, 2.4);
  setLimb(p.arms[1], 0.7 + 0.25 * Math.sin(ph), 0.7);
}

/** One plain hurdle for any jump: lead leg forward, trail leg tucked, arms out for balance. */
export function poseVault(p: Pose, vy: number): void {
  reset(p, false);
  p.y = -STAND_HIP_H + 4;
  const fall = Math.max(0, -clamp(vy / 700, -1, 1));
  p.spine = 0.3 - 0.1 * fall;
  p.head = -0.25;
  setLimb(p.legs[0], 1.1 - 0.55 * fall, 0.7 - 0.3 * fall, 0.1);
  setLimb(p.legs[1], -0.15 + 0.2 * fall, 2.1 - 0.7 * fall);
  setLimb(p.arms[0], 1.3, 0.5);
  setLimb(p.arms[1], -0.4 + 0.5 * fall, 0.8);
}

/** Scientist's stumble (r = 0..1): pitches forward, arms out to break the fall, knees buckle. */
export function applyStumble(p: Pose, r: number): void {
  if (r <= 0.001) return;
  p.x += 2 * r;
  p.spine += 0.45 * r;
  p.head += 0.25 * r;
  for (const a of p.arms) {
    a.hip = mix(a.hip, 1.2, 0.8 * r);
    a.knee = mix(a.knee, 0.4, 0.8 * r);
  }
  for (const l of p.legs) l.knee += 0.4 * r;
}
