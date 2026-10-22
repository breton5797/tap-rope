import type { SpriteCache } from './sprites';
import type { Ctx, Stops } from './util';
import type { View } from './view';

/** A horizontally tiling strip that drifts left at `speed` logical px/s. */
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
  /** static scenery + ground, drawn once per size into an offscreen canvas */
  drawScene(ctx: Ctx, v: View): void;
  /** animated details behind the drifting tiles (sun, planets) */
  backdrop(ctx: Ctx, v: View, t: number, sprites: SpriteCache): void;
  /** animated details over the static scene (waves, twinkles, flicker) */
  front(ctx: Ctx, v: View, t: number, sprites: SpriteCache): void;
}

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
