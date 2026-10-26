// Pooled particles (dust, sparks), impact rings, text popups, screen shake, flash and the hit
// timer the post pass uses for its brief chromatic split (GDD-v6 §4). No stars or confetti.
import { GROUND_Y, PLAYER_X, type BurstKind, type EffectsApi, type PopupStyle } from '../types';
import { drawPopups, PopupPool } from './popups';
import { ZapPool } from './zaps';
import { clamp, TAU, type Ctx } from './util';
import type { View } from './view';

const CAP = 300;
const RING_CAP = 12;
/** Puff = soft dust; Spark = short additive streak along its velocity */
const Shape = { Puff: 0, Spark: 1 } as const;

const COLORS = ['#FFFFFF', '#FFD08A', '#FFB020', '#FF2A3A', '#FF8A3A', '#3FE0D0', '#8A857E', '#C8CED4'];
const C = { white: 0, pale: 1, amber: 2, red: 3, orange: 4, teal: 5, dust: 6, steel: 7 } as const;

export class Effects implements EffectsApi {
  reduced = false;
  /** screen position of the player's feet, updated by the renderer */
  anchorX = PLAYER_X;
  feetY = GROUND_Y;
  /** px from the feet up to the body centre */
  bodyLift = 34;
  /** where a full-width laser at the agent crosses its lane this frame (x < 0 = none) */
  contactX = -1;
  contactY = 0;
  private n = 0;
  private readonly px = new Float32Array(CAP);
  private readonly py = new Float32Array(CAP);
  private readonly vx = new Float32Array(CAP);
  private readonly vy = new Float32Array(CAP);
  private readonly life = new Float32Array(CAP);
  private readonly max = new Float32Array(CAP);
  private readonly size = new Float32Array(CAP);
  private readonly rot = new Float32Array(CAP);
  private readonly vr = new Float32Array(CAP);
  private readonly grav = new Float32Array(CAP);
  private readonly shape = new Uint8Array(CAP);
  private readonly color = new Uint8Array(CAP);
  private readonly ring = new Float32Array(RING_CAP * 4); // x, y, age, maxR
  private readonly ringColor = new Uint8Array(RING_CAP);
  private ringNext = 0;
  private readonly popups = new PopupPool();
  private readonly zaps = new ZapPool();
  private shakeAmp = 0;
  private clock = 0;
  private flashColor = '#FFFFFF';
  private flashAlpha = 0;

  burst(kind: BurstKind, x?: number, y?: number): void {
    const feetY = this.feetY;
    const bx = x ?? this.anchorX;
    const by = y ?? (kind === 'dust' ? feetY : feetY - this.bodyLift);
    const k = this.reduced ? 0.4 : 1;
    switch (kind) {
      case 'dust': return this.dust(bx, by, k);
      case 'sparkle': return this.radial(bx, by, Math.round(6 * k), Shape.Spark, C.teal, C.white, 80, 160, 0.3);
      case 'coin':
        this.ringAt(bx, by, 18, C.amber);
        return this.radial(bx, by, Math.round(6 * k), Shape.Spark, C.amber, C.pale, 60, 140, 0.3);
      case 'hit': {
        // sparks fly where the laser crosses the agent's lane (if one is there), else at the body
        const hx = x === undefined && this.contactX >= 0 ? this.contactX : bx;
        const hy = x === undefined && this.contactX >= 0 ? this.contactY : by;
        this.zaps.add(hx, hy);
        this.hitAge = 0;
        if (!this.reduced) {
          this.flashColor = '#FF2A3A';
          this.flashAlpha = Math.max(this.flashAlpha, 0.32);
        }
        this.ringAt(hx, hy, 30, C.red);
        return this.radial(hx, hy, Math.round(16 * k), Shape.Spark, C.orange, C.pale, 160, 360, 0.35, 500);
      }
      case 'powerup':
        this.ringAt(bx, by, 36, C.teal);
        return this.radial(bx, by, Math.round(10 * k), Shape.Spark, C.teal, C.white, 60, 140, 0.45, -60);
      case 'confetti': return this.shower(bx, by, Math.round(26 * k));
    }
  }

  /** seconds since the last hit burst (drives the post pass's chromatic split) */
  hitAge = 9;

  popup(text: string, style: PopupStyle): void {
    this.popups.add(text, style, this.feetY - 80);
  }

  shake(intensity: number): void {
    if (this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, clamp(intensity, 0, 1) * 9);
  }

  flash(color: string): void {
    if (this.reduced) return;
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, 0.3);
  }

  update(dt: number): void {
    const d = clamp(dt, 0, 0.1);
    this.clock += d;
    this.hitAge += d;
    this.shakeAmp *= Math.exp(-d * 9);
    if (this.shakeAmp < 0.05) this.shakeAmp = 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - d * 2.6);
    this.popups.update(d);
    this.stepParticles(d);
    for (let i = 0; i < RING_CAP; i++) this.ring[i * 4 + 2] += d;
    this.zaps.update(d);
  }

  shakeX(): number {
    return this.shakeAmp * Math.sin(this.clock * 73);
  }

  shakeY(): number {
    return this.shakeAmp * Math.cos(this.clock * 61);
  }

  drawWorld(ctx: Ctx): void {
    this.drawRings(ctx);
    this.zaps.draw(ctx);
    this.drawParticles(ctx);
    drawPopups(ctx, this.popups);
  }

  drawFlash(ctx: Ctx, v: View): void {
    if (this.flashAlpha <= 0) return;
    ctx.globalAlpha = this.flashAlpha;
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  private dust(x: number, y: number, k: number): void {
    const n = Math.round(9 * k);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.spawn(x + dir * (4 + Math.random() * 6), y - 2, dir * (40 + Math.random() * 90), -10 - Math.random() * 40, 0.45 + Math.random() * 0.2, 3 + Math.random() * 3, Shape.Puff, C.dust, -30);
    }
  }

  private radial(x: number, y: number, n: number, shape: number, c1: number, c2: number, s0: number, s1: number, life: number, g = 0): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.4;
      const sp = s0 + Math.random() * (s1 - s0);
      this.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.7 + Math.random() * 0.5), 2 + Math.random() * 3, shape, i % 3 === 0 ? c2 : c1, g);
    }
  }

  /** Clear / celebration: a restrained shower of amber and teal sparks rising and falling. */
  private shower(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 180 + Math.random() * 220;
      this.spawn(x + (Math.random() - 0.5) * 50, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + Math.random() * 0.5, 2, Shape.Spark, i % 2 ? C.amber : C.teal, 420);
    }
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, shape: number, color: number, g: number): void {
    const i = this.n < CAP ? this.n++ : Math.floor(Math.random() * CAP);
    this.px[i] = x;
    this.py[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.rot[i] = Math.random() * TAU;
    this.vr[i] = (Math.random() - 0.5) * 14;
    this.grav[i] = g;
    this.shape[i] = shape;
    this.color[i] = color;
  }

  private ringAt(x: number, y: number, r: number, color: number): void {
    const i = this.ringNext;
    this.ringNext = (i + 1) % RING_CAP;
    this.ring[i * 4] = x;
    this.ring[i * 4 + 1] = y;
    this.ring[i * 4 + 2] = 0;
    this.ring[i * 4 + 3] = r;
    this.ringColor[i] = color;
  }

  private stepParticles(d: number): void {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= d;
      if (this.life[i] <= 0) {
        this.n--;
        this.copy(this.n, i);
        continue;
      }
      this.vy[i] += this.grav[i] * d;
      const drag = this.shape[i] === Shape.Puff ? Math.exp(-d * 4) : Math.exp(-d * 1.2);
      this.vx[i] *= drag;
      this.vy[i] *= drag;
      this.px[i] += this.vx[i] * d;
      this.py[i] += this.vy[i] * d;
      this.rot[i] += this.vr[i] * d;
      i++;
    }
  }

  private copy(from: number, to: number): void {
    this.px[to] = this.px[from];
    this.py[to] = this.py[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.life[to] = this.life[from];
    this.max[to] = this.max[from];
    this.size[to] = this.size[from];
    this.rot[to] = this.rot[from];
    this.vr[to] = this.vr[from];
    this.grav[to] = this.grav[from];
    this.shape[to] = this.shape[from];
    this.color[to] = this.color[from];
  }

  private drawParticles(ctx: Ctx): void {
    for (let i = 0; i < this.n; i++) {
      const f = this.life[i] / this.max[i];
      const s = this.size[i];
      if (this.shape[i] === Shape.Puff) {
        ctx.fillStyle = COLORS[this.color[i]];
        ctx.globalAlpha = f * 0.45;
        ctx.beginPath();
        ctx.arc(this.px[i], this.py[i], s * (1.8 - f), 0, TAU);
        ctx.fill();
      }
    }
    // sparks: additive streaks along their velocity
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.n; i++) {
      if (this.shape[i] !== Shape.Spark) continue;
      const f = this.life[i] / this.max[i];
      ctx.strokeStyle = COLORS[this.color[i]];
      ctx.globalAlpha = Math.min(1, f * 1.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.px[i], this.py[i]);
      ctx.lineTo(this.px[i] - this.vx[i] * 0.025, this.py[i] - this.vy[i] * 0.025);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private drawRings(ctx: Ctx): void {
    for (let i = 0; i < RING_CAP; i++) {
      const age = this.ring[i * 4 + 2];
      const maxR = this.ring[i * 4 + 3];
      if (maxR <= 0 || age > 0.45) continue;
      const f = age / 0.45;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.strokeStyle = COLORS[this.ringColor[i]];
      ctx.lineWidth = 1.5 * (1 - f) + 0.5;
      ctx.beginPath();
      ctx.arc(this.ring[i * 4], this.ring[i * 4 + 1], 6 + maxR * Math.sqrt(f), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

