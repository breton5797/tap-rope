// Office hero sprites (office spec §8): which drawn frame shows for the player state. Pure.
// Frames: hero-<kid|cat>-{run1..run4,jump,slide,hit,win}.webp; the lane change is a lean, not a frame.
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
