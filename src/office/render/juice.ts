// Office v2.1 pickup / action FX (office spec v2.1): a small pooled particle system drawn over the office frame
// in logical coordinates — sparkle bursts, rising hearts, star bursts, take-off rings, lane streaks, heel sparks
// and icons flying to their HUD counter. Fixed-size typed arrays: nothing is allocated per frame.
import { COPY } from '../../flavor';
import type { Ctx } from '../../render/util';

/** particle capacity (a burst past it recycles the oldest slots) */
export const PARTICLES = 160;
const RINGS = 12;
const FLYERS = 8;
/** a flying icon takes this long to its counter (art review: slow enough to follow) */
const FLY_TIME = 0.42;
const FLY_PX = 32;

export type BurstKind = 'coin' | 'heart' | 'star' | 'pop' | 'sparkle' | 'frost' | 'heel' | 'streak';

/** shapes drawn per particle */
const enum Shape { Spark = 0, Heart = 1, Star = 2, Streak = 3, Dot = 4 }

interface BurstPlan {
  readonly count: number;
  readonly life: number;
  /** initial speed range (px/s), spread angle around `dir` (radians), gravity (px/s², + = down) */
  readonly speed: number;
  readonly spread: number;
  readonly dir: number;
  readonly gravity: number;
  readonly size: number;
  readonly shape: Shape;
  readonly colors: readonly string[];
  /** peak opacity (subtle FX stay faint) */
  readonly alpha: number;
}

const UP = -Math.PI / 2;

export const BURSTS: Readonly<Record<BurstKind, BurstPlan>> = {
  coin: { count: 8, life: 0.5, speed: 150, spread: Math.PI * 2, dir: UP, gravity: 260, size: 4.5, shape: Shape.Star, colors: ['#FFD54A', '#FFF2B0', '#FFB020'], alpha: 1 },
  heart: { count: 7, life: 1.0, speed: 60, spread: 1.2, dir: UP, gravity: -40, size: 8, shape: Shape.Heart, colors: ['#FF7EB3', '#FF9FC7', '#FF5C93'], alpha: 1 },
  star: { count: 14, life: 0.7, speed: 170, spread: Math.PI * 2, dir: UP, gravity: 120, size: 6, shape: Shape.Star, colors: ['#FFE45C', '#FFFFFF', '#7CF0D8'], alpha: 1 },
  pop: { count: 12, life: 0.4, speed: 190, spread: Math.PI * 2, dir: UP, gravity: 0, size: 3, shape: Shape.Spark, colors: ['#9BE7FF', '#FFFFFF'], alpha: 1 },
  sparkle: { count: 2, life: 0.45, speed: 30, spread: Math.PI * 2, dir: UP, gravity: 20, size: 3.5, shape: Shape.Star, colors: ['#FFF6B0', '#FFFFFF'], alpha: 1 },
  frost: { count: 10, life: 0.6, speed: 90, spread: Math.PI * 2, dir: UP, gravity: -20, size: 4, shape: Shape.Star, colors: ['#BFEFFF', '#E8FBFF', '#8FD8FF'], alpha: 1 },
  heel: { count: 3, life: 0.2, speed: 140, spread: 0.5, dir: Math.PI + 0.3, gravity: 300, size: 1.8, shape: Shape.Spark, colors: ['#FFFFFF', '#FFE6A8'], alpha: 0.9 },
  streak: { count: 4, life: 0.15, speed: 0, spread: 0, dir: 0, gravity: 0, size: 1.5, shape: Shape.Streak, colors: ['#BFF4FF'], alpha: 0.35 },
};

/** take-off dust ring per jump level (1단 small … 3단 wide and bright) */
export function takeoffRing(level: number): { radius: number; width: number; life: number } {
  const l = Math.min(3, Math.max(1, level));
  return { radius: 6 + l * 10, width: 1 + l * 0.7, life: 0.22 + l * 0.05 };
}

/** ring colours per jump level (1단 white, 2단 + cyan, 3단 + gold) — one more ring per level */
export const JUMP_RING_COLORS: readonly string[] = ['#FFFFFF', '#7FE8FF', '#FFD54A'];

interface Pt { x: number; y: number }

/** a point on a flying icon's arc (k 0 = start, 1 = target), written into `out` */
export function flyPoint(from: Readonly<Pt>, to: Readonly<Pt>, k: number, out: Pt): Pt {
  const lift = 60 + Math.abs(to.x - from.x) * 0.2;
  out.x = from.x + (to.x - from.x) * k;
  out.y = from.y + (to.y - from.y) * k - lift * 4 * k * (1 - k);
  return out;
}

export type PowerUp = 'shield' | 'slow' | 'heart';

/** the power-up a pickup popup announces (feedback.ts shows COPY.pickup* for shield / slow / heart) */
export function pickupFromPopup(text: string): PowerUp | null {
  if (text === COPY.pickupShield) return 'shield';
  if (text === COPY.pickupSlow) return 'slow';
  if (text === COPY.pickupHeart) return 'heart';
  return null;
}

const rand = (seed: number): number => {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export class Juice {
  private readonly px = new Float32Array(PARTICLES);
  private readonly py = new Float32Array(PARTICLES);
  private readonly vx = new Float32Array(PARTICLES);
  private readonly vy = new Float32Array(PARTICLES);
  private readonly age = new Float32Array(PARTICLES);
  private readonly life = new Float32Array(PARTICLES);
  private readonly size = new Float32Array(PARTICLES);
  private readonly grav = new Float32Array(PARTICLES);
  private readonly shape = new Uint8Array(PARTICLES);
  private readonly peak = new Float32Array(PARTICLES);
  private readonly color: string[] = new Array<string>(PARTICLES).fill('#FFFFFF');
  private next = 0;
  private seed = 1;

  private readonly rx = new Float32Array(RINGS);
  private readonly ry = new Float32Array(RINGS);
  private readonly rr = new Float32Array(RINGS);
  private readonly rw = new Float32Array(RINGS);
  private readonly ra = new Float32Array(RINGS);
  private readonly rl = new Float32Array(RINGS);
  private readonly rc: string[] = new Array<string>(RINGS).fill('#FFFFFF');
  private nextRing = 0;

  private readonly flyer = Array.from({ length: FLYERS }, () => ({
    active: false, img: '', from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, age: 0, tag: '', done: null as ((tag: string) => void) | null,
  }));
  private readonly at: Pt = { x: 0, y: 0 };

  /** spawn a burst at (x, y); reduced motion spawns a third */
  burst(kind: BurstKind, x: number, y: number, reduced: boolean, dir?: number): void {
    const b = BURSTS[kind];
    const n = reduced ? Math.max(1, Math.round(b.count / 3)) : b.count;
    for (let i = 0; i < n; i++) {
      const k = this.next;
      this.next = (this.next + 1) % PARTICLES;
      const r1 = rand(this.seed++);
      const r2 = rand(this.seed++);
      const a = (dir ?? b.dir) + (r1 - 0.5) * b.spread;
      const sp = b.speed * (0.5 + 0.5 * r2);
      // heel sparks fly only backwards (behind the hero)
      const back = kind === 'heel';
      this.px[k] = x + (kind === 'streak' ? 0 : (r2 - 0.5) * 6);
      this.py[k] = y + (kind === 'streak' ? (i - n / 2) * 7 : 0);
      this.vx[k] = back ? -Math.abs(Math.cos(a) * sp) : Math.cos(a) * sp;
      this.vy[k] = Math.sin(a) * sp;
      this.age[k] = 0;
      this.life[k] = b.life * (0.8 + 0.4 * r1);
      this.size[k] = b.size * (kind === 'streak' ? 14 + r1 * 10 : 0.7 + 0.6 * r2) * (kind === 'streak' ? dir ?? 1 : 1);
      this.grav[k] = b.gravity;
      this.shape[k] = b.shape;
      this.peak[k] = b.alpha;
      this.color[k] = b.colors[i % b.colors.length];
    }
  }

  /** a ground ring (take-off dust, shield pop) */
  ring(x: number, y: number, radius: number, width: number, life: number, color = '#FFFFFF', delay = 0): void {
    const k = this.nextRing;
    this.rc[k] = color;
    this.nextRing = (this.nextRing + 1) % RINGS;
    this.rx[k] = x;
    this.ry[k] = y;
    this.rr[k] = radius;
    this.rw[k] = width;
    this.ra[k] = -delay;
    this.rl[k] = life;
  }

  /** an icon flying from `from` to `to` (logical px); `done(tag)` when it arrives */
  fly(img: string, from: Readonly<Pt>, to: Readonly<Pt>, tag: string, done: ((tag: string) => void) | null): void {
    const f = this.flyer.find((x) => !x.active) ?? this.flyer[0];
    f.active = true;
    f.img = img;
    f.from.x = from.x;
    f.from.y = from.y;
    f.to.x = to.x;
    f.to.y = to.y;
    f.age = 0;
    f.tag = tag;
    f.done = done;
  }

  update(dt: number): void {
    for (let k = 0; k < PARTICLES; k++) {
      if (this.age[k] >= this.life[k]) continue;
      this.age[k] += dt;
      this.vy[k] += this.grav[k] * dt;
      this.px[k] += this.vx[k] * dt;
      this.py[k] += this.vy[k] * dt;
    }
    for (let k = 0; k < RINGS; k++) if (this.ra[k] < this.rl[k]) this.ra[k] += dt;
    for (const f of this.flyer) {
      if (!f.active) continue;
      f.age += dt;
      if (f.age >= FLY_TIME) {
        f.active = false;
        f.done?.(f.tag);
      }
    }
  }

  /** live particles (tests / budget) */
  live(): number {
    let n = 0;
    for (let k = 0; k < PARTICLES; k++) if (this.age[k] < this.life[k]) n++;
    return n;
  }

  flyers(): number {
    return this.flyer.filter((f) => f.active).length;
  }

  rings(): number {
    let n = 0;
    for (let k = 0; k < RINGS; k++) if (this.ra[k] < this.rl[k]) n++;
    return n;
  }

  /** drop everything (a new run) */
  clear(): void {
    this.age.fill(0);
    this.life.fill(0);
    this.ra.fill(0);
    this.rl.fill(0);
    for (const f of this.flyer) f.active = false;
  }

  draw(ctx: Ctx, image: (name: string) => HTMLImageElement | null): void {
    ctx.save();
    for (let k = 0; k < RINGS; k++) {
      if (this.ra[k] >= this.rl[k] || this.ra[k] < 0) continue;
      const t = this.ra[k] / this.rl[k];
      // a thin dark rim under the coloured ring: reads on grey / white floors too
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.strokeStyle = '#2E2433';
      ctx.lineWidth = this.rw[k] * (1 - 0.5 * t) + 1.6;
      ctx.beginPath();
      ctx.ellipse(this.rx[k], this.ry[k], this.rr[k] * (0.4 + 0.6 * t), this.rr[k] * 0.25 * (0.4 + 0.6 * t), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.95 * (1 - 0.8 * t);
      ctx.strokeStyle = this.rc[k];
      ctx.lineWidth = this.rw[k] * (1 - 0.5 * t);
      ctx.beginPath();
      ctx.ellipse(this.rx[k], this.ry[k], this.rr[k] * (0.4 + 0.6 * t), this.rr[k] * 0.25 * (0.4 + 0.6 * t), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let k = 0; k < PARTICLES; k++) {
      if (this.age[k] >= this.life[k]) continue;
      const t = this.age[k] / this.life[k];
      ctx.globalAlpha = this.peak[k] * (t < 0.7 ? 1 : (1 - t) / 0.3);
      ctx.fillStyle = this.color[k];
      ctx.strokeStyle = this.color[k];
      shapeAt(ctx, this.shape[k] as Shape, this.px[k], this.py[k], this.size[k], t);
    }
    ctx.globalAlpha = 1;
    for (const f of this.flyer) {
      if (!f.active) continue;
      const k = Math.min(1, f.age / FLY_TIME);
      const e = k * k * (3 - 2 * k);
      flyPoint(f.from, f.to, e, this.at);
      const img = image(f.img);
      const s = FLY_PX * (1 - 0.3 * e);
      if (img) ctx.drawImage(img, this.at.x - s / 2, this.at.y - s / 2, s, s);
      else {
        ctx.fillStyle = '#FFD54A';
        ctx.beginPath();
        ctx.arc(this.at.x, this.at.y, s / 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function shapeAt(ctx: Ctx, shape: Shape, x: number, y: number, s: number, t: number): void {
  switch (shape) {
    case Shape.Heart: {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.6);
      ctx.bezierCurveTo(x - s * 1.2, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.35);
      ctx.bezierCurveTo(x + s * 0.5, y - s, x + s * 1.2, y - s * 0.2, x, y + s * 0.6);
      ctx.fill();
      return;
    }
    case Shape.Star: {
      const r = s * (1 - 0.3 * t);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.28, y - r * 0.28);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + r * 0.28, y + r * 0.28);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.28, y + r * 0.28);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - r * 0.28, y - r * 0.28);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case Shape.Streak: {
      // size carries the signed length (direction of the move)
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s * t, y);
      ctx.lineTo(x - s * t - s * 0.8, y);
      ctx.stroke();
      return;
    }
    default:
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
}
