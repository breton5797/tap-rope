// Office "깜놀" timing (office spec §6, §9): pure curves for the blackout and the boss-attack kick.
import { BLACKOUT_FADE, type OfficeEvent } from '../core/events';

export interface BlackoutAlpha {
  /** darkness over the scene (0..1) */
  readonly scene: number;
  /** alpha of the glowing hazard outlines drawn over the darkness */
  readonly outline: number;
}

const DARK = 0.8;
const OUTLINE = 0.9;
const FADE_OUT = BLACKOUT_FADE;
const OFF: BlackoutAlpha = { scene: 0, outline: 0 };

/** fully dark for the event window (outlines bright), then a short fade back */
export function blackoutAlpha(t: number, e: OfficeEvent): BlackoutAlpha {
  const end = e.time + e.duration;
  if (t < e.time || t > end + FADE_OUT) return OFF;
  if (t <= end) return { scene: DARK, outline: OUTLINE };
  return { scene: DARK * (1 - (t - end) / FADE_OUT), outline: OUTLINE };
}

export interface Kick {
  readonly zoom: number;
  /** shake amplitude in logical px */
  readonly shake: number;
}

export const KICK_TIME = 0.15;
const KICK_ZOOM = 0.06;
const KICK_SHAKE = 3;
const REST: Kick = { zoom: 1, shake: 0 };

/** a 0.15 s punch-in (peak zoom 1.06 mid-way) with a decaying shake, from the attack telegraph start */
export function surpriseKick(t: number, attackTime: number): Kick {
  const age = t - attackTime;
  if (age < 0 || age > KICK_TIME) return REST;
  const k = age / KICK_TIME;
  return { zoom: 1 + KICK_ZOOM * Math.sin(k * Math.PI), shake: KICK_SHAKE * (1 - k) };
}
