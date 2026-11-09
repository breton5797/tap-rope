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

export interface KickTransform {
  readonly scale: number;
  /** css px */
  readonly tx: number;
  readonly ty: number;
}
const NO_KICK: KickTransform = { scale: 1, tx: 0, ty: 0 };

/**
 * the kick as a CSS transform of the game canvas (perf r4: the compositor zooms it — no full-screen canvas
 * self-copy): the zoom and the shake of `k` at time `t` for a `w`×`h` css px canvas drawn at `s` css px per
 * logical px; scaled up just enough that the shake never uncovers an edge.
 */
export function kickTransform(k: Kick, t: number, w: number, h: number, s: number): KickTransform {
  if (k.zoom === 1 && k.shake === 0) return NO_KICK;
  const tx = Math.sin(t * 90) * k.shake * s;
  const ty = Math.cos(t * 77) * k.shake * s;
  const cover = 1 + 2 * Math.max(Math.abs(tx) / w, Math.abs(ty) / h);
  return { scale: Math.max(k.zoom, cover), tx, ty };
}

/** the transform as a CSS string ('none' at rest) */
export function kickCss(x: KickTransform): string {
  if (x.scale === 1 && x.tx === 0 && x.ty === 0) return 'none';
  return `translate(${x.tx.toFixed(2)}px, ${x.ty.toFixed(2)}px) scale(${x.scale.toFixed(4)})`;
}

/**
 * The whole kick starting at `start` (s) as `n` + 1 evenly spaced keyframes (perf r4): one Web Animation per
 * kick runs on the compositor — no style write per frame. The last frame is the rest pose.
 */
export function kickKeyframes(start: number, w: number, h: number, s: number, n: number): Keyframe[] {
  const out: Keyframe[] = [];
  for (let i = 0; i <= n; i++) {
    const t = start + (KICK_TIME * i) / n;
    const x = i === n ? NO_KICK : kickTransform(surpriseKick(t, start), t, w, h, s);
    out.push({ offset: i / n, transform: kickCss(x) });
  }
  return out;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const BUBBLE_GAP = 6;

/**
 * Centre y for a bubble (centre x, y, size w×h) that must not cover `avoid` (the countdown digit):
 * its own spot when clear, else just above the digit if that stays under `minY` (the HUD), else just below.
 */
export function placeBubble(b: { x: number; y: number; w: number; h: number }, avoid: Rect | null, minY: number): number {
  if (!avoid) return b.y;
  const clear = b.x + b.w / 2 <= avoid.left || b.x - b.w / 2 >= avoid.right || b.y + b.h / 2 <= avoid.top || b.y - b.h / 2 >= avoid.bottom;
  if (clear) return b.y;
  const above = avoid.top - BUBBLE_GAP - b.h / 2;
  return above - b.h / 2 >= minY ? above : avoid.bottom + BUBBLE_GAP + b.h / 2;
}
