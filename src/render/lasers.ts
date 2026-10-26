// Full-width laser hazards spanning all three lanes (GDD-v6 §4): thin white-hot cores with red bloom.
// Every laser stays red (also in overdrive); jump vs slide reads from silhouette, as in a hurdle vs a
// limbo bar:
//   JUMP  (floor)   — per lane a pair of squat floor posts with ONE tripwire stretched between them at
//                     CLEAR_H; a status light per beam on each post. Nothing above the wire.
//   JUMP  (beam N)  — N short beams stacked at clearly separated heights per lane, each with a bright
//                     head and a short faint trail. Count the heads = taps needed.
//   SLIDE (ceiling) — per lane a chunky ceiling housing firing two beams DOWN that stop at
//                     CEIL_LASER_END on a receiver bar, leaving a dark gap above the floor marked by an
//                     amber ⌄ stencil.
//   SLIDE (high)    — one beam at head height with a faint "blocked above" haze and the same amber ⌄.
// Per-lane glyphs are narrow so that depth convergence fans the three lanes apart on approach; beams in
// the lanes away from the agent are dimmed (`focus`) so their copies never read as extra beams.
// Sheets are drawn per depth segment [d0, d1) so the renderer can interleave them with the agent.
import { PLAYER_X, WARN_LEAD, type LaserFrom, type VisibleObstacle } from '../types';
import {
  ARM_TIME, BEAM_H, CEIL_H, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, FLOOR_LASER_H, HIGH_H, SPAN_D0, SPAN_D1,
  depthScale, fixedX, flyingX, projX, projY,
} from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { clamp, type Ctx } from './util';
import type { View } from './view';

export const LASER_RED = '#FF2A3A';
export const WARN_AMBER = '#FFB020';
const LANE_CENTRES: readonly number[] = [0, 1, 2];
const STEEL_DARK = '#16191C';
const STEEL = '#2E343A';
const STEEL_LIT = '#5A636D';
/** half the x-span of a lane's emitter pair (world px) */
const POST_DX = 8;
/** trail behind a flying beam's head (px at depth 1) */
const TRAIL = 54;
/** solid lit length of a flying beam behind its head (px at depth 1) */
const BODY = 18;
const TRAIL_KEYS = ['lzTrailR', 'lzTrailL'];
/** beam alpha in the lanes away from the agent (fixed / flying) */
const DIM_FIXED = 0.4;
const DIM_FLYING = 0.3;

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 97;
}

/** A laser segment: faint haze scatter, red bloom, coloured body, crisp white-hot core (additive). */
export function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number): void {
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.globalAlpha = a * 0.07;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.globalAlpha = a * 0.22;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = a * 0.95;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = a;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = op;
}

/** Faint trail behind a flying beam (x = 0 is the head, extending +x); drawn additively. */
function trailSprite(ctx: Ctx, flip: number): void {
  const dir = flip ? -1 : 1;
  const g = ctx.createLinearGradient(0, 0, TRAIL * dir, 0);
  g.addColorStop(0, 'rgba(255,42,58,0.55)');
  g.addColorStop(1, 'rgba(255,42,58,0)');
  ctx.strokeStyle = g;
  ctx.lineCap = 'butt';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(TRAIL * dir, 0);
  ctx.stroke();
}

/** Glowing beam head / lens flare (anchor = centre). */
function flareSprite(ctx: Ctx): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,120,130,0.85)');
  g.addColorStop(1, 'rgba(255,42,58,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-7, -7, 14, 14);
}

/** Heat-shimmer flicker of a live beam (constant under reduced motion). */
function flicker(t: number, seed: number): number {
  return 0.9 + 0.1 * Math.sin(t * 57 + seed * 13) * Math.sin(t * 31 + seed);
}

/** Status-light blink: hard 4Hz normally, a gentle pulse with reduced motion. */
function blinkLevel(t: number, hz: number, reduced: boolean): number {
  if (reduced) return 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
  return (t * hz) % 1 < 0.5 ? 1 : 0.3;
}

/** Beam strength in lane d: full in the agent's lane, dimmed elsewhere (focus < 0 = no emphasis). */
function emphasis(d: number, focus: number, dim: number): number {
  if (focus < 0) return 1;
  return 1 - (1 - dim) * clamp(Math.abs(d - focus), 0, 1);
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

/** Steel track along the ceiling tying the lanes' housings together (h = CEIL_H). */
function rail(ctx: Ctx, x: number, s: Readonly<Seg>, h: number): void {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = STEEL_DARK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(projX(x, s.a), projY(s.a, h));
  ctx.lineTo(projX(x, s.b), projY(s.b, h));
  ctx.stroke();
  ctx.strokeStyle = '#3C434B';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A row of `n` status lights stacked upward from (x, y). */
function lights(ctx: Ctx, x: number, y: number, s: number, n: number, glow: number): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = '#0A0B0D';
    ctx.fillRect(x - 1.5 * s, y - (i * 3.2 + 2.6) * s, 3 * s, 2.6 * s);
    ctx.fillStyle = LASER_RED;
    ctx.globalAlpha = 0.35 + 0.65 * glow;
    ctx.fillRect(x - 0.9 * s, y - (i * 3.2 + 2) * s, 1.8 * s, 1.4 * s);
    ctx.globalAlpha = 1;
  }
}

/** Squat floor emitter post with its lens at height h, `n` status lights on its face. */
function floorPost(ctx: Ctx, x: number, d: number, h: number, n: number, glow: number): void {
  const s = depthScale(d);
  const fy = projY(d, 0);
  const top = projY(d, h + 5);
  ctx.fillStyle = STEEL_DARK;
  ctx.fillRect(x - 3.6 * s, fy - 1.6 * s, 7.2 * s, 2.2 * s); // foot plate
  ctx.fillStyle = STEEL;
  ctx.fillRect(x - 2.4 * s, top, 4.8 * s, fy - top);
  ctx.fillStyle = STEEL_LIT;
  ctx.fillRect(x - 2.4 * s, top, 1 * s, fy - top);
  ctx.fillRect(x - 3 * s, top - 1.4 * s, 6 * s, 1.6 * s); // cap
  // lens collar at the beam height
  const ly = projY(d, h);
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(x - 2.8 * s, ly - 1.8 * s, 5.6 * s, 3.6 * s);
  ctx.fillStyle = LASER_RED;
  ctx.globalAlpha = 0.3 + 0.7 * glow;
  ctx.fillRect(x - 1.2 * s, ly - 1 * s, 2.4 * s, 2 * s);
  ctx.globalAlpha = 1;
  lights(ctx, x, fy - 3 * s, s, n, glow);
}

/** Chunky ceiling housing over lane d with two downward lenses at x0 / x1. */
function ceilingHousing(ctx: Ctx, x0: number, x1: number, d: number, glow: number): number {
  const s = depthScale(d);
  const y = projY(d, CEIL_H);
  const w = x1 - x0 + 9 * s;
  const h = 8 * s;
  const left = (x0 + x1) / 2 - w / 2;
  ctx.fillStyle = STEEL_DARK;
  ctx.fillRect(left - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = STEEL;
  ctx.fillRect(left, y, w, h);
  ctx.fillStyle = STEEL_LIT;
  ctx.fillRect(left, y + h - 1.2 * s, w, 1.2 * s);
  // hazard stencil band
  ctx.fillStyle = '#9C7418';
  ctx.fillRect(left + 2 * s, y + 1.6 * s, w - 4 * s, 1.6 * s);
  nozzle(ctx, x0, y + h, s, glow);
  nozzle(ctx, x1, y + h, s, glow);
  return y + h + 3 * s;
}

/** Downward lens nozzle under a ceiling housing (top edge at y). */
function nozzle(ctx: Ctx, x: number, y: number, s: number, glow: number): void {
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(x - 2.4 * s, y, 4.8 * s, 3 * s);
  ctx.fillStyle = LASER_RED;
  ctx.globalAlpha = 0.3 + 0.7 * glow;
  ctx.fillRect(x - 1.2 * s, y + 2 * s, 2.4 * s, 1.2 * s);
  ctx.globalAlpha = 1;
}

/** Receiver cap the ceiling beams stop on (top edge at y). */
function receiver(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(x - 2.6 * s, y, 5.2 * s, 3.4 * s);
  ctx.fillStyle = STEEL_LIT;
  ctx.fillRect(x - 2.6 * s, y + 3.4 * s, 5.2 * s, 0.8 * s);
}

/** Amber slide stencil painted on lane d's floor: two flat ⌄ chevrons. */
function slideStencil(ctx: Ctx, x: number, d: number, a: number): void {
  if (a <= 0.01) return;
  const s = depthScale(d);
  const y = projY(d, 0) - 1.2 * s;
  ctx.strokeStyle = WARN_AMBER;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 0.85 * a;
  ctx.beginPath();
  for (let k = 0; k < 2; k++) {
    const cx = x + (k - 0.5) * 9 * s;
    ctx.moveTo(cx - 3.6 * s, y - 1.4 * s);
    ctx.lineTo(cx, y + 1.4 * s);
    ctx.lineTo(cx + 3.6 * s, y - 1.4 * s);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Floor tripwire (jump): posts + one wire sweeping on from the far post. */
function floorLane(ctx: Ctx, x: number, d: number, on: boolean, grow: number, glow: number, a: number): void {
  const xa = projX(x - POST_DX, d);
  const xb = projX(x + POST_DX, d);
  floorPost(ctx, xb, d, FLOOR_LASER_H, 1, glow);
  if (on) {
    const y = projY(d, FLOOR_LASER_H);
    beam(ctx, xb, y, xb + (xa - xb) * grow, y, LASER_RED, a);
  }
  floorPost(ctx, xa, d, FLOOR_LASER_H, 1, glow);
}

/**
 * Ceiling curtain (slide): housing, two beams down to the receivers, a bar joining them, the dark gap
 * below. Below screen y `cut` everything is drawn at `cutA` × alpha: a nearer lane's curtain hangs in
 * front of the agent's own gap on screen, so it fades out there as it reaches the agent.
 */
function ceilingLane(
  ctx: Ctx, x: number, d: number, on: boolean, grow: number, glow: number, a: number, stencil: number, cut: number, cutA: number,
): void {
  const s = depthScale(d);
  const xa = projX(x - POST_DX, d);
  const xb = projX(x + POST_DX, d);
  slideStencil(ctx, (xa + xb) / 2, d, stencil);
  const y0 = ceilingHousing(ctx, xa, xb, d, glow);
  if (!on) return;
  const yEnd = projY(d, CEIL_LASER_END);
  const y1 = y0 + (yEnd - y0) * grow;
  const ym = Math.max(y0, Math.min(y1, cut));
  const lo = a * cutA;
  // faint curtain between the two beams: "everything above the bar is live"
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = LASER_RED;
  ctx.globalAlpha = 0.09 * a * a;
  ctx.fillRect(xa, y0, xb - xa, ym - y0);
  ctx.globalAlpha = 0.09 * lo * lo;
  ctx.fillRect(xa, ym, xb - xa, y1 - ym);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  beam(ctx, xa, y0, xa, ym, LASER_RED, a * 0.8);
  beam(ctx, xb, y0, xb, ym, LASER_RED, a * 0.8);
  if (y1 > ym && lo > 0.01) {
    beam(ctx, xa, ym, xa, y1, LASER_RED, lo * 0.8);
    beam(ctx, xb, ym, xb, y1, LASER_RED, lo * 0.8);
  }
  if (grow < 1) return;
  const ba = yEnd > cut ? lo : a;
  if (ba <= 0.01) return;
  beam(ctx, xa, yEnd, xb, yEnd, LASER_RED, ba);
  ctx.globalAlpha = Math.min(1, ba * 1.4);
  receiver(ctx, xa, yEnd, s);
  receiver(ctx, xb, yEnd, s);
  ctx.globalAlpha = 1;
}

function fence(ctx: Ctx, o: VisibleObstacle, s: Readonly<Seg>, t: number, reduced: boolean, focus: number): void {
  const x = fixedX(o.timeUntil);
  const floor = o.kind === 'floor';
  const tu = o.timeUntil;
  const on = tu <= ARM_TIME && tu > -0.3;
  const charge = tu > ARM_TIME && tu <= CHARGE_TIME ? 1 - (tu - ARM_TIME) / (CHARGE_TIME - ARM_TIME) : on ? 1 : 0;
  if (!floor) rail(ctx, x, s, CEIL_H);
  const glow = Math.max(charge, blinkLevel(t, 4, reduced) * 0.35);
  const grow = on ? clamp((ARM_TIME - tu) / 0.08, 0, 1) : 0;
  const a = (reduced ? 1 : flicker(t, seedOf(o.id))) * (tu < 0 ? clamp(1 + tu / 0.3, 0, 1) : 1);
  // the floor stencil fades before the agent reaches it (it would paint over a sliding agent)
  const stencil = clamp((CHARGE_TIME + 0.4 - tu) / 0.4, 0, 1) * clamp((tu - 0.06) / 0.2, 0, 1);
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    const la = a * emphasis(d, focus, DIM_FIXED);
    if (floor) {
      floorLane(ctx, x, d, on, grow, glow, la);
      continue;
    }
    // a lane nearer than the agent: its curtain crosses the agent's gap on screen near arrival
    const near = focus >= 0 && d > focus + 0.01;
    const cut = near ? projY(focus, CEIL_LASER_END) - 2 : Infinity;
    const cutA = near ? clamp((Math.abs(projX(x, d) - PLAYER_X) - 12) / 40, 0, 1) : 1;
    ceilingLane(ctx, x, d, on, grow, glow, la, stencil, cut, cutA);
  }
}

function heightsOf(o: VisibleObstacle): readonly number[] {
  if (o.kind === 'high') return HIGH_ONLY;
  return BEAM_LEVELS[Math.min(3, Math.max(1, o.level)) - 1];
}

const HIGH_ONLY: readonly number[] = [HIGH_H];
const BEAM_LEVELS: readonly (readonly number[])[] = [BEAM_H.slice(0, 1), BEAM_H.slice(0, 2), BEAM_H.slice(0, 3)];

function flying(ctx: Ctx, v: View, o: VisibleObstacle, s: Readonly<Seg>, t: number, sprites: SpriteCache, reduced: boolean, focus: number): void {
  if (o.timeUntil > ENTER_TIME) return;
  const from: LaserFrom = o.from === 'back' ? 'back' : 'front';
  const head = flyingX(from, o.timeUntil, v);
  const dir = from === 'back' ? -1 : 1; // trail side
  const a = reduced ? 1 : flicker(t, seedOf(o.id));
  const hs = heightsOf(o);
  const slide = o.kind === 'high';
  const trail = sprites.get(TRAIL_KEYS[dir > 0 ? 0 : 1], TRAIL * 2 + 4, 6, TRAIL + 2, 3, trailSprite, dir > 0 ? 0 : 1);
  const flare = sprites.get('lzFlare', 14, 14, 7, 7, flareSprite);
  for (const d of LANE_CENTRES) {
    if (d < s.a || d >= s.b) continue;
    const sc = depthScale(d);
    const hx = projX(head, d);
    const la = a * emphasis(d, focus, DIM_FLYING);
    if (slide) {
      // "blocked above" haze over the head beam, nothing below it
      const yb = projY(d, HIGH_H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = LASER_RED;
      ctx.globalAlpha = 0.06 * la;
      ctx.fillRect(Math.min(hx, hx + BODY * dir * sc), yb - 26 * sc, BODY * sc, 26 * sc);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      slideStencil(ctx, hx + 6 * dir * sc, d, la * clamp((o.timeUntil - 0.06) / 0.2, 0, 1));
    }
    for (const h of hs) {
      const y = projY(d, h);
      beam(ctx, hx, y, hx + BODY * dir * sc, y, LASER_RED, la);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = la;
      blitScaled(ctx, trail, hx + BODY * dir * sc, y, sc, sc);
      blitScaled(ctx, flare, hx, y, sc, sc);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

/**
 * All full-width laser sheets (not drones / pickups) inside the depth segment [d0, d1).
 * `focus` = the agent's (visual) lane: beams in the other lanes are dimmed so the agent's lane
 * reads first; omit (or < 0) for equal lanes. Lasers stay red in overdrive (`_fever` is unused).
 */
export function drawLaserSeg(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, _fever: boolean, sprites: SpriteCache, reduced: boolean,
  d0: number, d1: number, focus = -1,
): void {
  const s = clipSeg(d0, d1);
  if (!s) return;
  for (const o of obs) {
    if (o.lanes) continue;
    if (o.kind === 'floor' || o.kind === 'ceiling') fence(ctx, o, s, t, reduced, focus);
    else if (o.kind === 'beam' || o.kind === 'high') flying(ctx, v, o, s, t, sprites, reduced, focus);
  }
}

/**
 * Pulsing chevrons on the screen edge where a flying beam will enter, at its heights in the
 * agent's lane. Sudden (rear) beams inside WARN_LEAD switch to the "!" warning instead.
 */
export function drawLaserWarnings(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, _fever: boolean, reduced: boolean, lane: number,
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
    ctx.strokeStyle = LASER_RED;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'miter';
    for (const h of heightsOf(o)) {
      const y = projY(lane, h);
      ctx.globalAlpha = pulse * urgency;
      ctx.beginPath();
      ctx.moveTo(x - d * 3 * sc, y - 5 * sc);
      ctx.lineTo(x + d * 3 * sc, y);
      ctx.lineTo(x - d * 3 * sc, y + 5 * sc);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
