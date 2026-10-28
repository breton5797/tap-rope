import { makeCanvas, releaseCanvas, type Ctx } from './util';

/** v8 rim: outline width, halo radius and padding (logical px) */
const RIM_LINE = 1.1;
const RIM_GLOW = 3.2;
const RIM_PAD = 5;

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
    for (const sp of this.map.values()) releaseCanvas(sp.canvas);
    this.map.clear();
  }

  bytes(): number {
    let b = 0;
    for (const sp of this.map.values()) b += sp.canvas.width * sp.canvas.height * 4;
    return b;
  }

  /**
   * v8 (GDD-v8 A2): rim for a cached sprite: a 1.5 px light outline of its silhouette over a soft
   * coloured halo, cached under `key` (pass a constant key; draw it additively just before the sprite).
   */
  rim(key: string, src: Sprite, line: string, glow: string): Sprite {
    const hit = this.map.get(key);
    if (hit) return hit;
    const k = this.k;
    const w = src.w + RIM_PAD * 2;
    const h = src.h + RIM_PAD * 2;
    const out = makeCanvas(w * k, h * k);
    const tmp = makeCanvas(w * k, h * k);
    const stamp = (c: Ctx, r: number, n: number, a: number, color: string): void => {
      c.setTransform(k, 0, 0, k, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        c.drawImage(src.canvas, RIM_PAD + Math.cos(ang) * r, RIM_PAD + Math.sin(ang) * r, src.w, src.h);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
    };
    stamp(out.ctx, RIM_GLOW, 16, 0.22, glow);
    stamp(tmp.ctx, RIM_LINE, 12, 1, line);
    out.ctx.setTransform(1, 0, 0, 1, 0, 0);
    out.ctx.drawImage(tmp.canvas, 0, 0);
    releaseCanvas(tmp.canvas);
    const sprite: Sprite = { canvas: out.canvas, w, h, ax: src.ax + RIM_PAD, ay: src.ay + RIM_PAD };
    this.map.set(key, sprite);
    return sprite;
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

/** v8 hazard rim colours: light outline, red halo */
export const HAZARD_LINE = '#EAF7F5';
export const HAZARD_GLOW = '#FF3C48';

/** v8 (A2): draws `sp` with its cached rim (outline + halo, additive) underneath; `rimKey` is a constant key. */
export function blitRimmed(ctx: Ctx, cache: SpriteCache, rimKey: string, sp: Sprite, x: number, y: number, sx: number, sy: number): void {
  const rim = cache.rim(rimKey, sp, HAZARD_LINE, HAZARD_GLOW);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  blitScaled(ctx, rim, x, y, sx, sy);
  ctx.globalCompositeOperation = op;
  blitScaled(ctx, sp, x, y, sx, sy);
}
