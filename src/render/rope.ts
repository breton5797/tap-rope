// The rope as a 3D curve rotating about the lateral (x) axis, projected to the screen.
// phase ≡ 0 → rope midpoint on the ground under the kid; π → overhead; in between it
// sweeps in front (z < 0, toward the camera) or behind (z > 0).
import { LANE_W } from '../types';
import { project } from './projection';
import { clamp, type Ctx } from './util';

export const TURNER_X = 150;
export const LONG_HAND_X = 128;
export const LONG_AXIS_H = 82;
const LONG_HAND_R = 9;
const SOLO_HAND_X = 21;
const SOLO_AXIS_H = 34;
const SOLO_RADIUS = 48;
const SOLO_HAND_R = 6;
const N = 22;

/** Mutable rig describing one rope this frame. */
export class RopeRig {
  cx = 0; // world x of the rope centre
  handX = LONG_HAND_X; // half-span between hands
  axisH = LONG_AXIS_H;
  radius = LONG_AXIS_H;
  handR = LONG_HAND_R;
  sign = 1; // -1 = turning backwards
  cross = false; // solo 엇걸어: hands swapped, rope crosses in front
  solo = false;
  floor = 0; // lowest allowed height (ground)
}

export function setLongRig(r: RopeRig): RopeRig {
  r.cx = 0;
  r.handX = LONG_HAND_X;
  r.axisH = LONG_AXIS_H;
  r.radius = LONG_AXIS_H;
  r.handR = LONG_HAND_R;
  r.sign = 1;
  r.cross = false;
  r.solo = false;
  return r;
}

export function setSoloRig(r: RopeRig, laneX: number, height: number, backward: boolean, cross: boolean): RopeRig {
  r.cx = laneX * LANE_W;
  r.handX = SOLO_HAND_X;
  r.axisH = height + SOLO_AXIS_H;
  r.radius = SOLO_RADIUS;
  r.handR = SOLO_HAND_R;
  r.sign = backward ? -1 : 1;
  r.cross = cross;
  r.solo = true;
  return r;
}

/** Rope is in front of the kid (toward the camera) when its z is negative. */
export function isFront(phase: number, sign: number): boolean {
  return sign * Math.sin(phase) < 0;
}

/** world (x, z, h) of the hand at side -1|1 (unswapped) for this phase. */
export function handPos(r: RopeRig, phase: number, side: number, out: Float32Array): void {
  const s = r.cross ? -side : side;
  out[0] = r.cx + s * (r.handX - (r.cross ? 4 : 0));
  out[1] = r.sign * Math.sin(phase) * r.handR;
  out[2] = r.axisH - Math.cos(phase) * r.handR;
}

const pts = new Float32Array((N + 1) * 3);
const tmp = new Float32Array(3);

function loopX(r: RopeRig, u: number): number {
  if (!r.solo) return r.cx - r.handX + 2 * r.handX * u;
  const th = Math.PI * u;
  const wide = r.cross ? 1.3 : 1;
  return r.cx - (r.handX * Math.cos(th) + 15 * Math.sin(2 * th)) * wide;
}

/** Fill `pts` with projected rope points. Returns the mean depth scale. */
function build(r: RopeRig, phase: number): number {
  const dz = r.sign * Math.sin(phase);
  const dh = -Math.cos(phase);
  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const w = Math.sin(Math.PI * u);
    const rad = r.handR + (r.radius - r.handR) * w;
    let x = loopX(r, u);
    if (r.cross && (i === 0 || i === N)) x = r.cx + (i === 0 ? 1 : -1) * (r.handX - 4);
    const h = Math.max(r.floor, r.axisH + dh * rad);
    project(x, dz * rad, h, tmp);
    pts[i * 3] = tmp[0];
    pts[i * 3 + 1] = tmp[1];
    sum += tmp[2];
  }
  return sum / (N + 1);
}

function path(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 1; i < N; i++) {
    const mx = (pts[i * 3] + pts[(i + 1) * 3]) / 2;
    const my = (pts[i * 3 + 1] + pts[(i + 1) * 3 + 1]) / 2;
    ctx.quadraticCurveTo(pts[i * 3], pts[i * 3 + 1], mx, my);
  }
  ctx.lineTo(pts[N * 3], pts[N * 3 + 1]);
}

export interface RopeStyle {
  readonly main: string;
  readonly back: string;
  readonly dark: string;
  readonly light: string;
}

const PINK: RopeStyle = { main: '#FF3F86', back: '#C23070', dark: '#7A1240', light: '#FFD0E2' };
const CYAN: RopeStyle = { main: '#22C8F2', back: '#1789AE', dark: '#0B4A66', light: '#D2F6FF' };
const TEAL: RopeStyle = { main: '#14E0C8', back: '#0FA393', dark: '#064F4A', light: '#D4FFF9' };
const LIME: RopeStyle = { main: '#B6F23A', back: '#7FB022', dark: '#3D5A0A', light: '#F1FFD0' };

/** [rope A, rope B] per world — chosen for contrast against each ground. */
export const ROPE_STYLES: readonly (readonly [RopeStyle, RopeStyle])[] = [
  [PINK, CYAN],
  [TEAL, PINK],
  [PINK, LIME],
  [PINK, CYAN],
];

const HUES: string[] = [];
for (let i = 0; i < 36; i++) HUES.push(`hsl(${i * 10},100%,63%)`);

function rainbow(ctx: Ctx, w: number, t: number): void {
  const shift = Math.floor(t * 40);
  ctx.lineWidth = w;
  for (let i = 0; i < N; i++) {
    ctx.strokeStyle = HUES[(i * 3 + shift) % 36];
    ctx.beginPath();
    ctx.moveTo(pts[i * 3], pts[i * 3 + 1]);
    ctx.lineTo(pts[(i + 1) * 3], pts[(i + 1) * 3 + 1]);
    ctx.stroke();
  }
}

function solid(ctx: Ctx, style: RopeStyle, front: boolean, fever: boolean, t: number, w: number): void {
  if (fever) {
    path(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = w + 8;
    ctx.stroke();
  }
  path(ctx);
  ctx.strokeStyle = style.dark;
  ctx.lineWidth = w + 2.4;
  ctx.globalAlpha = front ? 0.9 : 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (fever) rainbow(ctx, w, t);
  else {
    path(ctx);
    ctx.strokeStyle = front ? style.main : style.back;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -w * 0.22);
  path(ctx);
  ctx.strokeStyle = style.light;
  ctx.globalAlpha = front ? 0.85 : 0.35;
  ctx.lineWidth = w * 0.3;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the parts of the rope (motion ghosts + body) on the requested side of the
 * kid: call with front=false before the kid and front=true after.
 */
export function drawRopePass(
  ctx: Ctx, rig: RopeRig, phase: number, speed: number, front: boolean, style: RopeStyle,
  fever: boolean, t: number, reduced: boolean,
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const base = rig.solo ? 3.9 : 4.6;
  const sp = Math.abs(speed);
  const ghosts = reduced ? 0 : Math.min(4, Math.floor(sp / 2.2));
  const step = clamp(sp * 0.012, 0, 0.18) * Math.sign(speed || 1);
  for (let i = ghosts; i >= 1; i--) {
    const ph = phase - i * step;
    if (isFront(ph, rig.sign) !== front) continue;
    const s = build(rig, ph);
    path(ctx);
    ctx.strokeStyle = fever ? HUES[(i * 7 + Math.floor(t * 40)) % 36] : style.main;
    ctx.globalAlpha = 0.3 * (1 - i / (ghosts + 1));
    ctx.lineWidth = (front ? base + 1 : base - 0.6) * s;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (isFront(phase, rig.sign) !== front) return;
  const s = build(rig, phase);
  solid(ctx, style, front, fever, t, (front ? base + 0.6 : base - 1) * s + (fever ? 1 : 0));
}

/** A projected point along the rope at u ∈ [0,1] (for fever sparkles). */
export function ropePoint(rig: RopeRig, phase: number, u: number, out: Float32Array): void {
  build(rig, phase);
  const i = Math.min(N, Math.max(0, Math.round(u * N)));
  out[0] = pts[i * 3];
  out[1] = pts[i * 3 + 1];
}
