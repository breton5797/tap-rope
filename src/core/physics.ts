/**
 * Player jump physics (pure, immutable).
 * Velocity positive = up. A ground tap jumps (level 1); each air tap SETS vy to
 * boostV and raises the level (max 3). A tap while descending close to the
 * ground is buffered and fires on landing. stepPlayer sub-steps large dt.
 */
import type { Level, PhysicsConfig, PlayerState, WorldId } from '../types';
import { WORLDS } from './content';

export const DEFAULT_PHYSICS: PhysicsConfig = { gravity: 3000, jumpV: 660, boostV: 700 };
export const CLEAR_H = 12;
export const PERFECT_H = 40;

const BUFFER_TIME = 0.12;
const BUFFER_HEIGHT = 26;
const MAX_STEP = 1 / 120;

export type TapAction = 'jump' | 'boost' | 'buffered' | 'none';

export function physicsForWorld(world: WorldId): PhysicsConfig {
  const scale = WORLDS[world].gravityScale;
  if (scale === 1) return DEFAULT_PHYSICS;
  const vScale = Math.sqrt(scale);
  return {
    gravity: DEFAULT_PHYSICS.gravity * scale,
    jumpV: DEFAULT_PHYSICS.jumpV * vScale,
    boostV: DEFAULT_PHYSICS.boostV * vScale,
  };
}

export function initialPlayer(): PlayerState {
  return { height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0 };
}

function takeoff(p: PlayerState, cfg: PhysicsConfig): PlayerState {
  return { ...p, height: 0, vy: cfg.jumpV, grounded: false, level: 1, airTime: 0, buffer: 0 };
}

export function tapPlayer(
  p: PlayerState,
  cfg: PhysicsConfig,
): { player: PlayerState; action: TapAction } {
  if (p.grounded) return { player: takeoff(p, cfg), action: 'jump' };
  if (p.vy < 0 && p.height < BUFFER_HEIGHT) {
    return { player: { ...p, buffer: BUFFER_TIME }, action: 'buffered' };
  }
  if (p.level < 3) {
    const level = (p.level + 1) as Level;
    return { player: { ...p, vy: cfg.boostV, level }, action: 'boost' };
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
  };
  if (p.buffer > 0) return { player: takeoff(grounded, cfg), landed: true, autoJumped: true };
  return { player: grounded, landed: true, autoJumped: false };
}

function stepOnce(p: PlayerState, dt: number, cfg: PhysicsConfig): StepResult {
  if (p.grounded) {
    return { player: { ...p, landTimer: p.landTimer + dt }, landed: false, autoJumped: false };
  }
  const vy = p.vy - cfg.gravity * dt;
  const height = p.height + vy * dt;
  const buffer = Math.max(0, p.buffer - dt);
  const next: PlayerState = { ...p, vy, height, buffer, airTime: p.airTime + dt };
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
