/**
 * Agent physics (pure, immutable) — GDD v4 §2. Velocity positive = up.
 * - tap: on the floor = jump (level 1); in the air = boost (vy := boostV, level+1, max 3);
 *   descending close to the floor = buffered jump on landing; while sliding = cancel + jump.
 * - ↓ swipe right after the ground jump its touch started (lastTap 'jump', airTime ≤ SWIPE_WINDOW)
 *   or ↓ key on the floor = slide now; otherwise in the air = dive (vy := −fallV), slide on landing.
 *   A buffered tap at landing wins over a pending slide (latest intent).
 * - a slide lasts slideTime; stepPlayer sub-steps large dt.
 */
import type { Level, PhysicsConfig, PlayerState, Swipe, WorldId } from '../types';

export const DEFAULT_PHYSICS: PhysicsConfig = { gravity: 3000, jumpV: 660, boostV: 700, fallV: 1400, slideTime: 0.55 };
export const CLEAR_H = 12;
export const PERFECT_H = 40;
export const SWIPE_WINDOW = 0.25;

const BUFFER_TIME = 0.12;
const BUFFER_HEIGHT = 26;
const MAX_STEP = 1 / 120;

export type TapAction = 'jump' | 'boost' | 'buffered' | 'none';
export type SlideAction = 'slide' | 'dive' | 'none';

/** v4: every corridor theme shares one physics config (no low-gravity zone). */
export function physicsForWorld(_world: WorldId): PhysicsConfig {
  return DEFAULT_PHYSICS;
}

export function initialPlayer(): PlayerState {
  return {
    height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
    sliding: false, slideTime: 0, slideAge: 0, pendingSlide: false, lastTap: 'none',
  };
}

const NOT_SLIDING = { sliding: false, slideTime: 0, slideAge: 0, pendingSlide: false } as const;

function takeoff(p: PlayerState, cfg: PhysicsConfig): PlayerState {
  return {
    ...p, ...NOT_SLIDING, height: 0, vy: cfg.jumpV, grounded: false, level: 1, airTime: 0, buffer: 0, lastTap: 'jump',
  };
}

function startSlide(p: PlayerState, cfg: PhysicsConfig): PlayerState {
  return {
    ...p, height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
    sliding: true, slideTime: cfg.slideTime, slideAge: 0, pendingSlide: false, lastTap: 'none',
  };
}

export function tapPlayer(p: PlayerState, cfg: PhysicsConfig): { player: PlayerState; action: TapAction } {
  if (p.grounded) return { player: takeoff(p, cfg), action: 'jump' };
  if (p.vy < 0 && p.height < BUFFER_HEIGHT) {
    return { player: { ...p, buffer: BUFFER_TIME, lastTap: 'none' }, action: 'buffered' };
  }
  if (p.level < 3) {
    const level = (p.level + 1) as Level;
    return { player: { ...p, vy: cfg.boostV, level, lastTap: 'boost', pendingSlide: false }, action: 'boost' };
  }
  return { player: { ...p, lastTap: 'none' }, action: 'none' };
}

/** Keyboard ↓ (no tap): slide on the floor; in the air, dive and slide on landing. */
export function slidePlayer(p: PlayerState, cfg: PhysicsConfig): { player: PlayerState; action: SlideAction } {
  if (p.sliding || p.pendingSlide) return { player: p, action: 'none' };
  if (p.grounded) return { player: startSlide(p, cfg), action: 'slide' };
  return { player: { ...p, vy: -cfg.fallV, pendingSlide: true, buffer: 0 }, action: 'dive' };
}

/**
 * A swipe modifies the touch that started it; only ↓ has a meaning in v4. ↓ right after the
 * ground jump this touch started turns that jump into a slide; otherwise it acts like the ↓ key.
 */
export function swipePlayer(p: PlayerState, dir: Swipe, cfg: PhysicsConfig): { player: PlayerState; action: SlideAction } {
  if (dir !== 'down') return { player: p, action: 'none' };
  const converts = !p.grounded && !p.pendingSlide && p.lastTap === 'jump' && p.airTime <= SWIPE_WINDOW + 1e-6;
  return converts ? { player: startSlide(p, cfg), action: 'slide' } : slidePlayer(p, cfg);
}

interface StepResult {
  readonly player: PlayerState;
  readonly landed: boolean;
  readonly autoJumped: boolean;
  readonly slideStarted: boolean;
}

const result = (player: PlayerState, landed = false, autoJumped = false, slideStarted = false): StepResult => ({
  player, landed, autoJumped, slideStarted,
});

function land(p: PlayerState, cfg: PhysicsConfig): StepResult {
  if (p.buffer > 0) return result(takeoff(p, cfg), true, true);
  if (p.pendingSlide) return result(startSlide(p, cfg), true, false, true);
  return result({
    ...p, height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0, lastTap: 'none',
  }, true);
}

function stepGrounded(p: PlayerState, dt: number): PlayerState {
  if (!p.sliding) return { ...p, landTimer: p.landTimer + dt };
  const slideTime = p.slideTime - dt;
  if (slideTime <= 0) return { ...p, ...NOT_SLIDING, landTimer: p.landTimer + dt };
  return { ...p, slideTime, slideAge: p.slideAge + dt, landTimer: p.landTimer + dt };
}

function stepOnce(p: PlayerState, dt: number, cfg: PhysicsConfig): StepResult {
  if (p.grounded) return result(stepGrounded(p, dt));
  const vy = p.vy - cfg.gravity * dt;
  const height = p.height + vy * dt;
  const buffer = Math.max(0, p.buffer - dt);
  const next: PlayerState = { ...p, vy, height, buffer, airTime: p.airTime + dt };
  if (height <= 0 && vy <= 0) return land(next, cfg);
  return result(next);
}

export function stepPlayer(p: PlayerState, dt: number, cfg: PhysicsConfig): StepResult {
  if (!(dt > 0)) return result(p);
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-9));
  const h = dt / steps;
  let acc: StepResult = result(p);
  for (let i = 0; i < steps; i++) {
    const r = stepOnce(acc.player, h, cfg);
    acc = result(r.player, acc.landed || r.landed, acc.autoJumped || r.autoJumped, acc.slideStarted || r.slideStarted);
  }
  return acc;
}

/**
 * Total airtime of a level-L jump when every boost is tapped exactly at the apex
 * of the previous segment (closed form of that simulation).
 */
export function airtimeForLevel(level: Level, cfg: PhysicsConfig): number {
  const g = cfg.gravity;
  const boosts = level - 1;
  const rise = cfg.jumpV / g + (boosts * cfg.boostV) / g;
  const apex = (cfg.jumpV * cfg.jumpV + boosts * cfg.boostV * cfg.boostV) / (2 * g);
  return rise + Math.sqrt((2 * apex) / g);
}
