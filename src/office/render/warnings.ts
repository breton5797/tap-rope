// Office build stand-in for src/render/warnings.ts (build/office-swaps.ts): the v8 "!" signs, except
// - attacks from behind that the office renderer marked THIS frame with its 「뒤에서!」 arrow (the renderer
//   scans every hazard within SIGN_LEAD ≥ WARN_LEAD before drawing, so the warning is never later than v8's);
// - one sign per hazard: a lane attack over two lanes is signed in the lane nearest the hero only;
// - hazards drawn as an office prop with its footprint (keepV8Sign).
import type { LaneId, VisibleObstacle } from '../../types';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { drawWarnings as v8Warnings } from '../../render/warnings';
import { isRear, markedThisFrame } from './readability';
import { propImage } from './props';

/**
 * polish P2: the v8 amber ⚠ (and its red target ring) is one more colour on a hazard the office already signs
 * with its prop and a move-coloured footprint — it only stays where the prop art is missing (v8 drawing).
 */
export function keepV8Sign(propDrawn: boolean): boolean {
  return !propDrawn;
}

export * from '../../render/warnings';

/** an attack from behind (rear beam / head-height beam or a chaser) — the readability helper */
export const isRearAttack = isRear;

/** reused per call (no per-frame allocation): the obstacles passed on, and single-lane copies */
const SIGNED: VisibleObstacle[] = [];
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const COPIES: Mutable<VisibleObstacle>[] = Array.from({ length: 12 }, () => ({
  id: '', kind: 'guard', level: 1, from: null, timeUntil: 0, height: 0, lanes: [0] as LaneId[], sudden: false,
}));

export function drawWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], agentLane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  SIGNED.length = 0;
  let c = 0;
  const marked = markedThisFrame();
  for (const o of obs) {
    if (marked.has(o.id) || !keepV8Sign(propImage(o) !== null)) continue;
    if (o.lanes && o.lanes.length > 1 && c < COPIES.length) {
      let near = o.lanes[0];
      for (const l of o.lanes) if (Math.abs(l - agentLane) < Math.abs(near - agentLane)) near = l;
      const copy = COPIES[c++];
      copy.id = o.id;
      copy.kind = o.kind;
      copy.level = o.level;
      copy.from = o.from;
      copy.timeUntil = o.timeUntil;
      copy.height = o.height;
      copy.sudden = o.sudden;
      (copy.lanes as LaneId[])[0] = near;
      SIGNED.push(copy);
    } else SIGNED.push(o);
  }
  v8Warnings(ctx, v, SIGNED, agentLane, t, sprites, reduced);
}
