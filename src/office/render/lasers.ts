// Office build stand-in for src/render/lasers.ts (build/office-swaps.ts): full-width hazards (floor, ceiling,
// beam, high) are drawn as the superior's props at the v8 laser positions; anything without a loaded prop keeps
// the v8 laser. Warnings and contact points are the v8 ones.
import type { VisibleObstacle } from '../../types';
import {
  ARM_TIME, BEAM_H, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, HIGH_H, SPAN_D0, SPAN_D1, depthScale, fixedX,
  flyingX, projX, projY,
} from '../../render/layout';
import { drawLaserSeg as v8LaserSeg } from '../../render/lasers';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { drawProp, propImage } from './props';

export * from '../../render/lasers';

const LANES: readonly number[] = [0, 1, 2];
const FLOOR_PROP_H = 34;
const CEIL_PROP_H = 46;
const FLY_PROP_H = 28;
/** props in the agent's lane read first; the other lanes are dimmed like the v8 lasers */
const DIM = 0.4;

const isSheet = (o: VisibleObstacle) => !o.lanes && (o.kind === 'floor' || o.kind === 'ceiling' || o.kind === 'beam' || o.kind === 'high');

function emphasis(d: number, focus: number): number {
  return focus < 0 ? 1 : 1 - (1 - DIM) * Math.min(1, Math.abs(d - focus));
}

function fixedProp(ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number): void {
  const tu = o.timeUntil;
  const presence = Math.min(1, Math.max(0, (CHARGE_TIME + 0.9 - tu) / 0.3)) * Math.min(1, Math.max(0, 1 + tu / 0.25));
  if (presence <= 0.01) return;
  const x = projX(fixedX(tu), d);
  const s = depthScale(d);
  if (o.kind === 'floor') {
    drawProp(ctx, img, x, projY(d, 0), FLOOR_PROP_H * s, 1, false, a * presence);
    return;
  }
  // ceiling: the prop hangs on a line from the ceiling, its bottom where the v8 curtain ends
  const drop = tu <= ARM_TIME ? 1 : 0.35;
  const yEnd = projY(d, CEIL_LASER_END + (1 - drop) * 60);
  ctx.strokeStyle = 'rgba(40,40,60,0.7)';
  ctx.globalAlpha = a * presence;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, projY(d, CEIL_H));
  ctx.lineTo(x, yEnd - CEIL_PROP_H * s);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawProp(ctx, img, x, yEnd, CEIL_PROP_H * s, 1, false, a * presence);
}

function flyingProp(ctx: Ctx, v: View, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number): void {
  if (o.timeUntil > ENTER_TIME) return;
  const back = o.from === 'back';
  const x = projX(flyingX(back ? 'back' : 'front', o.timeUntil, v), d);
  const s = depthScale(d);
  const hs = o.kind === 'high' ? [HIGH_H] : BEAM_H.slice(0, Math.min(3, Math.max(1, o.level)));
  // the prop's leading edge is where the v8 beam head is
  const dx = (back ? -1 : 1) * FLY_PROP_H * 0.5 * s;
  for (const h of hs) drawProp(ctx, img, x + dx, projY(d, h), FLY_PROP_H * s, 0.5, back, a);
}

/** v8 drawLaserSeg contract: every full-width hazard in the depth segment [d0, d1) */
export function drawLaserSeg(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, sprites: SpriteCache, reduced: boolean,
  d0: number, d1: number, focus = -1,
): void {
  const a0 = Math.max(d0, SPAN_D0);
  const b0 = Math.min(d1, SPAN_D1);
  const fallback: VisibleObstacle[] = [];
  for (const o of obs) {
    const img = isSheet(o) ? propImage(o) : null;
    if (!img) {
      fallback.push(o);
      continue;
    }
    for (const d of LANES) {
      if (d < a0 || d >= b0) continue;
      const a = emphasis(d, focus);
      if (o.kind === 'floor' || o.kind === 'ceiling') fixedProp(ctx, img, o, d, a);
      else flyingProp(ctx, v, img, o, d, a);
    }
  }
  if (fallback.length > 0) v8LaserSeg(ctx, v, fallback, t, fever, sprites, reduced, d0, d1, focus);
}
