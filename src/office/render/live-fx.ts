// Office live events, in-run cosmetics: the equipped trail (marks left behind on the floor while running) and
// jump effect (a burst on take-off), plus the rain-week overlay. A small pooled particle system in logical
// coordinates; art/cosmetic/<key>.webp is drawn when present, else a procedural look keyed by the same string.
// Fixed-size typed arrays: nothing is allocated per frame.
import type { RenderSnapshot } from '../../types';
import { PLAYER_X } from '../../types';
import { depthScale, laneY, visualLane } from '../../render/layout';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import type { LiveLook } from './live-look';

export const LIVE_PARTICLES = 48;
/** art review: a trail piece every 0.1 s while running (reduced motion: 0.2 s), alive 0.4 s → 3–5 at once */
const TRAIL_EVERY = 0.1;
const TRAIL_LIFE = 0.4;
/** ≈ 25 % of the hero's height */
const TRAIL_PX = 38;
/** trail pieces start behind the hero's centre, between heel and hip, and drift left / up (px, px/s) */
const TRAIL_BEHIND = 22;
const TRAIL_HEEL = 20;
const TRAIL_HIP = 44;
const TRAIL_DRIFT_X = 90;
const TRAIL_RISE = 30;
const JUMP_COUNT = 6;
/** a jump burst: from the hero's feet, up and back, gone within 0.4 s */
const JUMP_LIFE = 0.38;
const JUMP_PX = 26;
/** pieces keep rising (negative gravity): nothing falls back onto the floor */
const JUMP_LIFT = -80;
/** part 2 starts at stage 6 (0-based chapter 5) */
const PART2 = 5;
/** the clock week: urgent for the last third of any run */
const CLOCK_BOOST_FROM = 2 / 3;

export type FxShape = 'foot' | 'dot' | 'star' | 'petal' | 'paper' | 'drop' | 'confetti';

export interface FxStyle {
  readonly shape: FxShape;
  readonly colors: readonly string[];
  /** px */
  readonly size: number;
  /** a jump piece that shoots up faster (medal rosettes) */
  readonly fast?: boolean;
}

/** placeholder looks until ART delivers the sprites (keys = Cosmetic.sprite) */
export const FX_STYLES: Readonly<Record<string, FxStyle>> = {
  'trail-sparkle': { shape: 'star', colors: ['#FFE45C', '#FFF6B0', '#FFFFFF'], size: 6 },
  'trail-confetti': { shape: 'confetti', colors: ['#FF7EB3', '#FFE45C', '#7CF0D8', '#9BB8FF'], size: 6 },
  'trail-highlighter': { shape: 'foot', colors: ['#D7FF4A', '#FFE45C'], size: 8 },
  'trail-coffee': { shape: 'dot', colors: ['#8A5A3C', '#C89B76'], size: 5 },
  'trail-paper': { shape: 'paper', colors: ['#FFFFFF', '#DDE6F2'], size: 7 },
  'trail-rain': { shape: 'drop', colors: ['#8FD8FF', '#D6F2FF'], size: 6 },
  'jump-dust': { shape: 'dot', colors: ['#E4E0E6', '#FFFFFF'], size: 5 },
  'jump-petal': { shape: 'petal', colors: ['#FF9FC7', '#FFD3E5', '#FFFFFF'], size: 7 },
  'jump-papers': { shape: 'paper', colors: ['#FFFFFF', '#DDE6F2'], size: 8 },
  'jump-medal': { shape: 'star', colors: ['#FFD54A', '#FFB020', '#FFFFFF'], size: 7, fast: true },
};

const FALLBACK_SHAPES: readonly FxShape[] = ['dot', 'star', 'petal', 'confetti'];
const FALLBACK_COLORS: readonly (readonly string[])[] = [['#FFE45C', '#FFFFFF'], ['#7CF0D8', '#FFFFFF'], ['#FF9FC7', '#FFFFFF'], ['#9BB8FF', '#FFFFFF']];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const fallbackCache = new Map<string, FxStyle>();

/** the look of a sprite key: its table entry, else a stable one picked by its hash */
export function fxStyle(key: string): FxStyle {
  const known = FX_STYLES[key];
  if (known) return known;
  let s = fallbackCache.get(key);
  if (!s) {
    const h = hash(key);
    s = { shape: FALLBACK_SHAPES[h % FALLBACK_SHAPES.length], colors: FALLBACK_COLORS[(h >>> 8) % FALLBACK_COLORS.length], size: 6 };
    fallbackCache.set(key, s);
  }
  return s;
}

/** rain over the background: the rain week, part-2 stages only */
export function rainOn(look: LiveLook, stageIndex: number): boolean {
  return look.rain && stageIndex >= PART2;
}

/** the clock week reads urgent for the last third of any run */
export function clockBoost(look: LiveLook, progress01: number): boolean {
  return look.clock && progress01 > CLOCK_BOOST_FROM;
}

const artNames = new Map<string, string>();
function artName(key: string): string {
  let n = artNames.get(key);
  if (n === undefined) {
    n = `cosmetic/${key}`;
    artNames.set(key, n);
  }
  return n;
}

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export class LiveFx {
  private readonly px = new Float32Array(LIVE_PARTICLES);
  private readonly py = new Float32Array(LIVE_PARTICLES);
  private readonly vx = new Float32Array(LIVE_PARTICLES);
  private readonly vy = new Float32Array(LIVE_PARTICLES);
  private readonly age = new Float32Array(LIVE_PARTICLES);
  private readonly life = new Float32Array(LIVE_PARTICLES);
  private readonly rot = new Float32Array(LIVE_PARTICLES);
  /** 1 = a trail piece, 0 = a jump piece */
  private readonly floor = new Uint8Array(LIVE_PARTICLES);
  private readonly key: string[] = new Array<string>(LIVE_PARTICLES).fill('');
  /** 'cosmetic/<key>', built once per key (no string per particle per frame) */
  private readonly art: string[] = new Array<string>(LIVE_PARTICLES).fill('');
  private readonly color: string[] = new Array<string>(LIVE_PARTICLES).fill('#FFFFFF');
  private next = 0;
  private seed = 1;
  private lastTime = Number.NaN;
  private lastScroll = 0;
  /** seconds of running since the last trail piece */
  private trailAcc = 0;
  private wasGrounded = true;
  /** particles spawned since the last reset (tests) */
  spawned = 0;

  update(snap: RenderSnapshot, look: LiveLook): void {
    const t = snap.time;
    if (!Number.isFinite(this.lastTime) || t < this.lastTime) this.reset(snap);
    const dt = Math.min(0.1, Math.max(0, t - this.lastTime));
    const dScroll = Math.max(0, snap.scroll - this.lastScroll);
    this.lastTime = t;
    this.lastScroll = snap.scroll;
    const p = snap.player;
    const lane = visualLane(p);
    const floorY = laneY(lane);
    const scale = depthScale(lane);
    for (let k = 0; k < LIVE_PARTICLES; k++) {
      if (this.age[k] >= this.life[k]) continue;
      this.age[k] += dt;
      if (!this.floor[k]) this.vy[k] += JUMP_LIFT * dt;
      this.px[k] += this.vx[k] * dt;
      this.py[k] += this.vy[k] * dt;
      if (!this.floor[k]) this.rot[k] += 4 * dt;
    }
    const grounded = p.grounded;
    if (look.trail && grounded && !p.sliding && dScroll > 0) {
      this.trailAcc += dt;
      const every = snap.reducedMotion ? TRAIL_EVERY * 2 : TRAIL_EVERY;
      for (; this.trailAcc >= every; this.trailAcc -= every) this.trailMark(look.trail, floorY, scale);
    } else this.trailAcc = 0;
    if (look.jump && this.wasGrounded && !grounded) this.jumpBurst(look.jump, floorY, scale, snap.reducedMotion);
    this.wasGrounded = grounded;
  }

  private slot(): number {
    const k = this.next;
    this.next = (this.next + 1) % LIVE_PARTICLES;
    this.spawned++;
    return k;
  }

  private trailMark(key: string, floorY: number, scale: number): void {
    const s = fxStyle(key);
    const k = this.slot();
    const r1 = rand(this.seed++);
    const r2 = rand(this.seed++);
    this.px[k] = PLAYER_X - (TRAIL_BEHIND + r1 * 10) * scale;
    this.py[k] = floorY - (TRAIL_HEEL + r2 * (TRAIL_HIP - TRAIL_HEEL)) * scale;
    this.vx[k] = -TRAIL_DRIFT_X * (0.8 + 0.4 * r2);
    this.vy[k] = -TRAIL_RISE * (0.6 + 0.8 * r1);
    this.age[k] = 0;
    this.life[k] = TRAIL_LIFE;
    this.rot[k] = (r1 - 0.5) * 0.5;
    this.floor[k] = 1;
    this.key[k] = key;
    this.art[k] = artName(key);
    this.color[k] = s.colors[this.spawned % s.colors.length];
  }

  private jumpBurst(key: string, floorY: number, scale: number, reduced: boolean): void {
    const s = fxStyle(key);
    const n = reduced ? 2 : JUMP_COUNT;
    const speed = s.fast ? 1.6 : 1;
    for (let i = 0; i < n; i++) {
      const k = this.slot();
      const r1 = rand(this.seed++);
      const r2 = rand(this.seed++);
      // up and back only (−90°…−160°): never into the lane ahead of the hero
      const a = -Math.PI / 2 - r1 * 1.2;
      const sp = (110 + 70 * r2) * speed;
      // at the hero's own feet
      this.px[k] = PLAYER_X - (4 + r2 * 10) * scale;
      this.py[k] = floorY - 6 * scale;
      this.vx[k] = Math.cos(a) * sp;
      this.vy[k] = Math.sin(a) * sp;
      this.age[k] = 0;
      this.life[k] = JUMP_LIFE * (0.85 + 0.15 * r1);
      this.rot[k] = r1 * Math.PI;
      this.floor[k] = 0;
      this.key[k] = key;
      this.art[k] = artName(key);
      this.color[k] = s.colors[i % s.colors.length];
    }
  }

  private reset(snap: RenderSnapshot): void {
    this.age.fill(0);
    this.life.fill(0);
    this.trailAcc = 0;
    this.spawned = 0;
    this.lastTime = snap.time;
    this.lastScroll = snap.scroll;
    this.wasGrounded = snap.player.grounded;
  }

  live(): number {
    let n = 0;
    for (let k = 0; k < LIVE_PARTICLES; k++) if (this.age[k] < this.life[k]) n++;
    return n;
  }

  draw(ctx: Ctx, image: (name: string) => HTMLImageElement | null): void {
    let any = false;
    for (let k = 0; k < LIVE_PARTICLES; k++) {
      if (this.age[k] >= this.life[k]) continue;
      if (!any) {
        ctx.save();
        any = true;
      }
      const t = this.age[k] / this.life[k];
      const s = fxStyle(this.key[k]);
      // 0.9 → 0 over the piece's life
      ctx.globalAlpha = 0.9 * (1 - t);
      const img = image(this.art[k]);
      if (img) {
        const px = this.floor[k] ? TRAIL_PX : JUMP_PX * (1 - 0.2 * t);
        ctx.drawImage(img, this.px[k] - px / 2, this.py[k] - px / 2, px, px);
      } else shapeAt(ctx, s.shape, this.color[k], this.px[k], this.py[k], s.size * (this.floor[k] ? 1.8 : 1.8 - 0.5 * t), this.rot[k]);
    }
    if (any) ctx.restore();
  }
}

/** the procedural mark of one particle (a thin dark rim keeps it readable on light floors) */
function shapeAt(ctx: Ctx, shape: FxShape, color: string, x: number, y: number, s: number, rot: number): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  switch (shape) {
    case 'foot':
      ctx.ellipse(x, y, s, s * 0.45, rot, 0, Math.PI * 2);
      break;
    case 'petal':
      ctx.ellipse(x, y, s, s * 0.5, rot, 0, Math.PI * 2);
      break;
    case 'paper':
    case 'confetti': {
      const w = shape === 'paper' ? s : s * 0.6;
      const c = Math.cos(rot);
      const n = Math.sin(rot);
      ctx.moveTo(x + (-w * c - -s * 0.7 * n), y + (-w * n + -s * 0.7 * c));
      ctx.lineTo(x + (w * c - -s * 0.7 * n), y + (w * n + -s * 0.7 * c));
      ctx.lineTo(x + (w * c - s * 0.7 * n), y + (w * n + s * 0.7 * c));
      ctx.lineTo(x + (-w * c - s * 0.7 * n), y + (-w * n + s * 0.7 * c));
      ctx.closePath();
      break;
    }
    case 'star':
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.3, y - s * 0.3);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.3, y + s * 0.3);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.3, y + s * 0.3);
      ctx.lineTo(x - s, y);
      ctx.lineTo(x - s * 0.3, y - s * 0.3);
      ctx.closePath();
      break;
    case 'drop':
      ctx.moveTo(x, y - s * 1.2);
      ctx.quadraticCurveTo(x + s * 0.8, y, x, y + s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.8, y, x, y - s * 1.2);
      break;
    default:
      ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.stroke();
}

/** rain streaks on screen at once (one path, one stroke per frame) */
export const RAIN_DROPS = 28;
const RAIN_FALL = 520; // px/s
const RAIN_LEN = 16;

/** light rain over the scene (rain week, part 2): one stroked path; still under reduced motion */
export function drawRain(ctx: Ctx, v: View, realTime: number, reduced: boolean): void {
  const t = reduced ? 0 : realTime;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#D6ECFF';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < RAIN_DROPS; i++) {
    const x0 = rand(i + 1) * v.w;
    const span = v.h + RAIN_LEN;
    const y = (rand(i + 50) * span + t * RAIN_FALL * (0.8 + 0.4 * rand(i + 90))) % span - RAIN_LEN;
    const x = v.x0 + ((x0 - y * 0.3) % v.w + v.w) % v.w;
    ctx.moveTo(x, v.y0 + y);
    ctx.lineTo(x - 5, v.y0 + y + RAIN_LEN);
  }
  ctx.stroke();
  ctx.restore();
}
