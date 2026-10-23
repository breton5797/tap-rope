// Pooled particles, shockwave rings, text popups, screen shake and flash.
import { type BurstKind, type EffectsApi, type PopupStyle } from '../types';
import { drawPopups, PopupPool } from './popups';
import { clamp, starPath, TAU, type Ctx } from './util';
import type { View } from './view';

const CAP = 300;
const RING_CAP = 12;
const Shape = { Puff: 0, Star: 1, Rect: 2 } as const;

const COLORS = [
  '#FFFFFF', '#FFE27A', '#FFC23D', '#FF5E5B', '#FF9F6B', '#3DDC97', '#4D96FF', '#B98CFF', '#FF7EC7', '#E8DCC8', '#9AF0FF',
];
const C = { white: 0, gold: 1, amber: 2, red: 3, orange: 4, mint: 5, blue: 6, purple: 7, pink: 8, dust: 9, cyan: 10 } as const;
const CONFETTI = [C.red, C.gold, C.mint, C.blue, C.purple, C.pink];

export class Effects implements EffectsApi {
  reduced = false;
  /** screen position of the player's feet, updated by the renderer */
  anchorX = 180;
  feetY = 454;
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
  private shakeAmp = 0;
  private clock = 0;
  private flashColor = '#FFFFFF';
  private flashAlpha = 0;

  burst(kind: BurstKind, x?: number, y?: number): void {
    const feetY = this.feetY;
    const bx = x ?? this.anchorX;
    const by = y ?? (kind === 'dust' ? feetY : feetY - 26);
    const k = this.reduced ? 0.4 : 1;
    switch (kind) {
      case 'dust': return this.dust(bx, by, k);
      case 'sparkle': return this.radial(bx, by, Math.round(14 * k), Shape.Star, C.gold, C.white, 90, 200, 0.65);
      case 'coin':
        this.ringAt(bx, by, 26, C.gold);
        return this.radial(bx, by, Math.round(12 * k), Shape.Star, C.gold, C.amber, 70, 170, 0.55);
      case 'hit':
        this.ringAt(bx, by, 40, C.red);
        return this.radial(bx, by, Math.round(18 * k), Shape.Rect, C.red, C.white, 150, 320, 0.55, 700);
      case 'powerup':
        this.ringAt(bx, by, 46, C.cyan);
        return this.radial(bx, by, Math.round(18 * k), Shape.Star, C.cyan, C.white, 60, 160, 0.9, -120);
      case 'confetti': return this.confetti(bx, by, Math.round(44 * k));
    }
  }

  /** Low-cost emitter used for the fever rope trail. */
  sparkleAt(x: number, y: number): void {
    if (this.reduced) return;
    this.spawn(x, y, (Math.random() - 0.5) * 30, -20 - Math.random() * 40, 0.5, 1.5 + Math.random() * 2, Shape.Star, Math.random() < 0.5 ? C.white : C.gold, 0);
  }

  popup(text: string, style: PopupStyle): void {
    this.popups.add(text, style, this.feetY - 50);
  }

  shake(intensity: number): void {
    if (this.reduced) return;
    this.shakeAmp = Math.max(this.shakeAmp, clamp(intensity, 0, 1) * 9);
  }

  flash(color: string): void {
    if (this.reduced) return;
    this.flashColor = color;
    this.flashAlpha = 0.55;
  }

  update(dt: number): void {
    const d = clamp(dt, 0, 0.1);
    this.clock += d;
    this.shakeAmp *= Math.exp(-d * 9);
    if (this.shakeAmp < 0.05) this.shakeAmp = 0;
    this.flashAlpha = Math.max(0, this.flashAlpha - d * 2.6);
    this.popups.update(d);
    this.stepParticles(d);
    for (let i = 0; i < RING_CAP; i++) this.ring[i * 4 + 2] += d;
  }

  shakeX(): number {
    return this.shakeAmp * Math.sin(this.clock * 73);
  }

  shakeY(): number {
    return this.shakeAmp * Math.cos(this.clock * 61);
  }

  drawWorld(ctx: Ctx): void {
    this.drawRings(ctx);
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

  private confetti(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 220 + Math.random() * 260;
      this.spawn(x + (Math.random() - 0.5) * 60, y, Math.cos(a) * sp, Math.sin(a) * sp, 1.4 + Math.random() * 0.6, 3 + Math.random() * 2.5, Shape.Rect, CONFETTI[i % CONFETTI.length], 420);
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
      ctx.fillStyle = COLORS[this.color[i]];
      if (this.shape[i] === Shape.Puff) {
        ctx.globalAlpha = f * 0.75;
        ctx.beginPath();
        ctx.arc(this.px[i], this.py[i], s * (1.8 - f), 0, TAU);
        ctx.fill();
      } else if (this.shape[i] === Shape.Star) {
        ctx.globalAlpha = Math.min(1, f * 1.6);
        starPath(ctx, this.px[i], this.py[i], s * (0.6 + f * 0.6) * 1.4, s * 0.35, 4);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, f * 2);
        ctx.save();
        ctx.translate(this.px[i], this.py[i]);
        ctx.rotate(this.rot[i]);
        ctx.fillRect(-s, -s * 0.45, s * 2, s * 0.9 * Math.abs(Math.cos(this.rot[i] * 0.7)) + 0.6);
        ctx.restore();
      }
    }
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
      ctx.lineWidth = 4 * (1 - f) + 0.5;
      ctx.beginPath();
      ctx.arc(this.ring[i * 4], this.ring[i * 4 + 1], 6 + maxR * Math.sqrt(f), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

