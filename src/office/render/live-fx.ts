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
/** a trail mark every this many px of floor scroll (reduced motion: twice as far apart) */
const TRAIL_STEP = 70;
const TRAIL_LIFE = 0.55;
const JUMP_COUNT = 7;
const JUMP_LIFE = 0.5;
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
}

/** placeholder looks until ART delivers the sprites (keys = Cosmetic.sprite) */
export const FX_STYLES: Readonly<Record<string, FxStyle>> = {
  'trail-steps': { shape: 'foot', colors: ['#FFFFFF'], size: 6 },
  'trail-coffee': { shape: 'dot', colors: ['#8A5A3C', '#C89B76'], size: 5 },
  'trail-paper': { shape: 'paper', colors: ['#FFFFFF', '#DDE6F2'], size: 7 },
  'trail-star': { shape: 'star', colors: ['#FFE45C', '#FFF6B0'], size: 6 },
  'trail-petal': { shape: 'petal', colors: ['#FF9FC7', '#FFD3E5'], size: 6 },
  'trail-rain': { shape: 'drop', colors: ['#8FD8FF', '#D6F2FF'], size: 6 },
  'jump-dust': { shape: 'dot', colors: ['#E4E0E6', '#FFFFFF'], size: 5 },
  'jump-confetti': { shape: 'confetti', colors: ['#FF7EB3', '#FFE45C', '#7CF0D8', '#9BB8FF'], size: 6 },
  'jump-paper': { shape: 'paper', colors: ['#FFFFFF', '#DDE6F2'], size: 8 },
  'jump-petal': { shape: 'petal', colors: ['#FF9FC7', '#FFD3E5', '#FFFFFF'], size: 7 },
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
  /** world-anchored (scrolls with the floor) */
  private readonly floor = new Uint8Array(LIVE_PARTICLES);
  private readonly key: string[] = new Array<string>(LIVE_PARTICLES).fill('');
  private readonly color: string[] = new Array<string>(LIVE_PARTICLES).fill('#FFFFFF');
  private next = 0;
  private seed = 1;
  private lastTime = Number.NaN;
  private lastScroll = 0;
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
      if (this.floor[k]) this.px[k] -= dScroll;
      else {
        this.vy[k] += 220 * dt;
        this.px[k] += this.vx[k] * dt;
        this.py[k] += this.vy[k] * dt;
        this.rot[k] += 4 * dt;
      }
    }
    const grounded = p.grounded;
    if (look.trail && grounded && !p.sliding) {
      this.trailAcc += dScroll;
      const step = snap.reducedMotion ? TRAIL_STEP * 2 : TRAIL_STEP;
      for (; this.trailAcc >= step; this.trailAcc -= step) this.trailMark(look.trail, floorY, scale);
    } else this.trailAcc = 0;
    if (look.jump && this.wasGrounded && !grounded) this.jumpBurst(look.jump, floorY, snap.reducedMotion);
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
    const alt = this.spawned % 2;
    this.px[k] = PLAYER_X - 14 * scale;
    this.py[k] = floorY - 2 - alt * 5 * scale;
    this.vx[k] = 0;
    this.vy[k] = 0;
    this.age[k] = 0;
    this.life[k] = TRAIL_LIFE;
    this.rot[k] = alt ? 0.25 : -0.25;
    this.floor[k] = 1;
    this.key[k] = key;
    this.color[k] = s.colors[this.spawned % s.colors.length];
  }

  private jumpBurst(key: string, floorY: number, reduced: boolean): void {
    const s = fxStyle(key);
    const n = reduced ? 2 : JUMP_COUNT;
    for (let i = 0; i < n; i++) {
      const k = this.slot();
      const r1 = rand(this.seed++);
      const r2 = rand(this.seed++);
      const a = -Math.PI / 2 + (r1 - 0.5) * 2.2;
      const sp = 90 + 80 * r2;
      this.px[k] = PLAYER_X + (r2 - 0.5) * 20;
      this.py[k] = floorY - 6;
      this.vx[k] = Math.cos(a) * sp;
      this.vy[k] = Math.sin(a) * sp;
      this.age[k] = 0;
      this.life[k] = JUMP_LIFE * (0.8 + 0.4 * r1);
      this.rot[k] = r1 * Math.PI;
      this.floor[k] = 0;
      this.key[k] = key;
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
      ctx.globalAlpha = 0.85 * (t < 0.6 ? 1 : (1 - t) / 0.4);
      const img = image(`cosmetic/${this.key[k]}`);
      const size = s.size * (this.floor[k] ? 1 : 1 - 0.3 * t);
      if (img) ctx.drawImage(img, this.px[k] - size * 1.5, this.py[k] - size * 1.5, size * 3, size * 3);
      else shapeAt(ctx, s.shape, this.color[k], this.px[k], this.py[k], size, this.rot[k]);
    }
    if (any) ctx.restore();
  }
}

/** the procedural mark of one particle (a thin dark rim keeps it readable on light floors) */
function shapeAt(ctx: Ctx, shape: FxShape, color: string, x: number, y: number, s: number, rot: number): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(46,36,51,0.45)';
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

/** one rain tile, built once; drawn as a scrolling pattern (a single fill per frame) */
const RAIN_TILE = 96;
let rainTile: HTMLCanvasElement | null = null;
let rainPattern: { ctx: Ctx; p: CanvasPattern | null } | null = null;

function rainTileCanvas(): HTMLCanvasElement | null {
  if (rainTile || typeof document === 'undefined') return rainTile;
  const c = document.createElement('canvas');
  c.width = RAIN_TILE;
  c.height = RAIN_TILE;
  const g = c.getContext('2d');
  if (!g) return null;
  g.strokeStyle = 'rgba(214,236,255,0.9)';
  g.lineWidth = 1.4;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = rand(i + 1) * RAIN_TILE;
    const y = rand(i + 50) * RAIN_TILE;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 5, y + 16);
    g.stroke();
  }
  rainTile = c;
  return c;
}

/** light rain over the scene (rain week, part 2); still under reduced motion */
export function drawRain(ctx: Ctx, v: View, realTime: number, reduced: boolean): void {
  if (!rainPattern || rainPattern.ctx !== ctx) {
    const tile = rainTileCanvas();
    rainPattern = { ctx, p: tile ? ctx.createPattern(tile, 'repeat') : null };
  }
  const p = rainPattern.p;
  if (!p) return;
  const fall = reduced ? 0 : (realTime * 520) % RAIN_TILE;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = p;
  ctx.translate(-fall * 0.3, fall);
  ctx.fillRect(v.x0 + fall * 0.3, v.y0 - fall, v.w, v.h);
  ctx.restore();
}
