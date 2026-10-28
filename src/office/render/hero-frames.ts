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
/** slide1..3 play over the dive, slide4 holds; the exit plays them back quickly */
const SLIDE_IN = 0.08;
const SLIDE_OUT = 0.08;
const GLIDE_TILT = -0.12;
/** ≤ 15° */
const BOOST_TILT = 0.24;
/** a 1단 hop's airborne time with the default physics (2 · jumpV / gravity) */
const HOP_TIME = 0.44;
/** jump8 (landing) shows this long after touching down */
const LAND_FRAME = 0.08;

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
  /** whether an animation frame (jump1..8, slide1..4, hit1..4) is loaded */
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

const names = (base: string, n: number): readonly string[] => Array.from({ length: n }, (_, i) => `${base}${i + 1}`);
const RUN_NAMES = names('run', 8);
const JUMP_NAMES = names('jump', 8);
const SLIDE_NAMES = names('slide', 4);
const HIT_NAMES = names('hit', 4);
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

/** frame i (0-based, clamped) of an animation when its art exists, else the still fallback */
function anim(c: PoseCtx, list: readonly string[], i: number, still: string): string {
  const f = list[Math.min(list.length - 1, Math.max(0, Math.floor(i)))];
  return c.art(f) ? f : still;
}

function airPose(p: PlayerState, c: PoseCtx): HeroPose {
  if (p.pendingSlide) return set(anim(c, SLIDE_NAMES, 0, 'slide')); // ↓ in the air: dive right away (F11)
  if (p.level === 2 && c.boostAge < SPIN_TIME) {
    // the boost: a stretch and a forward tilt on the apex frame (never a flip — it read as a fall)
    const k = Math.sin(Math.PI * (c.boostAge / SPIN_TIME));
    return set(anim(c, JUMP_NAMES, 3, 'jump'), 1 - 0.06 * k, 1 + 0.1 * k, -BOOST_TILT * k);
  }
  if (p.level >= 3) return set('jump', 1, 1, GLIDE_TILT); // arms-up still as the glide
  const frame = anim(c, JUMP_NAMES, (p.airTime / HOP_TIME) * 8, 'jump');
  if (c.jumpAge < STRETCH_TIME) {
    const k = 1 - c.jumpAge / STRETCH_TIME;
    return set(frame, 1 - 0.1 * k, 1 + 0.16 * k);
  }
  return set(frame);
}

function slidePose(p: PlayerState, c: PoseCtx): HeroPose {
  if (p.slideAge < SLIDE_IN) {
    const k = 1 - p.slideAge / SLIDE_IN;
    return set(anim(c, SLIDE_NAMES, (p.slideAge / SLIDE_IN) * 3, 'slide'), 1 + 0.08 * k, 1 - 0.15 * k);
  }
  if (p.slideTime < SLIDE_OUT) {
    const k = 1 - p.slideTime / SLIDE_OUT;
    return set(anim(c, SLIDE_NAMES, 3 - k * 3, 'slide'), 1 - 0.05 * k, 1 + 0.1 * k);
  }
  return set(anim(c, SLIDE_NAMES, 3, 'slide'));
}

/** the frame and its squash / stretch / spin for this moment (shared result object) */
export function heroPose(p: PlayerState, c: PoseCtx): HeroPose {
  if (c.hitAge >= 0 && c.hitAge < HIT_SHOW) return set(anim(c, HIT_NAMES, (c.hitAge / HIT_SHOW) * 4, 'hit'));
  if (c.win) return set('win');
  if (p.sliding) return slidePose(p, c);
  if (!p.grounded) return airPose(p, c);
  if (c.landAge < SQUASH_TIME) {
    const k = 1 - c.landAge / SQUASH_TIME;
    const frame = c.landAge < LAND_FRAME && c.art('jump8') ? 'jump8' : runName(c);
    return set(frame, 1 + 0.12 * k, 1 - 0.16 * k, 0, k);
  }
  return set(runName(c));
}

const runName = (c: PoseCtx): string => (c.running ? RUN_NAMES[runFrame(c.scroll, STRIDE, c.runFrames)] : 'run1');
