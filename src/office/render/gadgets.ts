// Office build stand-in for src/render/gadgets.ts (build/office-swaps.ts): drones are drawn as the superior's
// chest-height prop (paper planes, document tornado…) at the v8 drone position; pickups stay v8.
import type { VisibleObstacle } from '../../types';
import { fixedX, laneY, project } from '../../render/layout';
import { drawGadgets as v8Gadgets } from '../../render/gadgets';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import { PROP_SIZE, drawFootprint, drawProp, propImage } from './props';

export * from '../../render/gadgets';

/** the v8 drone hover height (gadgets.ts DRONE_MIN_H + 10) and squad scale */
const DRONE_Y = 160;

function droneProp(ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, lane: number, t: number): void {
  const p = project(fixedX(o.timeUntil), lane, Math.max(o.height + 10, DRONE_Y));
  const s = p.scale * 0.86;
  drawFootprint(ctx, o.kind, p.x, laneY(lane) + 2, PROP_SIZE.drone * 0.8 * s);
  drawProp(ctx, img, p.x, p.y + Math.sin(t * 2.6 + lane) * 2, PROP_SIZE.drone * s, 0.5);
}

/** v8 contract: the drones in lane `lane` and the pickups floating in that lane */
export function drawGadgets(ctx: Ctx, obs: readonly VisibleObstacle[], t: number, sprites: SpriteCache, lane: number): void {
  const rest: VisibleObstacle[] = [];
  for (const o of obs) {
    const img = o.kind === 'drone' ? propImage(o) : null;
    if (img) droneProp(ctx, img, o, lane, t);
    else rest.push(o);
  }
  v8Gadgets(ctx, rest, t, sprites, lane);
}
