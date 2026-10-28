// Electric zap bursts (laser hits): flickering jagged arcs around the impact point.
import { circle, type Ctx } from './util';

const CAP = 4;
const LIFE = 0.32;

export class ZapPool {
  private readonly x = new Float32Array(CAP);
  private readonly y = new Float32Array(CAP);
  private readonly age = new Float32Array(CAP).fill(LIFE);
  private readonly scale = new Float32Array(CAP).fill(1);
  private next = 0;
  private clock = 0;

  /** `scale` > 1: a bigger, longer-reaching discharge (v7.1 hit: arcs crawling over the body) */
  add(x: number, y: number, scale = 1): void {
    const i = this.next;
    this.next = (i + 1) % CAP;
    this.x[i] = x;
    this.y[i] = y;
    this.scale[i] = scale;
    this.age[i] = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    for (let i = 0; i < CAP; i++) this.age[i] = Math.min(LIFE, this.age[i] + dt);
  }

  draw(ctx: Ctx): void {
    const frame = Math.floor(this.clock * 30);
    for (let i = 0; i < CAP; i++) {
      if (this.age[i] >= LIFE) continue;
      const f = this.age[i] / LIFE;
      this.arcs(ctx, this.x[i], this.y[i], 1 - f, frame + i * 17, this.scale[i]);
    }
  }

  private arcs(ctx: Ctx, cx: number, cy: number, a: number, seed: number, k: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#FF2A3A';
    ctx.globalAlpha = 0.22 * a;
    circle(ctx, cx, cy, (18 + (1 - a) * 14) * k);
    ctx.fill();
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? '#FF4A55' : '#FFFFFF';
      ctx.globalAlpha = a;
      ctx.lineWidth = pass === 0 ? 2.2 : 0.9;
      ctx.beginPath();
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2 + hash(seed + b) * 0.8;
        let px = cx;
        let py = cy;
        ctx.moveTo(px, py);
        for (let s = 1; s <= 4; s++) {
          const r = s * 7 * k * (0.6 + a * 0.6);
          const j = (hash(seed * 3 + b * 7 + s) - 0.5) * 10 * k;
          px = cx + Math.cos(ang) * r - Math.sin(ang) * j;
          py = cy + Math.sin(ang) * r + Math.cos(ang) * j;
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
