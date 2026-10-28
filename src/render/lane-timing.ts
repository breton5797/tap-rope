// v8 (GDD-v8 A1): the rhythm lane teaches the input moment, not the arrival moment. Jump and slide
// icons reach the hit ring when the player should press; lane / drone / pickup icons keep arrival time.
import type { JumpLevel, LaneItem, ObstacleKind, PhysicsConfig } from '../types';
import { SLIDE_IDEAL } from '../core/judge';

/** a slide started this long before arrival is graded perfect (core/judge SLIDE_IDEAL) */
const SLIDE_LEAD = SLIDE_IDEAL;
/** a later icon is drawn at least this far (s) behind an earlier one, so levels never reorder the strip */
export const MIN_ICON_GAP = 0.12;

const isJump = (k: ObstacleKind): boolean => k === 'floor' || k === 'beam';
const isSlide = (k: ObstacleKind): boolean => k === 'high' || k === 'ceiling';

/**
 * Seconds before arrival at which the beat's input is ideal: a jump tapped then (boosts at each apex)
 * is at the apex of its last segment when the laser arrives (core/judge's perfect); a slide is SLIDE_IDEAL old.
 */
export function idealLead(kinds: readonly ObstacleKind[], level: JumpLevel, cfg: PhysicsConfig): number {
  if (kinds.some(isJump)) {
    const boosts = Math.max(1, level) - 1;
    return (cfg.jumpV + boosts * cfg.boostV) / cfg.gravity;
  }
  return kinds.some(isSlide) ? SLIDE_LEAD : 0;
}

/**
 * Fills `out` with each item's drawn time-until (timeUntil − idealLead). Items come in arrival order; among
 * the jump / slide icons (the right thumb's inputs) a later one stays MIN_ICON_GAP behind the previous, so a
 * high-level jump never jumps ahead of the hop before it. Lane / drone / pickup icons (no lead) never push
 * an input icon back. Returns the count written.
 */
export function displayTimes(items: readonly LaneItem[], cfg: PhysicsConfig, out: Float64Array): number {
  const n = Math.min(items.length, out.length);
  let lastInput = -Infinity;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const lead = idealLead(it.kinds, it.level, cfg);
    const t = it.timeUntil - lead;
    if (lead <= 0) {
      out[i] = t;
      continue;
    }
    out[i] = Math.max(t, lastInput + MIN_ICON_GAP);
    lastInput = out[i];
  }
  return n;
}
