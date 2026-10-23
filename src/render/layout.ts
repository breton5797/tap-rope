// Side-view corridor layout (logical px). The agent runs right at PLAYER_X on GROUND_Y;
// the corridor scrolls left. Heights are px above the floor line.
import { GROUND_Y, PLAYER_X, SCROLL_SPEED, type LaserFrom } from '../types';
import type { View } from './view';

/** screen y of the corridor ceiling */
export const CEIL_Y = 150;
/** floor top surface depth (seen slightly from above) */
export const FLOOR_DEPTH = 30;
/** stacked beam centre heights for levels 1..3 (knee, waist, chest) */
export const BEAM_H: readonly number[] = [16, 40, 64];
/** head-height beam (slide under it) */
export const HIGH_H = 56;
/** ceiling lasers stop just above a sliding agent */
export const CEIL_LASER_END = 46;
/** floor lasers rise to knee height */
export const FLOOR_LASER_H = 40;
/** a flying beam enters the screen this long before it reaches the agent */
export const ENTER_TIME = 0.9;
/** floor/ceiling emitters switch on this long before arrival */
export const ARM_TIME = 0.6;
export const CHARGE_TIME = 1.0;
export const BEAM_LEN = 120;
export const ESCORT_DX = -54;
/** agent drawing scale (art is authored ~58px tall) */
export const AGENT_SCALE = 1.25;

export function floorY(h: number): number {
  return GROUND_Y - h;
}

/** Screen x of world-fixed hardware (floor/ceiling emitters, drones, pickups). */
export function fixedX(timeUntil: number): number {
  return PLAYER_X + timeUntil * SCROLL_SPEED;
}

/** Speed of a flying beam so it enters the visible area ENTER_TIME before arrival. */
export function beamSpeed(from: LaserFrom, v: View): number {
  const dist = from === 'back' ? PLAYER_X - v.x0 : v.x0 + v.w - PLAYER_X;
  return Math.max(60, dist / ENTER_TIME);
}

/** Screen x of a flying beam's leading tip. */
export function flyingX(from: LaserFrom, timeUntil: number, v: View): number {
  const sp = beamSpeed(from, v);
  return from === 'back' ? PLAYER_X - timeUntil * sp : PLAYER_X + timeUntil * sp;
}
