// v7.1 impact layers (GDD-v7.1 §3): pooled shock rings (floor ellipses, round, hexagon), air streaks
// (speed lines of a lane change) and white glints (graze / shield / boost). Fixed caps, typed arrays,
// one cached glow sprite: nothing is allocated per frame.
import { RingShape, type RingShapeId } from './impact';
import { makeCanvas, TAU, type Ctx } from './util';

const RINGS = 12;
const STREAKS = 24;
const GLINTS = 4;
const GLOW = 64;
const GLINT_LIFE = 0.2;
/** px/s the corridor drifts past the agent (rings / streaks left on the floor slide back with it) */
const DRIFT = 160;

export class ImpactLayer {
  // rings: x, y, age (negative = delayed), life, radius, width
  private readonly rx = new Float32Array(RINGS);
  private readonly ry = new Float32Array(RINGS);
  private readonly rAge = new Float32Array(RINGS).fill(9);
  private readonly rLife = new Float32Array(RINGS).fill(1);
  private readonly rR = new Float32Array(RINGS);
  private readonly rW = new Float32Array(RINGS);
  private readonly rShape = new Uint8Array(RINGS);
  private readonly rColor: string[] = new Array<string>(RINGS).fill('#FFFFFF');
  private rNext = 0;
  // streaks: x, y, dy (direction of travel), length, age, life
  private readonly sx = new Float32Array(STREAKS);
  private readonly sy = new Float32Array(STREAKS);
  private readonly sdy = new Float32Array(STREAKS);
  private readonly sLen = new Float32Array(STREAKS);
  private readonly sAge = new Float32Array(STREAKS).fill(9);
  private readonly sLife = new Float32Array(STREAKS).fill(1);
  private sNext = 0;
  // glints: x, y, size, age
  private readonly gx = new Float32Array(GLINTS);
  private readonly gy = new Float32Array(GLINTS);
  private readonly gS = new Float32Array(GLINTS);
  private readonly gAge = new Float32Array(GLINTS).fill(9);
  private readonly gColor: string[] = new Array<string>(GLINTS).fill('#FFFFFF');
  private gNext = 0;
  private glow: HTMLCanvasElement | null = null;
  /** glint / ring brightness (0.5 with reduced motion) */
  intensity = 1;

  ring(x: number, y: number, r: number, width: number, life: number, shape: RingShapeId, color: string, delay = 0): void {
    const i = this.rNext;
    this.rNext = (i + 1) % RINGS;
    this.rx[i] = x;
    this.ry[i] = y;
    this.rAge[i] = -delay;
    this.rLife[i] = Math.max(0.05, life);
    this.rR[i] = r;
    this.rW[i] = width;
    this.rShape[i] = shape;
    this.rColor[i] = color;
  }

  /** speed lines along a vertical lane change: `dir` −1 = moving up the screen (toward lane 0) */
  streaks(x: number, y: number, dir: -1 | 1, n: number, span: number): void {
    for (let k = 0; k < n; k++) {
      const i = this.sNext;
      this.sNext = (i + 1) % STREAKS;
      this.sx[i] = x - 26 + (k / Math.max(1, n - 1)) * 52 + (Math.random() - 0.5) * 8;
      this.sy[i] = y - span * (0.15 + Math.random() * 0.85);
      this.sdy[i] = dir;
      this.sLen[i] = 30 + Math.random() * 34;
      this.sAge[i] = -k * 0.012;
      this.sLife[i] = 0.2 + Math.random() * 0.08;
    }
  }

  glint(x: number, y: number, size: number, color: string): void {
    const i = this.gNext;
    this.gNext = (i + 1) % GLINTS;
    this.gx[i] = x;
    this.gy[i] = y;
    this.gS[i] = size;
    this.gAge[i] = 0;
    this.gColor[i] = color;
  }

  update(d: number): void {
    for (let i = 0; i < RINGS; i++) {
      this.rAge[i] += d;
      if (this.rShape[i] === RingShape.Ground && this.rAge[i] > 0) this.rx[i] -= DRIFT * d;
    }
    for (let i = 0; i < STREAKS; i++) {
      this.sAge[i] += d;
      this.sx[i] -= DRIFT * 1.5 * d;
    }
    for (let i = 0; i < GLINTS; i++) this.gAge[i] += d;
  }

  /** rings and streaks: drawn under the particles */
  drawUnder(ctx: Ctx): void {
    this.drawRings(ctx);
    this.drawStreaks(ctx);
  }

  /** glints: drawn on top of everything in the world */
  drawOver(ctx: Ctx): void {
    let any = false;
    for (let i = 0; i < GLINTS; i++) if (this.gAge[i] < GLINT_LIFE) any = true;
    if (!any) return;
    const glow = this.glowSprite();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < GLINTS; i++) {
      const age = this.gAge[i];
      if (age >= GLINT_LIFE) continue;
      const f = age / GLINT_LIFE;
      // pops in over the first 15% of its life, then shrinks and fades
      const a = (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * this.intensity;
      const s = this.gS[i] * (0.7 + 0.5 * Math.min(1, f * 4));
      const x = this.gx[i];
      const y = this.gy[i];
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(glow, x - s, y - s, s * 2, s * 2);
      // four-point star: long horizontal flare, short vertical
      ctx.strokeStyle = this.gColor[i];
      ctx.globalAlpha = a;
      ctx.lineWidth = 2.2 * (1 - f) + 0.6;
      ctx.beginPath();
      ctx.moveTo(x - s * 1.6, y);
      ctx.lineTo(x + s * 1.6, y);
      ctx.moveTo(x, y - s * 0.8);
      ctx.lineTo(x, y + s * 0.8);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private drawRings(ctx: Ctx): void {
    for (let i = 0; i < RINGS; i++) {
      const age = this.rAge[i];
      const life = this.rLife[i];
      if (age < 0 || age >= life) continue;
      const f = age / life;
      const e = 1 - (1 - f) * (1 - f) * (1 - f); // fast out
      const r = 4 + this.rR[i] * e;
      ctx.globalAlpha = (1 - f) * this.intensity;
      ctx.strokeStyle = this.rColor[i];
      ctx.lineWidth = this.rW[i] * (1 - f) + 0.5;
      ctx.beginPath();
      const shape = this.rShape[i];
      if (shape === RingShape.Ground) ctx.ellipse(this.rx[i], this.ry[i], r, r * 0.26, 0, 0, TAU);
      else if (shape === RingShape.Round) ctx.arc(this.rx[i], this.ry[i], r, 0, TAU);
      else hexPath(ctx, this.rx[i], this.ry[i], r, f * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawStreaks(ctx: Ctx): void {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#DDF6FF';
    ctx.lineCap = 'round';
    for (let i = 0; i < STREAKS; i++) {
      const age = this.sAge[i];
      const life = this.sLife[i];
      if (age < 0 || age >= life) continue;
      const f = age / life;
      // the line stretches out along the travel direction, then its tail catches up
      const len = this.sLen[i];
      const head = this.sy[i] + this.sdy[i] * len * Math.min(1, f * 2.5);
      const tail = this.sy[i] + this.sdy[i] * len * Math.max(0, f * 1.6 - 0.6);
      ctx.globalAlpha = 0.8 * (1 - f);
      ctx.lineWidth = 2.4 * (1 - f) + 0.8;
      ctx.beginPath();
      ctx.moveTo(this.sx[i], tail);
      ctx.lineTo(this.sx[i], head);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private glowSprite(): HTMLCanvasElement {
    if (this.glow) return this.glow;
    const { canvas, ctx } = makeCanvas(GLOW, GLOW);
    const g = ctx.createRadialGradient(GLOW / 2, GLOW / 2, 0, GLOW / 2, GLOW / 2, GLOW / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,250,235,0.75)');
    g.addColorStop(0.5, 'rgba(255,220,170,0.18)');
    g.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW, GLOW);
    this.glow = canvas;
    return canvas;
  }
}

/** a hexagon outline path (shield ring / shards) */
export function hexPath(ctx: Ctx, x: number, y: number, r: number, rot: number): void {
  for (let k = 0; k < 6; k++) {
    const a = rot + (k / 6) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
