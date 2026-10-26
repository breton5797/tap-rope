// Full-width laser hazards as "sheets" spanning all three lanes. Colour carries meaning:
// RED = jump over it (a low glowing wall from the floor up), CYAN = slide under it (a curtain
// hanging from the ceiling with a gap at the bottom). floor / ceiling emitters are world-fixed
// rails that charge then fire; front / back beams fly in from the screen edges after a blinking
// edge warning. Sheets are drawn per depth segment [d0, d1) so the renderer can interleave them
// with the agent in painter's order.
import { WARN_LEAD, type LaserFrom, type VisibleObstacle } from '../types';
import {
  ARM_TIME, BEAM_H, BEAM_LEN, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, FLOOR_LASER_H, HIGH_H, SPAN_D0, SPAN_D1,
  depthScale, fixedX, flyingX, projX, projY,
} from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, clamp, type Ctx } from './util';
import type { View } from './view';

export const JUMP_RED = '#FF3358';
export const SLIDE_CYAN = '#2EE6FF';
const HUES: string[] = [];
for (let i = 0; i < 36; i++) HUES.push(`hsl(${i * 10},100%,62%)`);
/** bolt sprite colours: 0 red, 1 cyan, 2.. 12 fever hues (every 3rd of HUES, keeps the sprite cache small) */
const BOLT_COLORS: readonly string[] = [JUMP_RED, SLIDE_CYAN, ...HUES.filter((_, i) => i % 3 === 0)];
const BOLT_KEYS = BOLT_COLORS.map((_, i) => `bolt${i}`);
/** emitter posts along the depth of a sheet */
const POSTS: readonly number[] = [-0.38, -0.02, 0.34, 0.7, 1.06, 1.42, 1.78, 2.14, 2.4];
const LANE_CENTRES: readonly number[] = [0, 1, 2];

/** Beam body fading from the bright head (x=0) to nothing at BEAM_LEN. */
function boltSprite(ctx: Ctx, idx: number): void {
  const c = BOLT_COLORS[idx];
  const g = ctx.createLinearGradient(0, 0, BEAM_LEN, 0);
  g.addColorStop(0, c);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(BEAM_LEN, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 5.6;
  ctx.stroke();
  const w = ctx.createLinearGradient(0, 0, BEAM_LEN * 0.8, 0);
  w.addColorStop(0, 'rgba(255,255,255,0.95)');
  w.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = w;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function isSlide(o: VisibleObstacle): boolean {
  return o.kind === 'high' || o.kind === 'ceiling';
}

function colorIndex(o: VisibleObstacle, fever: boolean, t: number, k: number): number {
  if (fever) return 2 + ((Math.floor(t * 10) + k * 2) % 12);
  return isSlide(o) ? 1 : 0;
}

function colorFor(o: VisibleObstacle, fever: boolean, t: number, k: number): string {
  if (fever) return HUES[(Math.floor(t * 30) + k * 5) % 36];
  return isSlide(o) ? SLIDE_CYAN : JUMP_RED;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 97;
}

/** Glowing laser segment: wide halo, coloured body, white-hot core. */
export function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number): void {
  ctx.lineCap = 'round';
  ctx.globalAlpha = a * 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.lineWidth = 4.6;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = a * 0.95;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function flicker(t: number, seed: number): number {
  return 0.86 + 0.14 * Math.sin(t * 57 + seed * 13) * Math.sin(t * 31 + seed);
}

/** Blink for status lights: hard 4Hz normally, a gentle 1Hz pulse with reduced motion. */
function blinkLevel(t: number, hz: number, reduced: boolean): number {
  if (reduced) return 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
  return (t * hz) % 1 < 0.5 ? 1 : 0.3;
}

/**
 * Side-view slab at lane depth d between middle-lane x0..x1 and heights h0..h1. A plane spanning
 * the depth is seen almost edge-on from this camera, so every sheet also gets one of these per
 * lane: it gives the hazard a readable shape right where the agent runs (hurdle vs curtain).
 */
function laneBox(ctx: Ctx, x0: number, x1: number, d: number, h0: number, h1: number): void {
  const ax = projX(x0, d);
  const bx = projX(x1, d);
  const top = projY(d, h1);
  ctx.beginPath();
  ctx.rect(Math.min(ax, bx), top, Math.abs(bx - ax), projY(d, h0) - top);
}

function depthLine(ctx: Ctx, x: number, a: number, b: number, h: number, color: string, alpha: number): void {
  beam(ctx, projX(x, a), projY(a, h), projX(x, b), projY(b, h), color, alpha);
}

interface Seg {
  readonly a: number;
  readonly b: number;
}

function clipSeg(d0: number, d1: number): Seg | null {
  const a = Math.max(d0, SPAN_D0);
  const b = Math.min(d1, SPAN_D1);
  return b - a > 1e-3 ? { a, b } : null;
}

/** Emitter rail along the depth at height h (floor rail h=0, ceiling rail h=CEIL_H). */
function rail(ctx: Ctx, x: number, s: Seg, h: number, lens: string, glow: number): void {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#2A2F3E';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(projX(x, s.a), projY(s.a, h));
  ctx.lineTo(projX(x, s.b), projY(s.b, h));
  ctx.stroke();
  ctx.strokeStyle = '#5A6278';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = lens;
  ctx.globalAlpha = 0.35 + glow * 0.65;
  for (const d of POSTS) {
    if (d < s.a || d >= s.b) continue;
    circle(ctx, projX(x, d), projY(d, h), 2.4 * depthScale(d));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function fence(ctx: Ctx, o: VisibleObstacle, s: Seg, t: number, fever: boolean, reduced: boolean): void {
  const x = fixedX(o.timeUntil);
  const seed = seedOf(o.id);
  const floor = o.kind === 'floor';
  const color = colorFor(o, fever, t, 0);
  const tu = o.timeUntil;
  const on = tu <= ARM_TIME && tu > -0.3;
  const charge = tu > ARM_TIME && tu <= CHARGE_TIME ? 1 - (tu - ARM_TIME) / (CHARGE_TIME - ARM_TIME) : on ? 1 : 0;
  const baseH = floor ? 0 : CEIL_H;
  rail(ctx, x, s, baseH, color, Math.max(charge, blinkLevel(t, 4, reduced) * 0.4));
  if (!on) return;
  const grow = clamp((ARM_TIME - tu) / 0.07, 0, 1);
  const a = (reduced ? 1 : flicker(t, seed)) * (tu < 0 ? clamp(1 + tu / 0.3, 0, 1) : 1);
  const tipH = floor ? FLOOR_LASER_H * grow : CEIL_H - (CEIL_H - CEIL_LASER_END) * grow;
  if (floor) {
    // glow pool on the floor along the emitter rail
    ctx.globalAlpha = a * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(projX(x, s.a), projY(s.a, 0) + 2);
    ctx.lineTo(projX(x, s.b), projY(s.b, 0) + 2);
    ctx.stroke();
  }
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    // per lane: a glowing hurdle (floor) / a hanging curtain with a gap below (ceiling)
    const half = (floor ? 11 : 13) * depthScale(d);
    laneBox(ctx, x - half, x + half, d, baseH, tipH);
    ctx.globalAlpha = a * (floor ? 0.38 : 0.2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    for (const px of [projX(x, d) - half, projX(x, d), projX(x, d) + half]) {
      beam(ctx, px, projY(d, baseH), px, projY(d, tipH), color, a * (floor ? 0.95 : 0.7));
    }
    beam(ctx, projX(x, d) - half, projY(d, tipH), projX(x, d) + half, projY(d, tipH), color, a);
  }
  depthLine(ctx, x, s.a, s.b, tipH, color, a);
}

function heightsOf(o: VisibleObstacle): readonly number[] {
  if (o.kind === 'high') return [HIGH_H];
  return BEAM_H.slice(0, o.level);
}

function flying(ctx: Ctx, v: View, o: VisibleObstacle, s: Seg, t: number, fever: boolean, sprites: SpriteCache, reduced: boolean): void {
  if (o.timeUntil > ENTER_TIME) return;
  const from: LaserFrom = o.from === 'back' ? 'back' : 'front';
  const head = flyingX(from, o.timeUntil, v);
  const dir = from === 'back' ? -1 : 1;
  const seed = seedOf(o.id);
  const a = reduced ? 1 : flicker(t, seed);
  const hs = heightsOf(o);
  const color0 = colorFor(o, fever, t, 0);
  // per lane: low beams = a glowing wall from the floor up to the top beam (jump it);
  // a head beam = a grid curtain from the beam up to the ceiling (slide under it)
  const slide = o.kind === 'high';
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    const len = (slide ? 44 : 22) * dir;
    const h0 = slide ? HIGH_H : 0;
    const h1 = slide ? CEIL_H : hs[hs.length - 1];
    laneBox(ctx, head, head + len, d, h0, h1);
    ctx.globalAlpha = a * (slide ? 0.22 : 0.2);
    ctx.fillStyle = color0;
    ctx.fill();
    ctx.globalAlpha = a * 0.6;
    ctx.strokeStyle = color0;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const hx = projX(head, d);
    const step = (projX(head + len, d) - hx) / (slide ? 4 : 2);
    for (let i = 0; i <= (slide ? 4 : 2); i++) {
      ctx.moveTo(hx + step * i, projY(d, h0));
      ctx.lineTo(hx + step * i, projY(d, h1));
    }
    if (slide) {
      for (let h = HIGH_H + 32; h < CEIL_H; h += 32) {
        ctx.moveTo(hx, projY(d, h));
        ctx.lineTo(hx + step * 4, projY(d, h));
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  hs.forEach((h, k) => {
    const ci = colorIndex(o, fever, t, k);
    // bolts streaking along each lane centre inside this segment
    for (const d of LANE_CENTRES) {
      if (d < s.a || d >= s.b) continue;
      const sc = depthScale(d);
      ctx.globalAlpha = a * 0.9;
      blitScaled(ctx, sprites.get(BOLT_KEYS[ci], BEAM_LEN + 10, 18, 5, 9, boltSprite, ci), projX(head, d), projY(d, h), sc * dir, sc);
    }
    ctx.globalAlpha = 1;
    depthLine(ctx, head, s.a, s.b, h, colorFor(o, fever, t, k), a);
  });
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
 * Blinking arrows on the screen edge where a flying beam will enter, at its heights in the
 * agent's lane. Sudden (rear) beams inside WARN_LEAD switch to the "!" warning instead.
 */
export function drawLaserWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, reduced: boolean, lane: number,
): void {
  for (const o of obs) {
    if ((o.kind !== 'beam' && o.kind !== 'high') || o.timeUntil <= ENTER_TIME) continue;
    if (o.sudden && o.timeUntil <= WARN_LEAD) continue;
    const back = o.from === 'back';
    const x = back ? v.x0 + 12 : v.x0 + v.w - 12;
    const pulse = reduced ? blinkLevel(t, 1, true) : (t * 6) % 1 < 0.55 ? 1 : 0.35;
    const urgency = clamp(1 - (o.timeUntil - ENTER_TIME) / 1.1, 0.3, 1);
    const sc = depthScale(lane);
    if (o.kind === 'high') {
      ctx.globalAlpha = 0.18 * pulse * urgency;
      ctx.fillStyle = SLIDE_CYAN;
      const top = projY(lane, CEIL_H);
      ctx.fillRect(back ? v.x0 : x - 2, top, 14, projY(lane, HIGH_H) - top);
    }
    heightsOf(o).forEach((h, k) => {
      const y = projY(lane, h);
      ctx.globalAlpha = pulse * urgency;
      ctx.fillStyle = colorFor(o, fever, t, k);
      ctx.beginPath();
      const d = back ? 1 : -1;
      ctx.moveTo(x + d * 10 * sc, y);
      ctx.lineTo(x - d * 4 * sc, y - 8 * sc);
      ctx.lineTo(x - d * 4 * sc, y + 8 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha *= 0.35;
      ctx.fillRect(back ? v.x0 : x + 4, y - 9, 8, 18);
    });
  }
  ctx.globalAlpha = 1;
}
