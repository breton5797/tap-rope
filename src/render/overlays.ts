// Full-screen mood overlays: fever hue pulse + speed lines, slow-mo blue vignette.
import { GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X } from '../types';
import { seeded, type Ctx } from './util';
import type { View } from './view';

const LINES = 16;
const lineY = new Float32Array(LINES);
const lineLen = new Float32Array(LINES);
const lineSpd = new Float32Array(LINES);
const lineOff = new Float32Array(LINES);
{
  const rnd = seeded(91);
  for (let i = 0; i < LINES; i++) {
    lineY[i] = 30 + rnd() * (GROUND_Y - 40);
    lineLen[i] = 40 + rnd() * 70;
    lineSpd[i] = 700 + rnd() * 600;
    lineOff[i] = rnd() * 2000;
  }
}

const HUE_FILLS: string[] = [];
for (let i = 0; i < 24; i++) HUE_FILLS.push(`hsla(${i * 15},100%,60%,0.3)`);

export class Overlays {
  private vignetteKey = '';
  private slowVignette: CanvasGradient | null = null;
  private feverEdge: CanvasGradient | null = null;

  fever(ctx: Ctx, v: View, t: number, reduced: boolean): void {
    this.ensure(ctx, v);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = HUE_FILLS[Math.floor(t * 8) % HUE_FILLS.length];
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.restore();
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 8);
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    ctx.fillStyle = this.feverEdge ?? 'transparent';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
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

  slowMo(ctx: Ctx, v: View, t: number): void {
    this.ensure(ctx, v);
    ctx.fillStyle = 'rgba(110,160,255,0.08)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 3);
    ctx.fillStyle = this.slowVignette ?? 'transparent';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  private ensure(ctx: Ctx, v: View): void {
    if (this.vignetteKey === v.key) return;
    this.vignetteKey = v.key;
    const cx = PLAYER_X;
    const cy = LOGICAL_H * 0.6;
    const r = Math.max(v.w, v.h) * 0.75;
    const sv = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    sv.addColorStop(0, 'rgba(40,90,220,0)');
    sv.addColorStop(1, 'rgba(40,80,220,0.42)');
    this.slowVignette = sv;
    const fe = ctx.createRadialGradient(LOGICAL_W / 2, cy, r * 0.45, LOGICAL_W / 2, cy, r);
    fe.addColorStop(0, 'rgba(255,80,200,0)');
    fe.addColorStop(0.6, 'rgba(255,140,60,0.2)');
    fe.addColorStop(1, 'rgba(255,60,200,0.6)');
    this.feverEdge = fe;
  }
}
