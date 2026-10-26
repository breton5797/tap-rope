// Full-width laser hazards spanning all three lanes (GDD-v6 §4): thin white-hot cores with red bloom
// and a faint haze scatter. Every laser is red; jump vs slide reads from WHERE it fires and HOW HIGH:
// floor emitters (and low flying beams) = jump over; ceiling emitters (and head-height beams) =
// slide under. Each lane also gets a side-view emitter housing + an amber height-guide tick at the
// beam's tip so the clearance is obvious where the agent runs. Sheets are drawn per depth segment
// [d0, d1) so the renderer can interleave them with the agent in painter's order.
import { WARN_LEAD, type LaserFrom, type VisibleObstacle } from '../types';
import {
  ARM_TIME, BEAM_H, BEAM_LEN, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, FLOOR_LASER_H, HIGH_H, SPAN_D0, SPAN_D1,
  depthScale, fixedX, flyingX, projX, projY,
} from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { clamp, type Ctx } from './util';
import type { View } from './view';

export const LASER_RED = '#FF2A3A';
export const WARN_AMBER = '#FFB020';
/** overdrive (fever) lasers burn amber-white; normal ones red */
const BOLT_COLORS: readonly string[] = [LASER_RED, WARN_AMBER];
const BOLT_KEYS = ['bolt0', 'bolt1'];
const LANE_CENTRES: readonly number[] = [0, 1, 2];
const HOUSING = '#2B3036';
const HOUSING_LIT = '#4E565F';

/** Beam streak fading from the white-hot head (x=0) to nothing at BEAM_LEN; drawn additively. */
function boltSprite(ctx: Ctx, idx: number): void {
  const c = BOLT_COLORS[idx];
  const g = ctx.createLinearGradient(0, 0, BEAM_LEN, 0);
  g.addColorStop(0, c);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(BEAM_LEN, 0);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 2.8;
  ctx.stroke();
  const w = ctx.createLinearGradient(0, 0, BEAM_LEN * 0.85, 0);
  w.addColorStop(0, 'rgba(255,255,255,1)');
  w.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = w;
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

function colorFor(fever: boolean): string {
  return fever ? WARN_AMBER : LASER_RED;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 97;
}

/** A laser segment: faint haze scatter, red bloom, coloured body, white-hot core (additive). */
export function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.globalAlpha = a * 0.05;
  ctx.lineWidth = 24;
  ctx.stroke();
  ctx.globalAlpha = a * 0.16;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.globalAlpha = a * 0.85;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = a;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

/** Heat-shimmer flicker of a live beam (constant under reduced motion). */
function flicker(t: number, seed: number): number {
  return 0.88 + 0.12 * Math.sin(t * 57 + seed * 13) * Math.sin(t * 31 + seed);
}

/** Status-light blink: hard 4Hz normally, a gentle pulse with reduced motion. */
function blinkLevel(t: number, hz: number, reduced: boolean): number {
  if (reduced) return 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
  return (t * hz) % 1 < 0.5 ? 1 : 0.3;
}

function depthLine(ctx: Ctx, x: number, a: number, b: number, h: number, color: string, alpha: number): void {
  beam(ctx, projX(x, a), projY(a, h), projX(x, b), projY(b, h), color, alpha);
}

interface Seg {
  a: number;
  b: number;
}

/** shared clipped segment (one drawLaserSeg call at a time) */
const SEG: Seg = { a: 0, b: 0 };

function clipSeg(d0: number, d1: number): Readonly<Seg> | null {
  SEG.a = Math.max(d0, SPAN_D0);
  SEG.b = Math.min(d1, SPAN_D1);
  return SEG.b - SEG.a > 1e-3 ? SEG : null;
}

/** Steel rail along the depth carrying the emitters (floor rail h=0, ceiling rail h=CEIL_H). */
function rail(ctx: Ctx, x: number, s: Readonly<Seg>, h: number): void {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#15181B';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(projX(x, s.a), projY(s.a, h));
  ctx.lineTo(projX(x, s.b), projY(s.b, h));
  ctx.stroke();
  ctx.strokeStyle = '#3C434B';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Emitter housing at lane d: a machined box with a lens slot that glows while charged. */
function housing(ctx: Ctx, x: number, d: number, floor: boolean, half: number, glow: number, color: string): void {
  const sc = depthScale(d);
  const cx = projX(x, d);
  const h = 4.6 * sc;
  const y = floor ? projY(d, 0) - h : projY(d, CEIL_H);
  ctx.fillStyle = HOUSING;
  ctx.fillRect(cx - half - 2 * sc, y, half * 2 + 4 * sc, h);
  ctx.fillStyle = HOUSING_LIT;
  ctx.fillRect(cx - half - 2 * sc, floor ? y : y + h - 1, half * 2 + 4 * sc, 1);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25 + 0.75 * glow;
  ctx.fillRect(cx - half, floor ? y - 0.6 : y + h - 0.4, half * 2, 1.2);
  ctx.globalAlpha = 1;
}

/** Amber height-guide tick: the clearance line at a laser's tip, inside lane d. */
function guide(ctx: Ctx, x: number, d: number, h: number, half: number, a: number): void {
  const cx = projX(x, d);
  const y = projY(d, h);
  ctx.strokeStyle = WARN_AMBER;
  ctx.globalAlpha = 0.75 * a;
  ctx.lineWidth = 1;
  ctx.setLineDash(DASH);
  ctx.beginPath();
  ctx.moveTo(cx - half - 5, y);
  ctx.lineTo(cx + half + 5, y);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 1;
}

const DASH = [3, 2];
const NO_DASH: number[] = [];

function fence(ctx: Ctx, o: VisibleObstacle, s: Readonly<Seg>, t: number, fever: boolean, reduced: boolean): void {
  const x = fixedX(o.timeUntil);
  const seed = seedOf(o.id);
  const floor = o.kind === 'floor';
  const color = colorFor(fever);
  const tu = o.timeUntil;
  const on = tu <= ARM_TIME && tu > -0.3;
  const charge = tu > ARM_TIME && tu <= CHARGE_TIME ? 1 - (tu - ARM_TIME) / (CHARGE_TIME - ARM_TIME) : on ? 1 : 0;
  const baseH = floor ? 0 : CEIL_H;
  rail(ctx, x, s, baseH);
  const glow = Math.max(charge, blinkLevel(t, 4, reduced) * 0.35);
  const grow = on ? clamp((ARM_TIME - tu) / 0.07, 0, 1) : 0;
  const a = (reduced ? 1 : flicker(t, seed)) * (tu < 0 ? clamp(1 + tu / 0.3, 0, 1) : 1);
  const tipH = floor ? FLOOR_LASER_H * grow : CEIL_H - (CEIL_H - CEIL_LASER_END) * grow;
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    const half = (floor ? 10 : 12) * depthScale(d);
    housing(ctx, x, d, floor, half, glow, color);
    if (!on) continue;
    const cx = projX(x, d);
    const y0 = projY(d, baseH);
    const y1 = projY(d, tipH);
    for (let j = 0; j < 4; j++) {
      const px = cx - half + (half * 2 * j) / 3;
      beam(ctx, px, y0, px, y1, color, a * 0.9);
    }
    if (grow >= 1) guide(ctx, x, d, floor ? FLOOR_LASER_H + 3 : CEIL_LASER_END - 3, half, a);
  }
  if (on) depthLine(ctx, x, s.a, s.b, tipH, color, a * 0.55);
}

function heightsOf(o: VisibleObstacle): readonly number[] {
  if (o.kind === 'high') return [HIGH_H];
  return BEAM_H.slice(0, o.level);
}

function flying(ctx: Ctx, v: View, o: VisibleObstacle, s: Readonly<Seg>, t: number, fever: boolean, sprites: SpriteCache, reduced: boolean): void {
  if (o.timeUntil > ENTER_TIME) return;
  const from: LaserFrom = o.from === 'back' ? 'back' : 'front';
  const head = flyingX(from, o.timeUntil, v);
  const dir = from === 'back' ? -1 : 1;
  const seed = seedOf(o.id);
  const a = reduced ? 1 : flicker(t, seed);
  const hs = heightsOf(o);
  const color = colorFor(fever);
  const ci = fever ? 1 : 0;
  const slide = o.kind === 'high';
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    const sc = depthScale(d);
    const hx = projX(head, d);
    // faint scan sheet in front of the beams: up to the ceiling for a head beam, down to the floor otherwise
    const top = projY(d, slide ? CEIL_H : hs[hs.length - 1]);
    const bot = projY(d, slide ? HIGH_H : 0);
    ctx.fillStyle = color;
    ctx.globalAlpha = a * 0.07;
    ctx.fillRect(Math.min(hx, hx + 26 * dir * sc), top, 26 * sc, bot - top);
    ctx.globalAlpha = 1;
    for (const h of hs) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      blitScaled(ctx, sprites.get(BOLT_KEYS[ci], BEAM_LEN + 10, 18, 5, 9, boltSprite, ci), hx, projY(d, h), sc * dir, sc);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    guide(ctx, head + 13 * dir, d, slide ? HIGH_H - 4 : hs[hs.length - 1] + 4, 9 * sc, a);
  }
  for (const h of hs) depthLine(ctx, head, s.a, s.b, h, color, a * 0.8);
}

/** All full-width laser sheets (not drones / pickups) inside the depth segment [d0, d1). */
export function drawLaserSeg(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, sprites: SpriteCache, reduced: boolean,
  d0: number, d1: number,
): void {
  const s = clipSeg(d0, d1);
  if (!s) return;
  for (const o of obs) {
    if (o.lanes) continue;
    if (o.kind === 'floor' || o.kind === 'ceiling') fence(ctx, o, s, t, fever, reduced);
    else if (o.kind === 'beam' || o.kind === 'high') flying(ctx, v, o, s, t, fever, sprites, reduced);
  }
}

/**
 * Pulsing chevrons on the screen edge where a flying beam will enter, at its heights in the
 * agent's lane. Sudden (rear) beams inside WARN_LEAD switch to the "!" warning instead.
 */
export function drawLaserWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, reduced: boolean, lane: number,
): void {
  for (const o of obs) {
    if ((o.kind !== 'beam' && o.kind !== 'high') || o.timeUntil <= ENTER_TIME) continue;
    if (o.sudden && o.timeUntil <= WARN_LEAD) continue;
    const back = o.from === 'back';
    const x = back ? v.x0 + 10 : v.x0 + v.w - 10;
    const pulse = reduced ? blinkLevel(t, 1, true) : (t * 5) % 1 < 0.55 ? 1 : 0.4;
    const urgency = clamp(1 - (o.timeUntil - ENTER_TIME) / 1.1, 0.35, 1);
    const sc = depthScale(lane);
    const d = back ? 1 : -1;
    ctx.strokeStyle = colorFor(fever);
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'miter';
    for (const h of heightsOf(o)) {
      const y = projY(lane, h);
      ctx.globalAlpha = pulse * urgency;
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const ox = x - d * k * 5;
        ctx.moveTo(ox - d * 3 * sc, y - 5 * sc);
        ctx.lineTo(ox + d * 3 * sc, y);
        ctx.lineTo(ox - d * 3 * sc, y + 5 * sc);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
