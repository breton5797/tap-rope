// The long rope: a quadratic curve between the turners' hands, with depth + motion blur.
import { GROUND_Y, PLAYER_X } from '../types';
import { clamp, type Ctx } from './util';

export const TURNER_LX = 42;
export const TURNER_RX = 318;
export const HAND_LX = 64;
export const HAND_RX = 296;
export const HAND_Y = GROUND_Y - 78;
/** Midpoint swings between the ground (phase 0) and GROUND_Y-165 (phase π). */
const MID_CENTER = GROUND_Y - 82.5;
const MID_AMP = 82.5;
const HAND_SWING = 8;

/** Mutable scratch geometry (reused every frame to avoid allocation). */
export class RopeGeom {
  x0 = 0;
  y0 = 0;
  cx = 0;
  cy = 0;
  x1 = 0;
  y1 = 0;
}

/** Rope is in front of the player while it swings down toward the feet. */
export function isFront(phase: number): boolean {
  return Math.sin(phase) < 0;
}

export function handOffsetY(phase: number): number {
  return HAND_SWING * Math.cos(phase);
}

export function handOffsetX(phase: number): number {
  return -2.5 * Math.sin(phase);
}

export function ropeGeom(phase: number, out: RopeGeom): RopeGeom {
  const hy = HAND_Y + handOffsetY(phase);
  const hx = handOffsetX(phase);
  const forward = Math.max(0, -Math.sin(phase));
  const midY = MID_CENTER + MID_AMP * Math.cos(phase) + forward * 5;
  out.x0 = HAND_LX + hx;
  out.y0 = hy;
  out.x1 = HAND_RX - hx;
  out.y1 = hy;
  out.cx = PLAYER_X;
  out.cy = 2 * midY - hy;
  return out;
}

/** Point on the curve at u ∈ [0,1], written into `out` [x, y]. */
export function ropePoint(g: RopeGeom, u: number, out: Float32Array): void {
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  out[0] = a * g.x0 + b * g.cx + c * g.x1;
  out[1] = a * g.y0 + b * g.cy + c * g.y1;
}

export interface RopeStyle {
  readonly main: string;
  readonly back: string;
  readonly dark: string;
  readonly light: string;
}

const PINK: RopeStyle = { main: '#FF3F86', back: '#B82D66', dark: '#7A1240', light: '#FFD0E2' };
const CYAN: RopeStyle = { main: '#22C8F2', back: '#1789AE', dark: '#0B4A66', light: '#D2F6FF' };
const TEAL: RopeStyle = { main: '#14E0C8', back: '#0FA393', dark: '#064F4A', light: '#D4FFF9' };
const LIME: RopeStyle = { main: '#B6F23A', back: '#7FB022', dark: '#3D5A0A', light: '#F1FFD0' };

/** [rope A, rope B] per world — chosen for contrast against each backdrop. */
export const ROPE_STYLES: readonly (readonly [RopeStyle, RopeStyle])[] = [
  [PINK, CYAN],
  [TEAL, PINK],
  [PINK, LIME],
  [PINK, CYAN],
];

const HUES: string[] = [];
for (let i = 0; i < 36; i++) HUES.push(`hsl(${i * 10},100%,63%)`);

const scratch = new RopeGeom();
const pt = new Float32Array(2);

function path(ctx: Ctx, g: RopeGeom): void {
  ctx.beginPath();
  ctx.moveTo(g.x0, g.y0);
  ctx.quadraticCurveTo(g.cx, g.cy, g.x1, g.y1);
}

function rainbow(ctx: Ctx, g: RopeGeom, w: number, t: number): void {
  const n = 24;
  const shift = Math.floor(t * 40);
  ropePoint(g, 0, pt);
  let px = pt[0];
  let py = pt[1];
  ctx.lineWidth = w;
  for (let i = 1; i <= n; i++) {
    ropePoint(g, i / n, pt);
    ctx.strokeStyle = HUES[(i * 3 + shift) % 36];
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(pt[0], pt[1]);
    ctx.stroke();
    px = pt[0];
    py = pt[1];
  }
}

function solid(ctx: Ctx, g: RopeGeom, style: RopeStyle, front: boolean, fever: boolean, t: number): void {
  const w = (front ? 5 : 3.4) + (fever ? 1.2 : 0);
  if (fever) {
    path(ctx, g);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = w + 9;
    ctx.stroke();
  }
  path(ctx, g);
  ctx.strokeStyle = style.dark;
  ctx.lineWidth = w + 2.6;
  ctx.globalAlpha = front ? 0.9 : 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (fever) rainbow(ctx, g, w, t);
  else {
    path(ctx, g);
    ctx.strokeStyle = front ? style.main : style.back;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -w * 0.22);
  path(ctx, g);
  ctx.strokeStyle = style.light;
  ctx.globalAlpha = front ? 0.85 : 0.4;
  ctx.lineWidth = w * 0.3;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the parts of the rope (motion ghosts + body) that are on the requested
 * side of the player. Call once with front=false before the player and once
 * with front=true after.
 */
export function drawRopePass(
  ctx: Ctx, phase: number, speed: number, front: boolean, style: RopeStyle,
  fever: boolean, t: number, reduced: boolean,
): void {
  ctx.lineCap = 'round';
  const sp = Math.abs(speed);
  const ghosts = reduced ? 0 : Math.min(4, Math.floor(sp / 2.5));
  const step = clamp(sp * 0.011, 0, 0.17) * Math.sign(speed || 1);
  for (let i = ghosts; i >= 1; i--) {
    const ph = phase - i * step;
    if (isFront(ph) !== front) continue;
    ropeGeom(ph, scratch);
    path(ctx, scratch);
    ctx.strokeStyle = fever ? HUES[(i * 7 + Math.floor(t * 40)) % 36] : style.main;
    ctx.globalAlpha = 0.3 * (1 - i / (ghosts + 1));
    ctx.lineWidth = front ? 5.5 : 3.6;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (isFront(phase) !== front) return;
  solid(ctx, ropeGeom(phase, scratch), style, front, fever, t);
}

/** Sample a random point on the rope (for fever sparkles). */
export function randomRopePoint(phase: number, u: number, out: Float32Array): void {
  ropePoint(ropeGeom(phase, scratch), u, out);
}
