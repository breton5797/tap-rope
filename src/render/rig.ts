// Adult operative rig (GDD-v6 §3): ~7.5 heads, 88 logical px tall at scale 1, side view facing +x.
// A pose is a set of joint angles (pelvis → spine → neck/head, hips → knees → ankles, shoulders →
// elbows); forward kinematics places the joints and every segment is drawn as a tapered limb with
// plane shading (key light from above-front) and a thin rim light in the scene colour. Angles are
// radians measured from "straight down", positive = rotated toward +x (forward).
import type { AgentLook } from './skins';
import { clamp, type Ctx } from './util';

/** segment lengths (px at scale 1) */
const THIGH = 22;
const SHIN = 21;
const FOOT = 7.5;
const SPINE = 26;
const NECK = 4;
const HEAD_R = 5.6; // head is ~11.7 tall (1/7.5 of 88)
const UPPER_ARM = 16;
const FOREARM = 14;
export const STAND_HIP_H = THIGH + SHIN + 3;

export interface Limb {
  hip: number; // thigh / upper-arm absolute angle (legs) or relative to the spine (arms)
  knee: number; // bend: legs fold backward, arms fold forward
  ankle: number; // foot flex
}

export interface Pose {
  /** pelvis offset from the feet origin (y < 0 = up) */
  x: number;
  y: number;
  /** whole-body rotation about the body centre (flips) */
  rot: number;
  spine: number; // lean from vertical, + = forward
  head: number; // head tilt relative to the spine
  legs: [Limb, Limb]; // 0 = near (camera) side, 1 = far side
  arms: [Limb, Limb];
  /** snap the lowest foot to the floor (grounded poses) */
  plant: boolean;
}

export function newPose(): Pose {
  const l = (): Limb => ({ hip: 0, knee: 0, ankle: 0 });
  return { x: 0, y: -STAND_HIP_H, rot: 0, spine: 0, head: 0, legs: [l(), l()], arms: [l(), l()], plant: true };
}

// ---------- forward kinematics into a reusable joint buffer ----------

const J = new Float64Array(64);
const enum P {
  Pelvis = 0, Chest = 2, Neck = 4, Head = 6,
  Hip0 = 8, Knee0 = 10, Ankle0 = 12, Toe0 = 14,
  Hip1 = 16, Knee1 = 18, Ankle1 = 20, Toe1 = 22,
  Sh0 = 24, El0 = 26, Hand0 = 28,
  Sh1 = 30, El1 = 32, Hand1 = 34,
}

function set(i: number, x: number, y: number): void {
  J[i] = x;
  J[i + 1] = y;
}

/** point at angle a (from straight down, + forward) and distance len from joint i */
function from(i: number, a: number, len: number, out: number): void {
  set(out, J[i] + Math.sin(a) * len, J[i + 1] + Math.cos(a) * len);
}

function solve(p: Pose): void {
  set(P.Pelvis, p.x, p.y);
  // spine points up: angle π (straight up) minus forward lean
  from(P.Pelvis, Math.PI - p.spine, SPINE, P.Chest);
  from(P.Chest, Math.PI - p.spine - p.head * 0.4, NECK, P.Neck);
  from(P.Neck, Math.PI - p.spine - p.head, HEAD_R + 0.5, P.Head);
  for (let k = 0; k < 2; k++) {
    const leg = p.legs[k];
    const o = k === 0 ? P.Hip0 : P.Hip1;
    set(o, p.x + (k === 0 ? 0.8 : -0.8), p.y);
    from(o, leg.hip, THIGH, o + 2);
    const shin = leg.hip - leg.knee;
    from(o + 2, shin, SHIN, o + 4);
    from(o + 4, shin + Math.PI / 2 - leg.ankle, FOOT, o + 6);
    const arm = p.arms[k];
    const s = k === 0 ? P.Sh0 : P.Sh1;
    // shoulders sit a little below the neck base
    from(P.Chest, Math.PI - p.spine + Math.PI, 2, s);
    J[s] += k === 0 ? 0.6 : -0.6;
    const ua = p.spine + arm.hip;
    from(s, ua, UPPER_ARM, s + 2);
    from(s + 2, ua + arm.knee, FOREARM, s + 4);
  }
  if (p.plant) {
    // lift / drop the whole body so the lowest heel or toe rests on the floor (y = 0)
    let low = -1e9;
    for (const i of [P.Ankle0, P.Toe0, P.Ankle1, P.Toe1]) low = Math.max(low, J[i + 1] + (i === P.Ankle0 || i === P.Ankle1 ? 2 : 0.8));
    const dy = -low;
    for (let i = 1; i < 36; i += 2) J[i] += dy;
  }
}

// ---------- drawing ----------

/** key light direction (toward the light): above and in front */
const LX = 0.5;
const LY = -0.866;

export interface Paint {
  readonly look: AgentLook;
  readonly rim: string; // scene rim-light colour
  readonly torch: boolean;
}

function limb(ctx: Ctx, a: number, b: number, wa: number, wb: number, base: string, light: string, rim: string): void {
  const ax = J[a];
  const ay = J[a + 1];
  const bx = J[b];
  const by = J[b + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ang = Math.atan2(dy, dx);
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
  // lit plane: the half of the limb facing the key light
  const lit = nx * LX + ny * LY > 0 ? 1 : -1;
  const ox = nx * lit;
  const oy = ny * lit;
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(ax + ox * wa, ay + oy * wa);
  ctx.lineTo(bx + ox * wb, by + oy * wb);
  ctx.lineTo(bx + ox * wb * 0.15, by + oy * wb * 0.15);
  ctx.lineTo(ax + ox * wa * 0.15, ay + oy * wa * 0.15);
  ctx.closePath();
  ctx.fill();
  // rim light on the shadow edge
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(ax - ox * (wa - 0.4), ay - oy * (wa - 0.4));
  ctx.lineTo(bx - ox * (wb - 0.4), by - oy * (wb - 0.4));
  ctx.stroke();
}

function boot(ctx: Ctx, ankle: number, toe: number, color: string, light: string): void {
  const ax = J[ankle];
  const ay = J[ankle + 1];
  const tx = J[toe];
  const ty = J[toe + 1];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax - 2.6, ay - 2.4);
  ctx.lineTo(ax + 1.8, ay - 2.8);
  ctx.lineTo(tx + 0.6, ty - 1.2);
  ctx.lineTo(tx + 0.4, ty + 1.3);
  ctx.lineTo(ax - 3, ay + 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.fillRect(Math.min(ax, tx) - 1, Math.max(ay, ty) + 0.6, Math.abs(tx - ax) + 2, 1);
}

function hand(ctx: Ctx, i: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(J[i], J[i + 1], 2.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Torso: tapered block from pelvis to chest with the vest / holster / backpack details. */
function torso(ctx: Ctx, p: Pose, k: Paint): void {
  const L = k.look;
  limb(ctx, P.Pelvis, P.Chest, 6.4, 7.6, L.suit, L.suitLight, k.rim);
  const px = J[P.Pelvis];
  const py = J[P.Pelvis + 1];
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.spine);
  if (L.backpack) {
    ctx.fillStyle = '#1C1F23';
    ctx.fillRect(-11.5, -24, 6, 15);
    ctx.fillStyle = '#2C3036';
    ctx.fillRect(-11.5, -24, 6, 3);
    ctx.strokeStyle = '#4A5058';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.lineTo(-12, -33);
    ctx.stroke();
    ctx.fillStyle = k.look.accent;
    ctx.fillRect(-12.6, -34, 1.4, 1.4);
  }
  if (L.vest) {
    // plate carrier: front and back plates + pouches
    ctx.fillStyle = L.vest;
    ctx.fillRect(-7.6, -24, 15.4, 14);
    ctx.fillStyle = L.vestLight;
    ctx.fillRect(2.2, -24, 5.6, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(2.2, -14, 4.6, 0.8);
    ctx.fillRect(2.2, -18.5, 4.6, 0.8);
    ctx.fillStyle = L.vest;
    ctx.fillRect(4.6, -17.5, 2.6, 6);
  }
  if (L.metal) {
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-5, -12);
    ctx.lineTo(5, -12);
    ctx.moveTo(-5, -19);
    ctx.lineTo(5, -19);
    ctx.stroke();
    ctx.fillStyle = L.accent;
    ctx.fillRect(3.5, -21, 2, 1.2);
  }
  // belt + holster
  ctx.fillStyle = '#121416';
  ctx.fillRect(-6.6, -3.5, 13.2, 2.6);
  ctx.fillStyle = '#6A6F75';
  ctx.fillRect(3.2, -3.4, 1.6, 2.2);
  if (L.holster) {
    ctx.fillStyle = '#16181B';
    ctx.fillRect(-1, -2, 4, 8);
  }
  ctx.restore();
}

function head(ctx: Ctx, p: Pose, k: Paint): void {
  const L = k.look;
  const hx = J[P.Head];
  const hy = J[P.Head + 1];
  // neck
  limb(ctx, P.Chest, P.Neck, 2.6, 2.3, L.head === 'hair' ? L.skin : L.hair, L.head === 'hair' ? L.skin : L.suitLight, k.rim);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.spine + p.head);
  const r = HEAD_R;
  // skull
  const cover = L.head === 'hair' ? L.skin : L.head === 'android' ? L.suit : L.hair;
  ctx.fillStyle = cover;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.92, r * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // jaw / face plane (front-lower), lit from the front
  if (L.head === 'hair' || L.head === 'hood') {
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.4);
    ctx.lineTo(r * 0.98, -r * 0.1);
    ctx.lineTo(r * 0.9, r * 0.55);
    ctx.lineTo(r * 0.35, r * 1.05);
    ctx.lineTo(-r * 0.2, r * 0.9);
    ctx.closePath();
    ctx.fill();
    // nose + brow shadow + eye line
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(r * 0.25, -r * 0.18, r * 0.62, r * 0.14);
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.moveTo(r * 0.92, -r * 0.05);
    ctx.lineTo(r * 1.18, r * 0.28);
    ctx.lineTo(r * 0.9, r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,14,10,0.85)';
    ctx.fillRect(r * 0.48, -r * 0.06, r * 0.3, r * 0.09);
  }
  if (L.head === 'hair') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, -r * 0.42, r * 0.95, r * 0.7, -0.15, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(-r * 0.85, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(-r * 0.1, r * 0.1, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (L.head === 'hood') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 1.05);
    ctx.quadraticCurveTo(-r * 1.4, -r * 1.3, -r * 1.05, r * 1.1);
    ctx.lineTo(r * 0.0, r * 1.15);
    ctx.quadraticCurveTo(-r * 0.4, 0, r * 0.55, -r * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (L.head === 'balaclava' || L.head === 'slit') {
    ctx.fillStyle = L.skin;
    ctx.fillRect(r * 0.2, -r * 0.3, r * 0.75, r * (L.head === 'slit' ? 0.22 : 0.35));
    ctx.fillStyle = 'rgba(20,14,10,0.85)';
    ctx.fillRect(r * 0.48, -r * 0.24, r * 0.28, r * 0.1);
  } else if (L.head === 'helmet') {
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.moveTo(r * 0.2, -r * 0.2);
    ctx.lineTo(r * 1.0, -r * 0.1);
    ctx.lineTo(r * 0.85, r * 0.8);
    ctx.lineTo(r * 0.1, r * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, -r * 0.35, r * 1.12, r * 0.85, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(r * 1.1, -r * 0.1);
    ctx.lineTo(-r * 1.15, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(r * 0.2, r * 0.25, r * 0.8, r * 0.12);
  } else {
    // android: smooth shell with a red sensor strip
    ctx.fillStyle = L.suitLight;
    ctx.beginPath();
    ctx.ellipse(r * 0.2, -r * 0.25, r * 0.6, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A1C20';
    ctx.fillRect(r * 0.05, -r * 0.25, r * 0.95, r * 0.3);
    ctx.fillStyle = L.accent;
    ctx.fillRect(r * 0.3, -r * 0.18, r * 0.66, r * 0.14);
  }
  if (L.nvg) {
    ctx.fillStyle = '#1A1D21';
    ctx.fillRect(-r * 0.1, -r * 1.12, r * 0.9, r * 0.42);
    ctx.fillStyle = '#2C3137';
    ctx.fillRect(r * 0.55, -r * 1.2, r * 0.45, r * 0.55);
    ctx.fillStyle = L.accent;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(r * 0.95, -r * 1.08, r * 0.12, r * 0.3);
    ctx.globalAlpha = 1;
  }
  // earpiece
  if (L.head === 'hair' || L.head === 'helmet') {
    ctx.fillStyle = '#0E1012';
    ctx.fillRect(-r * 0.2, -r * 0.05, r * 0.32, r * 0.36);
  }
  // rim light along the back of the head
  ctx.strokeStyle = k.rim;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, Math.PI * 0.75, Math.PI * 1.35);
  ctx.stroke();
  ctx.restore();
}

function torch(ctx: Ctx): void {
  const x = J[P.Hand0];
  const y = J[P.Hand0 + 1];
  ctx.fillStyle = '#1A1D21';
  ctx.fillRect(x - 1, y - 1.5, 6, 3);
  ctx.fillStyle = '#FFF2D0';
  ctx.fillRect(x + 4.6, y - 1.3, 1.2, 2.6);
}

/** Draw the rig in pose p at the current transform (origin = feet, scale 1 = 88px tall). */
export function drawRig(ctx: Ctx, p: Pose, k: Paint): void {
  solve(p);
  const L = k.look;
  const cx = J[P.Pelvis];
  const cy = J[P.Pelvis + 1] - 8;
  if (p.rot !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate(p.rot);
    ctx.translate(-cx, -cy);
  }
  const rimFar = 'rgba(0,0,0,0)';
  // far side (darker, no rim)
  limb(ctx, P.Sh1, P.El1, 3.3, 2.8, L.suitDark, L.suit, rimFar);
  limb(ctx, P.El1, P.Hand1, 2.8, 2.2, L.suitDark, L.suit, rimFar);
  hand(ctx, P.Hand1, L.gloves);
  limb(ctx, P.Hip1, P.Knee1, 5.4, 4.0, L.suitDark, L.suit, rimFar);
  limb(ctx, P.Knee1, P.Ankle1, 3.9, 2.8, L.suitDark, L.suit, rimFar);
  boot(ctx, P.Ankle1, P.Toe1, L.boots, '#2A2D31');
  // body
  torso(ctx, p, k);
  // near leg
  limb(ctx, P.Hip0, P.Knee0, 5.6, 4.1, L.suit, L.suitLight, k.rim);
  limb(ctx, P.Knee0, P.Ankle0, 4.0, 2.9, L.suit, L.suitLight, k.rim);
  boot(ctx, P.Ankle0, P.Toe0, L.boots, '#3A3E44');
  // knee pad on the near leg (kitted operatives only)
  if (L.vest) {
    ctx.fillStyle = '#16181B';
    ctx.beginPath();
    ctx.arc(J[P.Knee0], J[P.Knee0 + 1], 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  head(ctx, p, k);
  // near arm
  limb(ctx, P.Sh0, P.El0, 3.5, 2.9, L.suit, L.suitLight, k.rim);
  limb(ctx, P.El0, P.Hand0, 2.9, 2.3, L.suit, L.suitLight, k.rim);
  hand(ctx, P.Hand0, L.gloves);
  if (k.torch) torch(ctx);
}

// ---------- animation ----------

/** stride length of one full run cycle (two steps), world px */
export const STRIDE = 137;

function setLimb(l: Limb, hip: number, knee: number, ankle = 0): void {
  l.hip = hip;
  l.knee = knee;
  l.ankle = ankle;
}

/** Run cycle at phase ph (radians). */
export function poseRun(p: Pose, ph: number): void {
  p.rot = 0;
  p.plant = true;
  p.x = 0;
  p.y = -STAND_HIP_H + 2 - 1.6 * Math.cos(ph * 2);
  p.spine = 0.2;
  p.head = -0.14;
  for (let i = 0; i < 2; i++) {
    const q = ph + i * Math.PI;
    const s = Math.sin(q);
    const c = Math.cos(q);
    // thigh swings ±; the knee folds hard while the leg recovers forward, flexes on stance
    setLimb(p.legs[i], 0.1 + 0.62 * s, 0.32 + 1.25 * Math.max(0, c) ** 1.3 + 0.12 * Math.max(0, -s), 0.1 * c);
    const a = Math.sin(ph + (1 - i) * Math.PI);
    setLimb(p.arms[i], 0.05 + 0.7 * a, 1.35 + 0.35 * a);
  }
}

/** Standing idle with slow breathing / weight shift. */
export function poseIdle(p: Pose, t: number): void {
  const br = Math.sin(t * 1.6);
  p.rot = 0;
  p.plant = true;
  p.x = 0;
  p.y = -STAND_HIP_H;
  p.spine = 0.04 + 0.015 * br;
  p.head = -0.02;
  setLimb(p.legs[0], 0.06, 0.1);
  setLimb(p.legs[1], -0.08, 0.06);
  setLimb(p.arms[0], 0.12 + 0.02 * br, 0.35);
  setLimb(p.arms[1], -0.1 + 0.02 * br, 0.3);
}

/** Airborne: 1 = tucked leap; 2 = tucked front flip (spin 0..1); 3 = piked somersault; dive = fast fall. */
export function poseAir(p: Pose, level: number, vy: number, spin: number, dive: boolean): void {
  p.plant = false;
  p.x = 0;
  p.y = -STAND_HIP_H + 4;
  p.rot = 0;
  if (dive) {
    p.spine = 0.75;
    p.head = -0.35;
    setLimb(p.legs[0], -0.25, 0.5);
    setLimb(p.legs[1], -0.45, 0.35);
    setLimb(p.arms[0], 1.9, 0.3);
    setLimb(p.arms[1], 2.1, 0.25);
    return;
  }
  const rise = clamp(vy / 700, -1, 1);
  if (level >= 3 && spin < 1) {
    // piked somersault: hips folded, legs straight, arms reaching for the shins
    const f = Math.sin(spin * Math.PI);
    p.rot = easeSpin(spin) * Math.PI * 2;
    p.spine = 0.25 + 0.75 * f;
    p.head = 0.2 * f;
    setLimb(p.legs[0], 0.4 + 1.0 * f, 0.15);
    setLimb(p.legs[1], 0.35 + 0.95 * f, 0.2);
    setLimb(p.arms[0], 0.6 + 0.9 * f, 0.3);
    setLimb(p.arms[1], 0.5 + 0.9 * f, 0.3);
    p.y = -STAND_HIP_H + 6;
    return;
  }
  if (level === 2 && spin < 1) {
    // tucked front flip
    const f = Math.sin(spin * Math.PI);
    p.rot = easeSpin(spin) * Math.PI * 2;
    p.spine = 0.3 + 0.6 * f;
    p.head = 0.35 * f;
    setLimb(p.legs[0], 0.6 + 1.1 * f, 0.9 + 1.4 * f);
    setLimb(p.legs[1], 0.5 + 1.1 * f, 1.0 + 1.3 * f);
    setLimb(p.arms[0], 0.7 + 0.5 * f, 1.2 + 0.4 * f);
    setLimb(p.arms[1], 0.6 + 0.5 * f, 1.2 + 0.4 * f);
    p.y = -STAND_HIP_H + 8;
    return;
  }
  // leap: lead knee driven up, trailing leg extended behind, arms counter-swinging
  p.spine = 0.18 - rise * 0.06;
  p.head = -0.1;
  setLimb(p.legs[0], 0.95 + 0.2 * rise, 1.25 + 0.2 * rise);
  setLimb(p.legs[1], -0.35 + 0.25 * (1 - rise), 0.95);
  setLimb(p.arms[0], -0.55, 1.2);
  setLimb(p.arms[1], 1.05 + 0.2 * rise, 0.6);
}

function easeSpin(k: number): number {
  return k * k * (3 - 2 * k);
}

/** Knee slide: front leg extended along the floor, rear knee folded under, torso leaned back,
 * trailing hand skimming the floor. Top of the pose stays under ~42px (ceiling lasers at 46). */
export function poseSlide(p: Pose, age: number): void {
  const k = clamp(age / 0.08, 0, 1);
  p.rot = 0;
  p.plant = false;
  p.x = -4;
  p.y = -9.5;
  p.spine = -0.95 * k + 0.2 * (1 - k);
  p.head = 0.65 * k;
  setLimb(p.legs[0], 1.48, 0.12, -0.3);
  setLimb(p.legs[1], 0.55, 2.55, 0.4);
  setLimb(p.arms[0], 0.9, 0.9);
  setLimb(p.arms[1], -0.35, 0.15);
}

/** Landing absorb (q = 1 right at touchdown → 0): knees bend, hips sink, torso pitches forward. */
export function applyLand(p: Pose, q: number): void {
  if (q <= 0) return;
  p.spine += 0.3 * q;
  for (const l of p.legs) {
    l.hip += 0.45 * q;
    l.knee += 0.9 * q;
  }
  for (const a of p.arms) a.hip += 0.35 * q;
}

/** Hit reaction: thrown back, head snapped, arms flung. */
export function applyHurt(p: Pose, t: number): void {
  const j = Math.sin(t * 38) * 0.05;
  p.spine = -0.32 + j;
  p.head = -0.3;
  setLimb(p.arms[0], -0.7, 0.4);
  setLimb(p.arms[1], 1.6, 0.5);
}
