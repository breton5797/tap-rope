/**
 * Player jump physics (pure, immutable). GDD §2, v2 §9.
 * Velocity positive = up. A ground tap jumps (level 1); each air tap SETS vy to
 * boostV and raises the level (max 3). A tap while descending close to the
 * ground is buffered and fires on landing. A swipe modifies the jump its touch
 * started: within SWIPE_WINDOW of a ground jump ↑ = 덤블링, ←/→ = lane change,
 * ↓ = 뒤로넘기 toggle (solo); after an air tap ←/→ = 엇걸어 (cross).
 * stepPlayer sub-steps large dt and eases laneX toward lane.
 */
import type { Lane, Level, PhysicsConfig, PlayerState, RopeMode, Swipe, WorldId } from '../types';
import { WORLDS } from './content';

export const DEFAULT_PHYSICS: PhysicsConfig = { gravity: 3000, jumpV: 660, boostV: 700, tumbleV: 980 };
export const CLEAR_H = 12;
export const PERFECT_H = 40;
export const SWIPE_WINDOW = 0.25;

const BUFFER_TIME = 0.12;
const BUFFER_HEIGHT = 26;
const MAX_STEP = 1 / 120;
const LANE_SPEED = 9; // lanes per second

export type TapAction = 'jump' | 'boost' | 'buffered' | 'none';
export type SwipeAction = 'tumble' | 'side' | 'cross' | 'reverse' | 'none';

export function physicsForWorld(world: WorldId): PhysicsConfig {
  const scale = WORLDS[world].gravityScale;
  if (scale === 1) return DEFAULT_PHYSICS;
  const vScale = Math.sqrt(scale);
  return {
    gravity: DEFAULT_PHYSICS.gravity * scale,
    jumpV: DEFAULT_PHYSICS.jumpV * vScale,
    boostV: DEFAULT_PHYSICS.boostV * vScale,
    tumbleV: DEFAULT_PHYSICS.tumbleV * vScale,
  };
}

export function initialPlayer(): PlayerState {
  return {
    height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
    lane: 0, laneX: 0, tumble: false, cross: false, backward: false, lastTap: 'none', pendingSwipe: null,
  };
}

function takeoff(p: PlayerState, cfg: PhysicsConfig): PlayerState {
  return {
    ...p, height: 0, vy: cfg.jumpV, grounded: false, level: 1, airTime: 0, buffer: 0, lastTap: 'jump',
  };
}

export function tapPlayer(
  p: PlayerState,
  cfg: PhysicsConfig,
): { player: PlayerState; action: TapAction } {
  if (p.grounded) return { player: takeoff(p, cfg), action: 'jump' };
  if (p.tumble) return { player: p, action: 'none' };
  if (p.vy < 0 && p.height < BUFFER_HEIGHT) {
    return { player: { ...p, buffer: BUFFER_TIME, lastTap: 'none' }, action: 'buffered' };
  }
  if (p.level < 3) {
    const level = (p.level + 1) as Level;
    return { player: { ...p, vy: cfg.boostV, level, lastTap: 'boost' }, action: 'boost' };
  }
  return { player: { ...p, lastTap: 'none' }, action: 'none' };
}

function groundSwipe(p: PlayerState, dir: Swipe, cfg: PhysicsConfig, mode: RopeMode): {
  player: PlayerState; action: SwipeAction;
} {
  const none = { player: p, action: 'none' as const };
  if (dir === 'up') {
    if (p.tumble) return none;
    // re-launch so the apex matches a tumble taken straight from the ground, however late the swipe
    const vy = Math.sqrt(Math.max(0, cfg.tumbleV * cfg.tumbleV - 2 * cfg.gravity * p.height));
    return { player: { ...p, tumble: true, vy }, action: 'tumble' };
  }
  if (dir === 'down') {
    return mode === 'solo' ? { player: { ...p, backward: !p.backward }, action: 'reverse' } : none;
  }
  const lane = Math.max(-1, Math.min(1, p.lane + (dir === 'left' ? -1 : 1))) as Lane;
  return lane === p.lane ? none : { player: { ...p, lane }, action: 'side' };
}

export function swipePlayer(
  p: PlayerState,
  dir: Swipe,
  cfg: PhysicsConfig,
  mode: RopeMode,
): { player: PlayerState; action: SwipeAction } {
  if (p.grounded || p.tumble) return { player: p, action: 'none' };
  if (p.buffer > 0) return { player: { ...p, pendingSwipe: dir }, action: 'none' };
  if (p.lastTap === 'jump' && p.airTime <= SWIPE_WINDOW + 1e-6) return groundSwipe(p, dir, cfg, mode);
  if (p.lastTap === 'boost' && (dir === 'left' || dir === 'right')) {
    return { player: { ...p, cross: true }, action: 'cross' };
  }
  return { player: p, action: 'none' };
}

interface StepResult {
  readonly player: PlayerState;
  readonly landed: boolean;
  readonly autoJumped: boolean;
}

function land(p: PlayerState, cfg: PhysicsConfig): StepResult {
  const grounded: PlayerState = {
    ...p, height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0,
    tumble: false, cross: false, lastTap: 'none', pendingSwipe: null,
  };
  if (p.buffer > 0) {
    return { player: takeoff({ ...grounded, pendingSwipe: p.pendingSwipe }, cfg), landed: true, autoJumped: true };
  }
  return { player: grounded, landed: true, autoJumped: false };
}

function easeLane(p: PlayerState, dt: number): number {
  const d = p.lane - p.laneX;
  const stepMax = LANE_SPEED * dt;
  return Math.abs(d) <= stepMax ? p.lane : p.laneX + Math.sign(d) * stepMax;
}

function stepOnce(p: PlayerState, dt: number, cfg: PhysicsConfig): StepResult {
  const laneX = easeLane(p, dt);
  if (p.grounded) {
    return { player: { ...p, laneX, landTimer: p.landTimer + dt }, landed: false, autoJumped: false };
  }
  const vy = p.vy - cfg.gravity * dt;
  const height = p.height + vy * dt;
  const buffer = Math.max(0, p.buffer - dt);
  const next: PlayerState = { ...p, laneX, vy, height, buffer, airTime: p.airTime + dt };
  if (height <= 0 && vy <= 0) return land(next, cfg);
  return { player: next, landed: false, autoJumped: false };
}

export function stepPlayer(p: PlayerState, dt: number, cfg: PhysicsConfig): StepResult {
  if (!(dt > 0)) return { player: p, landed: false, autoJumped: false };
  const steps = Math.max(1, Math.ceil(dt / MAX_STEP - 1e-9));
  const h = dt / steps;
  let result: StepResult = { player: p, landed: false, autoJumped: false };
  for (let i = 0; i < steps; i++) {
    const r = stepOnce(result.player, h, cfg);
    result = {
      player: r.player,
      landed: result.landed || r.landed,
      autoJumped: result.autoJumped || r.autoJumped,
    };
  }
  return result;
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

/** Airtime of a 덤블링: the swipe re-launches the jump as if taken off at tumbleV. */
export function airtimeTumble(cfg: PhysicsConfig): number {
  return (2 * cfg.tumbleV) / cfg.gravity;
}
