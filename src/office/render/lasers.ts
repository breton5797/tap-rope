// Office build stand-in for src/render/lasers.ts (build/office-swaps.ts): full-width hazards (floor, ceiling,
// beam, high) are drawn as the superior's props at the v8 laser positions; anything without a loaded prop keeps
// the v8 laser. Warnings and contact points are the v8 ones. v2 feel pack: front props leave the boss's hand
// (F5, boss-throw.ts), flying props are centred on the beam head (F2), every prop has idle motion (F6).
import type { VisibleObstacle } from '../../types';
import { SCROLL_SPEED } from '../../types';
import {
  ARM_TIME, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, SPAN_D0, SPAN_D1, beamSpeed, depthScale, fixedX, projX, projY,
} from '../../render/layout';
import { drawLaserSeg as v8LaserSeg } from '../../render/lasers';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { joinTime, throwArc, throwHand, throwStep } from './boss-throw';
import {
  PROP_SIZE, beatIdOf, drawFootprint, drawProp, flyingPropCenter, flyingSpan, propIdFor, propImage, propMotion,
} from './props';

export * from '../../render/lasers';

/** the superiors' aim / throw lines (boss.ts imports these): a comic orange, not a red laser */
export const LASER_RED = '#FF9F1C';

/** a comic "swoosh" throw line (boss.ts launch tracers): dark outline, coloured stroke, white core */
export function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number, w = 1): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.globalAlpha = a * 0.6;
  ctx.strokeStyle = '#1E2238';
  ctx.lineWidth = 5 * w;
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * w;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1 * w;
  ctx.stroke();
  ctx.restore();
}

const LANES: readonly number[] = [0, 1, 2];
/** props in the agent's lane read first; the other lanes dim only a little (distant hazards stay readable) */
const DIM = 0.75;

const isSheet = (o: VisibleObstacle) => !o.lanes && (o.kind === 'floor' || o.kind === 'ceiling' || o.kind === 'beam' || o.kind === 'high');

function emphasis(d: number, focus: number): number {
  return focus < 0 ? 1 : 1 - (1 - DIM) * Math.min(1, Math.abs(d - focus));
}

/** F6: the prop's idle motion phase for this obstacle and lane */
const phase = (o: VisibleObstacle, d: number, t: number): number => t + beatIdOf(o) * 0.61 + d * 0.23;

const LAND = { x: 0, y: 0 };

/** ceiling: the prop hangs where the v8 curtain ends (a little higher until it arms) */
const hangY = (d: number, tu: number): number => projY(d, CEIL_LASER_END + (tu <= ARM_TIME ? 0 : 39));

/** the prop in flight from the boss's hand (F5): footprint fading in where it will land */
function thrown(
  ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number, step: number, landX: number, landY: number,
  h: number, ay: number, flip: boolean, t: number,
): void {
  drawFootprint(ctx, o.kind, landX, projY(d, 0), h, a * step);
  LAND.x = landX;
  LAND.y = landY;
  const p = throwArc(throwHand(), LAND, step);
  drawProp(ctx, img, p.x, p.y, h, ay, flip, a, propMotion(propIdFor(o), phase(o, d, t) * 2));
}

function fixedProp(ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number, t: number): void {
  const tu = o.timeUntil;
  const s = depthScale(d);
  const floor = o.kind === 'floor';
  const size = (floor ? PROP_SIZE.floor : PROP_SIZE.ceiling) * s;
  const join = joinTime(SCROLL_SPEED);
  const step = throwStep(o.kind, o.from, tu, join);
  if (step === -1) return;
  if (step !== null) {
    thrown(ctx, img, o, d, a, step, projX(fixedX(join), d), floor ? projY(d, 0) : hangY(d, join), size, 1, false, t);
    return;
  }
  const presence = Math.min(1, Math.max(0, (CHARGE_TIME + 0.9 - tu) / 0.3)) * Math.min(1, Math.max(0, 1 + tu / 0.25));
  if (presence <= 0.01) return;
  const x = projX(fixedX(tu), d);
  const m = propMotion(propIdFor(o), phase(o, d, t));
  drawFootprint(ctx, o.kind, x, projY(d, 0), size, a * presence);
  if (floor) {
    drawProp(ctx, img, x, projY(d, 0), size, 1, false, a * presence, m);
    return;
  }
  const yEnd = hangY(d, tu);
  ctx.strokeStyle = 'rgba(40,40,60,0.7)';
  ctx.globalAlpha = a * presence;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, projY(d, CEIL_H));
  ctx.lineTo(x, yEnd - size);
  ctx.stroke();
  ctx.globalAlpha = 1;
  drawProp(ctx, img, x, yEnd, size, 1, false, a * presence, m);
}

function flyingProp(ctx: Ctx, v: View, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number, t: number): void {
  const back = o.from === 'back';
  const { bottom, h } = flyingSpan(o);
  const size = h * depthScale(d);
  const join = joinTime(beamSpeed('front', v));
  const step = throwStep(o.kind, o.from, o.timeUntil, join);
  if (step === -1) return;
  if (step !== null) {
    thrown(ctx, img, o, d, a, step, projX(flyingPropCenter('front', join, v), d), projY(d, bottom), size, 1, false, t);
    return;
  }
  if (o.timeUntil > ENTER_TIME) return;
  // F2: centred on the beam head, so the prop covers the hero exactly at judge time
  const x = projX(flyingPropCenter(back ? 'back' : 'front', o.timeUntil, v), d);
  drawFootprint(ctx, o.kind, x, projY(d, 0), size, a);
  drawProp(ctx, img, x, projY(d, bottom), size, 1, back, a, propMotion(propIdFor(o), phase(o, d, t)));
}

/** reused per call (no per-frame allocation) */
const FALLBACK: VisibleObstacle[] = [];

/** v8 drawLaserSeg contract: every full-width hazard in the depth segment [d0, d1) */
export function drawLaserSeg(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, sprites: SpriteCache, reduced: boolean,
  d0: number, d1: number, focus = -1,
): void {
  const a0 = Math.max(d0, SPAN_D0);
  const b0 = Math.min(d1, SPAN_D1);
  FALLBACK.length = 0;
  for (const o of obs) {
    const img = isSheet(o) ? propImage(o) : null;
    if (!img) {
      FALLBACK.push(o);
      continue;
    }
    for (const d of LANES) {
      if (d < a0 || d >= b0) continue;
      const a = emphasis(d, focus);
      if (o.kind === 'floor' || o.kind === 'ceiling') fixedProp(ctx, img, o, d, a, t);
      else flyingProp(ctx, v, img, o, d, a, t);
    }
  }
  if (FALLBACK.length > 0) v8LaserSeg(ctx, v, FALLBACK, t, fever, sprites, reduced, d0, d1, focus);
}
