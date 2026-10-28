// Office hero sprites (office spec §8, v2 §4 F3/F4): which drawn frame shows for the player state, and the
// squash / stretch / spin around it. Pure. Frames: hero-<kid|cat>-{run1..run4 (or run1..run8), jump, slide,
// hit, win}.webp, plus optional jump-{launch,apex,spin,glide} and slide-{in,hold}; the lane change is a lean.
import type { PlayerState } from '../../types';
import { laneProgress } from '../../render/layout';

export type HeroFrameId = 'run1' | 'run2' | 'run3' | 'run4' | 'jump' | 'slide' | 'hit' | 'win';

export interface HeroCtx {
  /** false on menus: the hero stands */
  readonly running: boolean;
  /** seconds since the last hit (Infinity = none) */
  readonly hitAge: number;
  /** cheering (stage clear) */
  readonly win: boolean;
}

const RUN: readonly HeroFrameId[] = ['run1', 'run2', 'run3', 'run4'];
const RUN_FPS = 10;
/** the hit frame shows this long after a hit */
export const HIT_SHOW = 0.45;
const MAX_LEAN = (8 * Math.PI) / 180;

export function heroFrame(p: PlayerState, t: number, c: HeroCtx): HeroFrameId {
  if (c.hitAge >= 0 && c.hitAge < HIT_SHOW) return 'hit';
  if (c.win) return 'win';
  if (p.sliding) return 'slide';
  if (!p.grounded) return 'jump';
  if (!c.running) return 'run1';
  return RUN[Math.floor(t * RUN_FPS) % RUN.length];
}

const ALL: readonly HeroFrameId[] = [...RUN, 'jump', 'slide', 'hit', 'win'];

/** frames to try in order when `frame` is missing or still loading: it, the run cycle, then the rest */
export function frameFallbacks(frame: HeroFrameId): HeroFrameId[] {
  return [frame, ...ALL.filter((f) => f !== frame)];
}

/** radians: leans toward the lane it moves to, peaking at ±8° mid-switch */
export function heroLean(p: PlayerState): number {
  const k = laneProgress(p);
  if (k >= 1) return 0;
  return Math.sign(p.lane - p.laneFrom) * MAX_LEAN * Math.sin(k * Math.PI);
}

// ---------- v2 feel pack: pose (F3 run cycle on scroll distance, F4 take-off / landing / spin / slide) ----------

/** logical px of corridor scroll per full run cycle (two steps), so the feet keep pace with the floor */
export const STRIDE = 96;
const STRETCH_TIME = 0.08;
const SQUASH_TIME = 0.12;
const SPIN_TIME = 0.46;
const SLIDE_IN = 0.1;
const SLIDE_OUT = 0.1;
const GLIDE_TILT = -0.12;

/** run frame index 0..frameCount-1 for the scroll distance covered */
export function runFrame(scrollPx: number, strideLen: number, frameCount: number): number {
  const k = Math.floor((scrollPx / strideLen) * frameCount);
  return ((k % frameCount) + frameCount) % frameCount;
}

export interface PoseCtx extends HeroCtx {
  readonly scroll: number;
  /** seconds since the last landing / take-off / air boost (Infinity = none) */
  readonly landAge: number;
  readonly jumpAge: number;
  readonly boostAge: number;
  /** 8 when run5..run8 exist */
  readonly runFrames: 4 | 8;
  /** whether an optional frame (jump-spin, slide-in, …) is loaded */
  readonly art: (frame: string) => boolean;
}

export interface HeroPose {
  frame: string;
  /** horizontal / vertical scale around the feet, rotation (radians) around the body centre */
  sx: number;
  sy: number;
  rot: number;
  /** landing dust strength 0..1 */
  dust: number;
}

const RUN_NAMES: readonly string[] = ['run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'run8'];
/** one shared result (read it before the next call): no allocation per frame */
const POSE: HeroPose = { frame: 'run1', sx: 1, sy: 1, rot: 0, dust: 0 };

function set(frame: string, sx = 1, sy = 1, rot = 0, dust = 0): HeroPose {
  POSE.frame = frame;
  POSE.sx = sx;
  POSE.sy = sy;
  POSE.rot = rot;
  POSE.dust = dust;
  return POSE;
}

const pick = (c: PoseCtx, wanted: string, fallback: string): string => (c.art(wanted) ? wanted : fallback);

function airPose(p: PlayerState, c: PoseCtx): HeroPose {
  if (c.jumpAge < STRETCH_TIME && p.level <= 1) {
    const k = 1 - c.jumpAge / STRETCH_TIME;
    return set(pick(c, 'jump-launch', 'jump'), 1 - 0.1 * k, 1 + 0.16 * k);
  }
  if (p.level === 2 && c.boostAge < SPIN_TIME) {
    // one forward turn: the spin frame when drawn, else the jump frame rotated
    if (c.art('jump-spin')) return set('jump-spin');
    return set('jump', 1, 1, -2 * Math.PI * (c.boostAge / SPIN_TIME));
  }
  if (p.level === 3) return c.art('jump-glide') ? set('jump-glide') : set('jump', 1, 1, GLIDE_TILT);
  return set(Math.abs(p.vy) < 120 ? pick(c, 'jump-apex', 'jump') : 'jump');
}

function slidePose(p: PlayerState, c: PoseCtx): HeroPose {
  if (p.slideAge < SLIDE_IN) {
    const k = 1 - p.slideAge / SLIDE_IN;
    return set(pick(c, 'slide-in', 'slide'), 1 + 0.08 * k, 1 - 0.15 * k);
  }
  const hold = pick(c, 'slide-hold', 'slide');
  if (p.slideTime < SLIDE_OUT) return set(hold, 1 - 0.05 * (1 - p.slideTime / SLIDE_OUT), 1 + 0.1 * (1 - p.slideTime / SLIDE_OUT));
  return set(hold);
}

/** the frame and its squash / stretch / spin for this moment (shared result object) */
export function heroPose(p: PlayerState, c: PoseCtx): HeroPose {
  if (c.hitAge >= 0 && c.hitAge < HIT_SHOW) return set('hit');
  if (c.win) return set('win');
  if (p.sliding) return slidePose(p, c);
  if (!p.grounded) return airPose(p, c);
  const run = c.running ? RUN_NAMES[runFrame(c.scroll, STRIDE, c.runFrames)] : 'run1';
  if (c.landAge < SQUASH_TIME) {
    const k = 1 - c.landAge / SQUASH_TIME;
    return set(run, 1 + 0.12 * k, 1 - 0.16 * k, 0, k);
  }
  return set(run);
}
