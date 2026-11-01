// Office build stand-in for src/render/lasers.ts (build/office-swaps.ts): full-width hazards (floor, ceiling,
// beam, high) are drawn as the superior's props at the v8 laser positions; anything without a loaded prop keeps
// the v8 laser. Warnings and contact points are the v8 ones. v2 feel pack: front props leave the boss's hand
// (F5, boss-throw.ts), flying props are centred on the beam head (F2), every prop has idle motion (F6).
import type { VisibleObstacle } from '../../types';
import { SCROLL_SPEED } from '../../types';
import {
  ARM_TIME, BEAM_H, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, HIGH_H, SPAN_D0, SPAN_D1, beamSpeed, depthScale, fixedX, projX, projY,
} from '../../render/layout';
import { drawLaserSeg as v8LaserSeg } from '../../render/lasers';
import type { SpriteCache } from '../../render/sprites';
import type { Ctx } from '../../render/util';
import type { View } from '../../render/view';
import { heldFade, joinTime, throwActive, throwArc, throwHand, throwStep } from './boss-throw';
import { pointerBeam } from './readability';
import {
  PROP_SIZE, actionCue, beatIdOf, drawFootprint, drawProp, drawStack, flyingPropCenter, flyingSpan, laneSizeK, propIdFor, propImage,
  heldLane, propMotion, stackItems, type StackItem,
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
  a *= heldFade(o.kind, o.timeUntil);
  drawFootprint(ctx, o.kind, landX, projY(d, 0), h, a * step);
  LAND.x = landX;
  LAND.y = landY;
  const p = throwArc(throwHand(), LAND, step);
  // a ceiling prop catches its hang-line as it comes down onto its path
  if (o.kind === 'ceiling' && step > 0.5) hangLine(ctx, p.x, projY(d, CEIL_H), p.y - h, depthScale(d), a * (step - 0.5) * 2);
  drawProp(ctx, img, p.x, p.y, h, ay, flip, a, propMotion(propIdFor(o), phase(o, d, t) * 2), actionCue(o.kind));
}

function fixedProp(ctx: Ctx, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number, t: number): void {
  const tu = o.timeUntil;
  const s = depthScale(d);
  const floor = o.kind === 'floor';
  const size = (floor ? PROP_SIZE.floor : PROP_SIZE.ceiling) * s * laneSizeK(d);
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
  drawFootprint(ctx, o.kind, x, projY(d, 0), size, a * presence, 0, floor ? 1 : 0);
  if (pointerAt(ctx, o, x, projY(d, floor ? BEAM_H[0] : HIGH_H), s, a * presence)) return;
  if (floor) {
    drawProp(ctx, img, x, projY(d, 0), size, 1, false, a * presence, m, 'jump');
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
  drawProp(ctx, img, x, yEnd, size, 1, false, a * presence, m, 'slide');
}

function flyingProp(ctx: Ctx, v: View, img: HTMLImageElement, o: VisibleObstacle, d: number, a: number, t: number): void {
  const back = o.from === 'back';
  const { bottom, h } = flyingSpan(o);
  const k = depthScale(d) * laneSizeK(d);
  const size = h * k;
  const stack = o.kind === 'beam' ? stackItems(o.level) : NO_STACK;
  const join = joinTime(beamSpeed('front', v));
  const step = throwStep(o.kind, o.from, o.timeUntil, join);
  if (step === -1) return;
  const m = propMotion(propIdFor(o), phase(o, d, t) * (step === null ? 1 : 2));
  let x: number;
  let floorY: number;
  // held / in flight: only the hero's lane bundle (three lanes' bundles from one hand read as one tall column)
  if (step !== null && stack.length > 0 && d !== heldLane()) return;
  if (step !== null) {
    a *= heldFade(o.kind, o.timeUntil);
    // in flight from the hand: the bundle's bottom follows the arc to its join point
    const landX = projX(flyingPropCenter('front', join, v), d);
    drawFootprint(ctx, o.kind, landX, projY(d, 0), size, a * step);
    LAND.x = landX;
    LAND.y = projY(d, 0);
    const p = throwArc(throwHand(), LAND, step);
    x = p.x;
    floorY = p.y;
  } else {
    if (o.timeUntil > ENTER_TIME) return;
    // F2: centred on the beam head, so the prop covers the hero exactly at judge time
    x = projX(flyingPropCenter(back ? 'back' : 'front', o.timeUntil, v), d);
    floorY = projY(d, 0);
    drawFootprint(ctx, o.kind, x, floorY, size, a, 0, o.kind === 'beam' ? o.level : 0);
    const target = o.kind === 'high' ? HIGH_H : BEAM_H[Math.min(3, Math.max(1, o.level)) - 1];
    if (pointerAt(ctx, o, x, projY(d, target), depthScale(d), a)) return;
  }
  // head-height props hang from the ceiling (a slide, not a jump) — from mid-flight on
  if (o.kind === 'high' && (step === null || step > 0.5)) {
    const top = floorY - (bottom + h) * depthScale(d);
    hangLine(ctx, x, projY(d, CEIL_H), top, depthScale(d), a * (step === null ? 1 : (step - 0.5) * 2));
  }
  if (step !== null && propIdFor(o) === 'pointer') return; // the pointer is a beam, never thrown
  const depth = depthScale(d);
  // a bundle is drawn opaque in every lane (dimmed copies read as one washed-out smear)
  const cue = actionCue(o.kind);
  if (stack.length > 0) drawStack(ctx, img, stack, x, floorY, depth, k, back, 1, m, cue);
  else drawProp(ctx, img, x, floorY - bottom * depth, size, 1, back, a, m, cue);
}

const NO_STACK: readonly StackItem[] = [];

/** the laser pointer drawn as a beam from the boss's hand to `y` (head / knee / ankle); false for other props */
function pointerAt(ctx: Ctx, o: VisibleObstacle, x: number, y: number, s: number, a: number): boolean {
  if (propIdFor(o) !== 'pointer') return false;
  if (!throwActive()) return true;
  const hand = throwHand();
  pointerBeam(ctx, hand.x, hand.y, x, y, s, a);
  return true;
}

function hangLine(ctx: Ctx, x: number, y0: number, y1: number, s: number, a: number): void {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = 'rgba(40,40,60,0.7)';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  ctx.restore();
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
