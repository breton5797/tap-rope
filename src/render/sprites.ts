import { makeCanvas, type Ctx } from './util';

/** A pre-rendered bitmap in logical units; (ax, ay) is the anchor inside it. */
export interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly w: number;
  readonly h: number;
  readonly ax: number;
  readonly ay: number;
}

/** Draw callback; receives a context whose origin is the sprite anchor. */
export type SpriteDraw = (ctx: Ctx, arg: number) => void;

/**
 * Caches sprites at the current device scale. Rebuilt lazily after resize so
 * everything stays pixel-crisp without per-frame gradient/shadow work.
 */
export class SpriteCache {
  private readonly map = new Map<string, Sprite>();
  private k = 1;

  setScale(k: number): void {
    if (Math.abs(k - this.k) < 1e-6) return;
    this.k = k;
    this.map.clear();
  }

  get(key: string, w: number, h: number, ax: number, ay: number, draw: SpriteDraw, arg = 0): Sprite {
    const hit = this.map.get(key);
    if (hit) return hit;
    const k = this.k;
    const { canvas, ctx } = makeCanvas(w * k, h * k);
    ctx.setTransform(k, 0, 0, k, ax * k, ay * k);
    draw(ctx, arg);
    const sprite: Sprite = { canvas, w, h, ax, ay };
    this.map.set(key, sprite);
    return sprite;
  }
}

export function blit(ctx: Ctx, sp: Sprite, x: number, y: number): void {
  ctx.drawImage(sp.canvas, x - sp.ax, y - sp.ay, sp.w, sp.h);
}

export function blitScaled(ctx: Ctx, sp: Sprite, x: number, y: number, sx: number, sy: number): void {
  ctx.drawImage(sp.canvas, x - sp.ax * sx, y - sp.ay * sy, sp.w * sx, sp.h * sy);
}
