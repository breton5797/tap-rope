// Office build stand-in for src/render/gadgets.ts (build/office-swaps.ts): drones are drawn as the superior's
// chest-height prop (paper planes, document tornado…) at the v8 drone position — thrown from the boss's hand
// first (F5) and with idle motion (F6); pickups use the office sprites / the stage collectible (F7). Anything
// whose sprite has not loaded keeps the v8 drawing.
import type { Beat, VisibleObstacle } from '../../types';
import { SCROLL_SPEED } from '../../types';
import { fixedX, laneY, project } from '../../render/layout';
import { drawGadgets as v8Gadgets } from '../../render/gadgets';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import { heldFade, joinTime, throwArc, throwHand, throwStep } from './boss-throw';
import { pickupSprite } from './collectibles';
import { officeImage } from './images';
import { PROP_SIZE, beatIdOf, drawFootprint, drawProp, laneSizeK, propIdFor, propImage, propMotion } from './props';

export * from '../../render/gadgets';

/** the v8 drone hover height (gadgets.ts DRONE_MIN_H + 10) and squad scale */
const DRONE_Y = 160;
const PICKUP_H = 30;

/** per-frame run context (set by the office renderer): the run's beats and stage, for pickup sprites */
const run = { beats: [] as readonly Beat[], stageIndex: 0 };

export function setPickupFrame(beats: readonly Beat[], stageIndex: number): void {
  run.beats = beats;
  run.stageIndex = stageIndex;
}

function droneProp(ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, lane: number, t: number): void {
  const h = Math.max(o.height + 10, DRONE_Y);
  const join = joinTime(SCROLL_SPEED);
  const step = throwStep(o.kind, o.from, o.timeUntil, join);
  if (step === -1) return;
  const at = project(fixedX(step === null ? o.timeUntil : join), lane, h);
  const s = at.scale * 0.86 * laneSizeK(lane);
  const x = at.x;
  const y = at.y;
  const m = propMotion(propIdFor(o), t + beatIdOf(o) * 0.61 + lane * 0.23);
  drawFootprint(ctx, o.kind, x, laneY(lane) + 2, PROP_SIZE.drone * 0.8 * s, step === null ? 1 : step);
  if (step === null) {
    drawProp(ctx, img, x, y, PROP_SIZE.drone * s, 0.5, false, 1, m);
    return;
  }
  LAND.x = x;
  LAND.y = y;
  const p = throwArc(throwHand(), LAND, step);
  drawProp(ctx, img, p.x, p.y, PROP_SIZE.drone * s, 0.5, false, heldFade(o.kind, o.timeUntil), m);
}

const LAND = { x: 0, y: 0 };

/** an office pickup sprite floating where the v8 pickup floats; false when the sprite isn't loaded */
function pickupProp(ctx: Ctx, o: VisibleObstacle, lane: number, t: number): boolean {
  const id = beatIdOf(o);
  const img = officeImage(pickupSprite(o.kind, run.beats[id], run.stageIndex));
  if (!img) return false;
  if (o.timeUntil < -0.05) return true;
  const p = project(fixedX(o.timeUntil), lane, o.height + 14);
  const y = p.y + Math.sin(t * 2.2 + id) * 1.5;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,190,77,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(p.x, laneY(lane) + 1, 10 * p.scale, 2.8 * p.scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // a slow coin-like turn
  const turn = Math.max(0.25, Math.abs(Math.cos(t * 2.4 + id)));
  const h = PICKUP_H * p.scale;
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.drawImage(img, p.x - (w * turn) / 2, y - h / 2, w * turn, h);
  return true;
}

const isPickup = (o: VisibleObstacle): boolean => o.kind === 'coin' || o.kind === 'shield' || o.kind === 'slow' || o.kind === 'heart';

/** reused per call (no per-frame allocation) */
const REST: VisibleObstacle[] = [];

/** v8 contract: the drones in lane `lane` and the pickups floating in that lane */
export function drawGadgets(ctx: Ctx, obs: readonly VisibleObstacle[], t: number, sprites: SpriteCache, lane: number): void {
  REST.length = 0;
  for (const o of obs) {
    if (o.kind === 'drone') {
      const img = propImage(o);
      if (img) droneProp(ctx, img, o, lane, t);
      else REST.push(o);
    } else if (isPickup(o)) {
      if ((o.lanes?.[0] ?? 1) !== lane || !pickupProp(ctx, o, lane, t)) REST.push(o);
    } else REST.push(o);
  }
  v8Gadgets(ctx, REST, t, sprites, lane);
}
