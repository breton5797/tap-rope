// 2.5D corridor layout (logical px). The camera looks down ~20° at a corridor with three depth
// lanes (0 = far / upper, 1 = middle, 2 = near / lower). The agent runs right at PLAYER_X; the
// corridor scrolls left. Heights are px above the floor. Everything is placed with project():
// lanes are 38px apart on screen and scale 0.9 / 1.0 / 1.1, and x converges on PLAYER_X with
// depth, so a world-fixed object reaches the agent at the same moment in every lane.
import { GROUND_Y, LANE_SWITCH_TIME, PLAYER_X, SCROLL_SPEED, type LaserFrom, type PlayerState } from '../types';
import type { View } from './view';

/** screen y of the corridor ceiling */
export const CEIL_Y = 150;
/** screen px between neighbouring lane floor lines */
export const LANE_STEP = 38;
/** depth scale change per lane (0.9 / 1.0 / 1.1) */
export const DEPTH_STEP = 0.1;
/** depth of the back wall's foot and of the floor's front edge (half a lane outside lanes 0 / 2) */
export const WALL_DEPTH = -0.5;
export const FRONT_DEPTH = 2.5;
/** full-width hazards span this depth range (a hair inside the floor edges) */
export const SPAN_D0 = -0.42;
export const SPAN_D1 = 2.42;
/** world height of the ceiling (its middle-lane screen y is the ceiling band's lower edge) */
export const CEIL_H = GROUND_Y - (CEIL_Y + 8);
/** stacked beam centre heights for levels 1..3 (knee, waist, chest) */
export const BEAM_H: readonly number[] = [16, 40, 64];
/** head-height beam (slide under it) */
export const HIGH_H = 56;
/** ceiling lasers stop just above a sliding agent */
export const CEIL_LASER_END = 46;
/** floor lasers rise to CLEAR_H (core physics): clearing the fence == passing the judge */
export const FLOOR_LASER_H = 24;
/** a flying beam enters the screen this long before it reaches the agent */
export const ENTER_TIME = 0.9;
/** floor/ceiling emitters switch on this long before arrival */
export const ARM_TIME = 0.6;
export const CHARGE_TIME = 1.0;
export const BEAM_LEN = 120;
export const ESCORT_DX = -76; // v7.1: room for the ×1.2 crouch-running scientist behind a sliding agent
/** agent drawing scale (the rig is authored 88px tall, GDD-v6 §3) */
export const AGENT_SCALE = 1.0;

/** screen y of the floor at (fractional) lane depth d */
export function laneY(d: number): number {
  return GROUND_Y + (d - 1) * LANE_STEP;
}

/** drawing scale at (fractional) lane depth d */
export function depthScale(d: number): number {
  return 1 + (d - 1) * DEPTH_STEP;
}

/** fractional lane depth of a floor point at screen y (inverse of laneY) */
export function depthAtY(y: number): number {
  return 1 + (y - GROUND_Y) / LANE_STEP;
}

export const FLOOR_BACK = laneY(WALL_DEPTH);
export const FLOOR_FRONT = laneY(FRONT_DEPTH);

/** Screen x of world x (= screen x in the middle lane) at depth d. */
export function projX(x: number, d: number): number {
  return PLAYER_X + (x - PLAYER_X) * depthScale(d);
}

/** Screen y of a point `height` px above the floor at depth d. */
export function projY(d: number, height: number): number {
  return laneY(d) - height * depthScale(d);
}

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

/** shared result of project() (no per-call allocation in the draw loop) */
const PROJECTED: Projected = { x: 0, y: 0, scale: 1 };

/**
 * The single 2.5D projection: middle-lane x, lane depth (fractional), height → screen.
 * Returns a shared object: read it before the next project() call.
 */
export function project(x: number, lane: number, height: number): Readonly<Projected> {
  const scale = depthScale(lane);
  PROJECTED.x = PLAYER_X + (x - PLAYER_X) * scale;
  PROJECTED.y = laneY(lane) - height * scale;
  PROJECTED.scale = scale;
  return PROJECTED;
}

/** Middle-lane screen x of world-fixed hardware (emitters, guards, crates, pickups, doors). */
export function fixedX(timeUntil: number): number {
  return PLAYER_X + timeUntil * SCROLL_SPEED;
}

/** Speed of a flying beam so it enters the visible area ENTER_TIME before arrival. */
export function beamSpeed(from: LaserFrom, v: View): number {
  const dist = from === 'back' ? PLAYER_X - v.x0 : v.x0 + v.w - PLAYER_X;
  return Math.max(60, dist / ENTER_TIME);
}

/** Middle-lane screen x of a flying beam's leading edge. */
export function flyingX(from: LaserFrom, timeUntil: number, v: View): number {
  const sp = beamSpeed(from, v);
  return from === 'back' ? PLAYER_X - timeUntil * sp : PLAYER_X + timeUntil * sp;
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Lane-switch progress 0..1 (1 = settled). */
export function laneProgress(p: PlayerState): number {
  if (p.lane === p.laneFrom) return 1;
  const k = p.laneAge / LANE_SWITCH_TIME;
  return k >= 1 ? 1 : k <= 0 ? 0 : easeInOut(k);
}

/** The agent's drawn (fractional) lane depth, eased from laneFrom to lane. */
export function visualLane(p: PlayerState): number {
  return p.laneFrom + (p.lane - p.laneFrom) * laneProgress(p);
}

/** Small lean (radians) while switching lanes: forward-ish toward far, back-ish toward near. */
export function laneLean(p: PlayerState): number {
  const k = laneProgress(p);
  if (k >= 1) return 0;
  return Math.sign(p.lane - p.laneFrom) * -0.14 * Math.sin(k * Math.PI);
}
