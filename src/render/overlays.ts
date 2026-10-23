// Full-screen mood overlays: fever hue pulse + edge glow + speed lines, slow-mo blue vignette.
// Vignettes are smooth, so they are pre-rendered once per view at low resolution and
// stretched — a single drawImage instead of a per-frame full-screen gradient.
import { GROUND_Y } from '../types';
import { circle, makeCanvas, seeded, type Ctx } from './util';
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

const HUE_FILLS: string[] = [];
for (let i = 0; i < 24; i++) HUE_FILLS.push(`hsla(${i * 15},100%,62%,0.09)`);

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
    ctx.fillStyle = HUE_FILLS[Math.floor(t * 8) % HUE_FILLS.length];
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 8);
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    if (this.edge) ctx.drawImage(this.edge, v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
    if (reduced) return;
    const span = v.w + 200;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    for (let i = 0; i < LINES; i++) {
      const x = v.x0 + v.w + 100 - ((t * lineSpd[i] + lineOff[i]) % span);
      ctx.globalAlpha = 0.3 + (i % 3) * 0.14;
      ctx.lineWidth = i % 4 === 0 ? 3 : 1.8;
      ctx.beginPath();
      ctx.moveTo(x, lineY[i]);
      ctx.lineTo(x + lineLen[i], lineY[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Glowing shield bubble around the agent. */
  shield(ctx: Ctx, x: number, y: number, t: number): void {
    const r = 33 + Math.sin(t * 4) * 1.2;
    ctx.fillStyle = 'rgba(90,200,255,0.16)';
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,235,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, r - 5, Math.PI * 1.1 + Math.sin(t) * 0.1, Math.PI * 1.35 + Math.sin(t) * 0.1);
    ctx.stroke();
  }

  slowMo(ctx: Ctx, v: View, t: number): void {
    this.ensure(v);
    ctx.fillStyle = 'rgba(110,160,255,0.08)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3);
    if (this.slow) ctx.drawImage(this.slow, v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  private ensure(v: View): void {
    if (this.key === v.key) return;
    this.key = v.key;
    this.slow = vignette(v, 0.35, [[0, 'rgba(40,90,220,0)'], [1, 'rgba(40,80,220,0.42)']]);
    this.edge = vignette(v, 0.45, [[0, 'rgba(255,80,200,0)'], [0.6, 'rgba(255,140,60,0.2)'], [1, 'rgba(255,60,200,0.6)']]);
  }
}
