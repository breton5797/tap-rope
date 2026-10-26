// Full-screen mood overlays: overdrive (fever) amber edge burn + speed streaks, slow-mo teal vignette, shield field.
// Vignettes are smooth, so they are pre-rendered once per view at low resolution and
// stretched — a single drawImage instead of a per-frame full-screen gradient.
import { GROUND_Y } from '../types';
import { makeCanvas, releaseCanvas, seeded, type Ctx } from './util';
import type { View } from './view';

const HORIZON_Y = 150;
const NEAR_Y = GROUND_Y;

const LINES = 16;
const VIGNETTE_RES = 0.25; // device px per logical px for the vignette bitmaps
const lineY = new Float32Array(LINES);
const lineLen = new Float32Array(LINES);
const lineSpd = new Float32Array(LINES);
const lineOff = new Float32Array(LINES);
{
  const rnd = seeded(91);
  for (let i = 0; i < LINES; i++) {
    lineY[i] = HORIZON_Y - 60 + rnd() * (NEAR_Y - HORIZON_Y + 40);
    lineLen[i] = 40 + rnd() * 70;
    lineSpd[i] = 700 + rnd() * 600;
    lineOff[i] = rnd() * 2000;
  }
}


type Stops = readonly (readonly [number, string])[];

function vignette(v: View, inner: number, stops: Stops): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(v.w * VIGNETTE_RES, v.h * VIGNETTE_RES);
  ctx.setTransform(VIGNETTE_RES, 0, 0, VIGNETTE_RES, -v.x0 * VIGNETTE_RES, -v.y0 * VIGNETTE_RES);
  const cx = v.x0 + v.w / 2;
  const cy = NEAR_Y - 60;
  const r = Math.max(v.w, v.h) * 0.75;
  const g = ctx.createRadialGradient(cx, cy, r * inner, cx, cy, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
  return canvas;
}

export class Overlays {
  private key = '';
  private slow: HTMLCanvasElement | null = null;
  private edge: HTMLCanvasElement | null = null;

  fever(ctx: Ctx, v: View, t: number, reduced: boolean): void {
    this.ensure(v);
    // overdrive: warm amber edge burn + thin speed streaks (no rainbow)
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    if (this.edge) ctx.drawImage(this.edge, v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
    if (reduced) return;
    const span = v.w + 200;
    ctx.strokeStyle = '#FFD08A';
    ctx.lineCap = 'butt';
    for (let i = 0; i < LINES; i++) {
      const x = v.x0 + v.w + 100 - ((t * lineSpd[i] + lineOff[i]) % span);
      ctx.globalAlpha = 0.12 + (i % 3) * 0.06;
      ctx.lineWidth = i % 4 === 0 ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(x, lineY[i]);
      ctx.lineTo(x + lineLen[i], lineY[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Energy shield: a faint teal hex-lattice ellipse around the agent with a bright leading arc. */
  shield(ctx: Ctx, x: number, y: number, t: number): void {
    const rx = 26;
    const ry = 50;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#3FE0D0';
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3FE0D0';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(x - rx * 0.9, y + i * 18);
      ctx.lineTo(x + rx * 0.9, y + i * 18 + 6);
    }
    ctx.stroke();
    const a0 = t * 2.5;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, a0, a0 + 0.9);
    ctx.stroke();
    ctx.restore();
  }

  slowMo(ctx: Ctx, v: View, t: number): void {
    this.ensure(v);
    ctx.fillStyle = 'rgba(63,224,208,0.06)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3);
    if (this.slow) ctx.drawImage(this.slow, v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  bytes(): number {
    let b = 0;
    for (const c of [this.slow, this.edge]) if (c) b += c.width * c.height * 4;
    return b;
  }

  private ensure(v: View): void {
    if (this.key === v.key) return;
    this.key = v.key;
    releaseCanvas(this.slow);
    releaseCanvas(this.edge);
    this.slow = vignette(v, 0.35, [[0, 'rgba(20,90,100,0)'], [1, 'rgba(20,110,120,0.4)']]);
    this.edge = vignette(v, 0.45, [[0, 'rgba(255,140,40,0)'], [0.6, 'rgba(255,140,40,0.12)'], [1, 'rgba(255,120,30,0.42)']]);
  }
}
