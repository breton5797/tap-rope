// Office build stand-in for src/render/hazards.ts (build/office-swaps.ts): lane hazards (guard, drop, chaser)
// are drawn as the superior's props (or the cart event's cart) at the v8 positions; the drop keeps its
// landing shadow and target ring. Anything without a loaded prop keeps the v8 drawing.
import type { LaneId, VisibleObstacle } from '../../types';
import { WARN_LEAD } from '../../types';
import { depthScale, fixedX, laneY, project, projX, projY } from '../../render/layout';
import { CHASE_ENTER, chaserX, dropHeight, drawLaneHazards as v8LaneHazards, targetRing } from '../../render/hazards';
import type { SpriteCache } from '../../render/sprites';
import { oval, type Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { drawProp, propImage } from './props';

export * from '../../render/hazards';

const GUARD_H = 70;
const DROP_H = 46;
const CHASER_H = 44;
const CHASER_Y = 34;

function shadow(ctx: Ctx, x: number, y: number, rx: number, a: number): void {
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = a;
  oval(ctx, x, y + 1, rx, rx * 0.22);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function propHazard(ctx: Ctx, v: View, img: HTMLImageElement, o: VisibleObstacle, lane: number, t: number, reduced: boolean): void {
  const tu = o.timeUntil;
  const s = depthScale(lane);
  if (o.kind === 'guard') {
    const p = project(fixedX(tu), lane, 0);
    shadow(ctx, p.x, p.y, 20 * s, 0.35);
    drawProp(ctx, img, p.x, p.y, GUARD_H * s, 1);
  } else if (o.kind === 'drop') {
    const x = projX(fixedX(tu), lane);
    const k = Math.min(1, Math.max(0, 1 - tu / WARN_LEAD));
    shadow(ctx, x, laneY(lane), (24 - 5 * k) * s, 0.1 + 0.5 * k);
    if (tu <= WARN_LEAD && tu > 0.1) targetRing(ctx, x, laneY(lane) + 1, s, t, reduced, 0.4 + 0.6 * k);
    drawProp(ctx, img, x, projY(lane, dropHeight(tu)), DROP_H * s, 1);
  } else if (o.kind === 'chaser' && tu <= CHASE_ENTER) {
    const x = projX(chaserX(tu, v), lane);
    shadow(ctx, x, laneY(lane), 15 * s, 0.3);
    // it comes from behind, facing the way it runs
    drawProp(ctx, img, x, projY(lane, CHASER_Y), CHASER_H * s, 0.5, true);
  }
}

/** v8 contract: lane hazards occupying lane `lane` (once per lane in painter order, far → near) */
export function drawLaneHazards(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], lane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  const fallback: VisibleObstacle[] = [];
  for (const o of obs) {
    if (!o.lanes || !o.lanes.includes(lane as LaneId)) continue;
    const img = propImage(o);
    if (img) propHazard(ctx, v, img, o, lane, t, reduced);
    else fallback.push(o);
  }
  if (fallback.length > 0) v8LaneHazards(ctx, v, fallback, lane, t, sprites, reduced);
}
