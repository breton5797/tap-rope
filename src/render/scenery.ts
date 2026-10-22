import { LANE_W } from '../types';
import { depthScale, groundRy, groundY, HORIZON_Y, screenX } from './projection';
import type { SpriteCache } from './sprites';
import { vGrad, type Ctx, type Stops } from './util';
import type { View } from './view';

/** A horizontally tiling strip that drifts left at `speed` logical px/s (sky only). */
export interface TileSpec {
  readonly y: number;
  readonly h: number;
  readonly w: number;
  readonly speed: number;
  /** draws in logical coords (absolute y); must wrap items across 0..w */
  draw(ctx: Ctx, w: number): void;
}

export interface WorldArt {
  readonly sky: Stops;
  readonly skyTo: number; // logical y where the sky gradient ends
  readonly tiles: readonly TileSpec[];
  /** horizon backdrop + perspective ground + side props, drawn once per size */
  drawScene(ctx: Ctx, v: View): void;
  /** animated details behind the drifting tiles (sun, planets) */
  backdrop(ctx: Ctx, v: View, t: number, sprites: SpriteCache): void;
  /** animated details over the static scene (waves, twinkles, lights) */
  front(ctx: Ctx, v: View, t: number, sprites: SpriteCache): void;
}

/** half-width of the 3-lane track in world px */
export const TRACK_HALF = LANE_W * 1.5 + 10;
export const Z_FAR = 4000;
export const Z_NEAR = -400;

/** Calls fn at x and its wrapped twins so items crossing a tile edge tile seamlessly. */
export function wrapped(x: number, w: number, fn: (x: number) => void): void {
  fn(x);
  fn(x - w);
  fn(x + w);
}

/** Soft cumulus cloud built from overlapping circles (flat-ish base). */
export function cloud(ctx: Ctx, x: number, y: number, s: number, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, y - s * 0.95, 0, y + s * 0.4);
  g.addColorStop(0, top);
  g.addColorStop(0.55, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x - s * 0.85, y, s * 0.42, 0, Math.PI * 2);
  ctx.moveTo(x - s * 0.3 + s * 0.62, y - s * 0.32);
  ctx.arc(x - s * 0.3, y - s * 0.32, s * 0.62, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.38 + s * 0.5, y - s * 0.2);
  ctx.arc(x + s * 0.38, y - s * 0.2, s * 0.5, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.92 + s * 0.36, y + s * 0.02);
  ctx.arc(x + s * 0.92, y + s * 0.02, s * 0.36, 0, Math.PI * 2);
  ctx.rect(x - s * 0.85, y - s * 0.05, s * 1.77, s * 0.43);
  ctx.fill();
}

/** Scatter tiny stars over a rect. */
export function starField(ctx: Ctx, rnd: () => number, x: number, y: number, w: number, h: number, n: number, maxR: number): void {
  for (let i = 0; i < n; i++) {
    const r = 0.35 + rnd() * rnd() * maxR;
    ctx.globalAlpha = 0.35 + rnd() * 0.65;
    ctx.fillStyle = rnd() < 0.2 ? '#BFD8FF' : rnd() < 0.15 ? '#FFE7B8' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x + rnd() * w, y + rnd() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Fill the whole ground plane (horizon → bottom of view). */
export function groundFill(ctx: Ctx, v: View, stops: Stops): void {
  const bottom = v.y0 + v.h;
  ctx.fillStyle = vGrad(ctx, HORIZON_Y, bottom, stops);
  ctx.fillRect(v.x0, HORIZON_Y, v.w, bottom - HORIZON_Y);
}

/** Path for a ground rectangle x0..x1 × z0..z1 (a trapezoid on screen). */
export function groundQuad(ctx: Ctx, x0: number, x1: number, z0: number, z1: number): void {
  ctx.beginPath();
  ctx.moveTo(screenX(x0, z0), groundY(z0));
  ctx.lineTo(screenX(x1, z0), groundY(z0));
  ctx.lineTo(screenX(x1, z1), groundY(z1));
  ctx.lineTo(screenX(x0, z1), groundY(z1));
  ctx.closePath();
}

/** Bands across the ground every `period` world px (mowing stripes, tiles). */
export function groundBands(ctx: Ctx, x0: number, x1: number, period: number, color: string): void {
  ctx.fillStyle = color;
  for (let z = Z_NEAR; z < Z_FAR; z += period * 2) {
    groundQuad(ctx, x0, x1, z, z + period);
    ctx.fill();
  }
}

/** Dashed lane separators at x = ±LANE_W/2, ±LANE_W*1.5. */
export function laneDashes(ctx: Ctx, color: string, width: number, dash: number, gap: number, outer: boolean): void {
  ctx.fillStyle = color;
  const xs = outer ? [-1.5, -0.5, 0.5, 1.5] : [-0.5, 0.5];
  for (const k of xs) {
    const x = k * LANE_W;
    for (let z = Z_NEAR; z < 2600; z += dash + gap) {
      const s0 = depthScale(z);
      const s1 = depthScale(z + dash);
      ctx.beginPath();
      ctx.moveTo(screenX(x - width / 2, z), groundY(z));
      ctx.lineTo(screenX(x + width / 2, z), groundY(z));
      ctx.lineTo(screenX(x + width / 2, z + dash), groundY(z + dash));
      ctx.lineTo(screenX(x - width / 2, z + dash), groundY(z + dash));
      ctx.closePath();
      ctx.globalAlpha = Math.min(1, 0.25 + (s0 + s1) * 0.5);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Ellipse lying on the ground at (x, z) with world radii rx, rz. */
export function groundOval(ctx: Ctx, x: number, z: number, rx: number, rz: number): void {
  ctx.beginPath();
  ctx.ellipse(screenX(x, z), groundY(z), Math.max(0.1, rx * depthScale(z)), Math.max(0.1, groundRy(z, rz)), 0, 0, Math.PI * 2);
}

/** Atmospheric haze toward the horizon, drawn over the ground. */
export function horizonHaze(ctx: Ctx, v: View, color: string, depth: number): void {
  const g = ctx.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + depth);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, HORIZON_Y - 1, v.w, depth + 1);
}

/** Item placed on the ground plane for depth-sorted billboard drawing. */
export interface Prop {
  readonly x: number;
  readonly z: number;
  readonly kind: number;
  readonly size: number;
}

/** Deterministic props down both sides of the track, sorted far → near. */
export function sideProps(rnd: () => number, kinds: number, zMin: number, zMax: number, step: number, xMin: number, xMax: number): Prop[] {
  const out: Prop[] = [];
  for (let z = zMin; z < zMax; z += step * (0.6 + rnd() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rnd() < 0.25) continue;
      out.push({ x: side * (xMin + rnd() * (xMax - xMin)), z: z + rnd() * step * 0.5, kind: Math.floor(rnd() * kinds), size: 0.8 + rnd() * 0.5 });
    }
  }
  return out.sort((a, b) => b.z - a.z);
}

/** Translate + scale the context to a billboard standing at (x, z). Caller restores. */
export function billboard(ctx: Ctx, x: number, z: number, scale: number): void {
  const s = depthScale(z) * scale;
  ctx.save();
  ctx.translate(screenX(x, z), groundY(z));
  ctx.scale(s, s);
}
