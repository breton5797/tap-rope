// Office build stand-in for src/render/warnings.ts (build/office-swaps.ts): the v8 "!" signs, except for attacks
// from behind (rear beams / chasers) — the office renderer marks those with its pulsing 「뒤에서!」 arrow at
// the left edge from 1.2 s ahead (≥ the v8 1.0 s lead), and two signs for one attack read as clutter.
import type { VisibleObstacle } from '../../types';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { drawWarnings as v8Warnings } from '../../render/warnings';

export * from '../../render/warnings';

/** reused per call (no per-frame allocation) */
const FRONT: VisibleObstacle[] = [];

export const isRearAttack = (o: Pick<VisibleObstacle, 'from' | 'kind'>): boolean => o.from === 'back' || o.kind === 'chaser';

export function drawWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], agentLane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  FRONT.length = 0;
  for (const o of obs) if (!isRearAttack(o)) FRONT.push(o);
  v8Warnings(ctx, v, FRONT, agentLane, t, sprites, reduced);
}
