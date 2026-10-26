// Cinematic post pass (GDD-v6 §4), all pre-rendered so it is a handful of blits per frame:
// light shafts under the ceiling fixtures, drifting dust motes, a vignette, very light film grain
// (a noise tile jittered every frame) and a brief chromatic split on hits. Reduced motion turns off
// grain and the chromatic split (shake / flash are handled by Effects).
import { PLAYER_X, type Variant } from '../types';
import { CEIL_Y, FLOOR_FRONT } from './layout';
import type { ShaftRig } from './corridor';
import { makeCanvas, releaseCanvas, seeded, type Ctx } from './util';
import type { View } from './view';

const GRAIN = 128;
const VIGNETTE_RES = 0.25;
const SHAFT_W = 96;
const MOTES = 26;
/** seconds the hit chromatic split lasts (~7 frames at 60fps) */
const CHROMA_TIME = 0.12;

const moteX = new Float32Array(MOTES);
const moteY = new Float32Array(MOTES);
const moteS = new Float32Array(MOTES);
{
  const rnd = seeded(733);
  for (let i = 0; i < MOTES; i++) {
    moteX[i] = rnd();
    moteY[i] = rnd();
    moteS[i] = 0.4 + rnd() * 0.9;
  }
}

/** shaft tint per variant (null = no shafts: lights are off / it is outdoors) */
const SHAFT: Readonly<Record<Variant, string | null>> = {
  base: 'rgba(255,214,160,1)',
  alarm: 'rgba(255,90,90,1)',
  dark: null,
  steam: 'rgba(220,230,235,1)',
  night: 'rgba(150,180,255,1)',
  dawn: 'rgba(255,190,130,1)',
};

export class Post {
  private key = '';
  private vignette: HTMLCanvasElement | null = null;
  private grain: HTMLCanvasElement | null = null;
  private pattern: CanvasPattern | null = null;
  private readonly shaftByTint = new Map<string, HTMLCanvasElement>();
  private frame = 0;

  bytes(): number {
    let b = 0;
    for (const c of [this.vignette, this.grain, ...this.shaftByTint.values()]) if (c) b += c.width * c.height * 4;
    return b;
  }

  /** Light shafts falling from the ceiling lamps (they scroll with the lamps' layer). */
  shafts(ctx: Ctx, v: View, variant: Variant, scroll: number, fade: number, rig: ShaftRig): void {
    const tint = SHAFT[variant];
    if (!tint || fade <= 0.01 || rig.xs.length === 0) return;
    this.ensure(ctx, v);
    let shaft = this.shaftByTint.get(tint);
    if (!shaft) {
      shaft = buildShaft(tint);
      this.shaftByTint.set(tint, shaft);
    }
    const a = (variant === 'steam' ? 0.12 : 0.07) * fade;
    const h = FLOOR_FRONT - rig.y;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    const step = rig.w * rig.s;
    let m = Math.floor((PLAYER_X + (v.x0 - SHAFT_W - PLAYER_X) / rig.s + scroll) / rig.w);
    let base = PLAYER_X + (m * rig.w - scroll - PLAYER_X) * rig.s;
    while (base < v.x0 + v.w + SHAFT_W) {
      for (const lx of rig.xs) {
        const x = base + lx * rig.s;
        if (x < v.x0 - SHAFT_W || x > v.x0 + v.w + SHAFT_W) continue;
        ctx.drawImage(shaft, x - SHAFT_W / 2, rig.y, SHAFT_W, h);
      }
      base += step;
      m++;
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Dust motes drifting through the light (screen space, parallax-free). */
  dust(ctx: Ctx, v: View, t: number, scroll: number, reduced: boolean): void {
    ctx.fillStyle = '#FFE2B8';
    const tt = reduced ? t * 0.3 : t;
    for (let i = 0; i < MOTES; i++) {
      const x = v.x0 + ((moteX[i] * v.w - scroll * 0.15 * moteS[i] + tt * 6 * moteS[i]) % v.w + v.w) % v.w;
      const y = CEIL_Y + 20 + ((moteY[i] * 300 + Math.sin(tt * 0.7 + i) * 8 + tt * 3 * moteS[i]) % 300);
      ctx.globalAlpha = 0.12 + 0.18 * moteS[i] * (0.6 + 0.4 * Math.sin(tt * 1.3 + i * 2.1));
      ctx.fillRect(x, y, moteS[i], moteS[i]);
    }
    ctx.globalAlpha = 1;
  }

  /** Vignette + grain over the finished world (before the HUD strip). */
  finish(ctx: Ctx, v: View, reduced: boolean): void {
    this.ensure(ctx, v);
    if (this.vignette) ctx.drawImage(this.vignette, v.x0, v.y0, v.w, v.h);
    if (reduced || !this.pattern) return;
    // grain: one noise tile, jittered every frame, very low opacity
    this.frame = (this.frame + 1) % 64;
    const ox = (this.frame * 37) % GRAIN;
    const oy = (this.frame * 53) % GRAIN;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(v.x0 - ox, v.y0 - oy, v.w, v.h);
    ctx.restore();
  }

  /**
   * Brief chromatic split right after a hit, kept cheap: for ~7 frames only the box around the
   * agent is re-drawn shifted (additive) and tinted red — not the whole frame.
   */
  chromatic(ctx: Ctx, canvas: HTMLCanvasElement, v: View, x: number, y: number, hitAge: number, reduced: boolean): void {
    if (reduced || hitAge > CHROMA_TIME) return;
    const k = 1 - hitAge / CHROMA_TIME;
    // agent box in device px (logical → device: × v.k, + offset)
    const bx = Math.max(0, Math.floor((x - 60) * v.k + v.ox * v.dpr));
    const by = Math.max(0, Math.floor((y - 120) * v.k + v.oy * v.dpr));
    const bw = Math.min(canvas.width - bx, Math.ceil(120 * v.k));
    const bh = Math.min(canvas.height - by, Math.ceil(140 * v.k));
    if (bw <= 0 || bh <= 0) return;
    const d = Math.max(2, Math.round(3 * v.k * k));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28 * k;
    ctx.drawImage(canvas, bx, by, bw, bh, bx + d, by, bw, bh);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3 * k;
    ctx.fillStyle = '#FF6070';
    ctx.fillRect(bx, by, bw + d, bh);
    ctx.restore();
  }

  private ensure(ctx: Ctx, v: View): void {
    if (this.key === v.key) return;
    this.key = v.key;
    releaseCanvas(this.vignette);
    this.vignette = this.buildVignette(v);
    if (!this.grain) {
      this.grain = buildGrain();
    }
    this.pattern = ctx.createPattern(this.grain, 'repeat');
  }

  private buildVignette(v: View): HTMLCanvasElement {
    const { canvas, ctx } = makeCanvas(v.w * VIGNETTE_RES, v.h * VIGNETTE_RES);
    ctx.setTransform(VIGNETTE_RES, 0, 0, VIGNETTE_RES, -v.x0 * VIGNETTE_RES, -v.y0 * VIGNETTE_RES);
    const cx = PLAYER_X + 70;
    const cy = 400;
    const r = Math.max(v.w, v.h) * 0.72;
    const g = ctx.createRadialGradient(cx, cy, r * 0.32, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(2,6,8,0.28)');
    g.addColorStop(1, 'rgba(2,5,7,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    return canvas;
  }
}

function buildGrain(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(GRAIN, GRAIN);
  const img = ctx.createImageData(GRAIN, GRAIN);
  const rnd = seeded(91);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.floor(rnd() * 255);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** A soft volumetric cone: narrow and bright at the fixture, wide and faint at the floor. */
function buildShaft(tint: string): HTMLCanvasElement {
  const w = 64;
  const h = 128;
  const { canvas, ctx } = makeCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.06, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.38, 0);
  ctx.lineTo(w * 0.62, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);
  // soften the cone's side edges
  ctx.globalCompositeOperation = 'destination-out';
  for (const [x0, x1] of [[0, w * 0.3], [w, w * 0.7]] as const) {
    const e = ctx.createLinearGradient(x0, 0, x1, 0);
    e.addColorStop(0, 'rgba(0,0,0,1)');
    e.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = e;
    ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), h);
  }
  return canvas;
}
