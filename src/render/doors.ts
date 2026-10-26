// Section doors (GDD-v5 §6): a security door frame scrolls in spanning all lanes, its panels slide
// open (far panel into the wall, near panel out toward the camera) during timeUntil 1.0 → 0.3,
// and when the agent passes the doorway (timeUntil ≤ 0) the corridor background runs a 0.6s
// transition from door.from to door.to: turn = horizontal push, stairs = vertical push upward,
// elevator = doors close, shake, open. Reduced motion = a quick crossfade.
import type { DoorView, Scene } from '../types';
import type { Corridor } from './corridor';
import { CEIL_H, fixedX, projX, projY, SPAN_D0, WALL_DEPTH } from './layout';
import { clamp, roundRect, vGrad, type Ctx } from './util';
import type { View } from './view';

export const TRANSITION_TIME = 0.6;
/** start pre-baking the next scene this long before the door (one tile per frame) */
const PREWARM_LEAD = 1.6;
const DOOR_H = 150;
const NEAR_D = 2.6;
const POST_W = 12;

export interface ActiveTransition {
  readonly door: DoorView;
  /** 0..1 progress of the transition */
  readonly p: number;
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

export function activeTransition(doors: readonly DoorView[]): ActiveTransition | null {
  for (const d of doors) {
    if (d.timeUntil <= 0 && d.timeUntil > -TRANSITION_TIME) return { door: d, p: clamp(-d.timeUntil / TRANSITION_TIME, 0, 1) };
  }
  return null;
}

/** Scenes the corridor must hold this frame: current first, then (at most) one door scene. */
export function wantedScenes(cur: Scene, doors: readonly DoorView[]): Scene[] {
  const tr = activeTransition(doors);
  if (tr) return [cur, tr.door.from];
  const next = nextDoor(doors);
  return next ? [cur, next.to] : [cur];
}

/** The upcoming door inside the pre-warm window, if any. */
export function nextDoor(doors: readonly DoorView[]): DoorView | null {
  return doors.find((d) => d.timeUntil > 0 && d.timeUntil <= PREWARM_LEAD) ?? null;
}

/** Background with any running door transition. Returns the offset to apply to the door frame. */
export function drawBackground(
  ctx: Ctx, v: View, corridor: Corridor, cur: Scene, doors: readonly DoorView[], scroll: number, t: number, reduced: boolean,
): { ox: number; oy: number; alpha: number } {
  const tr = activeTransition(doors);
  if (!tr) {
    corridor.drawScene(ctx, v, cur, scroll, t, 0, 0);
    return { ox: 0, oy: 0, alpha: 1 };
  }
  const { door, p } = tr;
  const e = easeInOut(p);
  if (reduced) {
    corridor.drawScene(ctx, v, cur, scroll, t, 0, 0);
    ctx.globalAlpha = 1 - e;
    corridor.drawScene(ctx, v, door.from, scroll, t, 0, 0);
    ctx.globalAlpha = 1;
    return { ox: 0, oy: 0, alpha: 1 - e };
  }
  if (door.transition === 'turn') {
    const ox = -e * (v.w + 24);
    corridor.drawScene(ctx, v, door.from, scroll, t, ox, 0);
    corridor.drawScene(ctx, v, cur, scroll, t, ox + v.w + 24, 0);
    cornerSeam(ctx, v, v.x0 - 12 + ox + v.w + 24);
    return { ox, oy: 0, alpha: 1 };
  }
  if (door.transition === 'stairs') {
    const oy = -e * (v.h + 24);
    corridor.drawScene(ctx, v, door.from, scroll, t, 0, oy);
    corridor.drawScene(ctx, v, cur, scroll, t, 0, oy + v.h + 24);
    stairSeam(ctx, v, v.y0 - 12 + oy + v.h + 24);
    return { ox: 0, oy, alpha: 1 };
  }
  // elevator: close 0..0.4, closed + shake 0.4..0.6, open 0.6..1; the scene swaps while closed
  const close = p < 0.4 ? easeInOut(p / 0.4) : p < 0.6 ? 1 : 1 - easeInOut((p - 0.6) / 0.4);
  const shake = p > 0.38 && p < 0.66 ? Math.sin(p * 140) * 2.2 : 0;
  corridor.drawScene(ctx, v, p < 0.5 ? door.from : cur, scroll, t, 0, 0);
  elevatorDoors(ctx, v, close, shake);
  return { ox: 0, oy: 0, alpha: p < 0.5 ? 1 - close : 0 };
}

function cornerSeam(ctx: Ctx, v: View, x: number): void {
  const g = ctx.createLinearGradient(x - 26, 0, x + 10, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 26, v.y0, 36, v.h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x + 2, v.y0, 2, v.h);
}

function stairSeam(ctx: Ctx, v: View, y: number): void {
  // a few steps rushing past at the seam between the two floors
  for (let i = 0; i < 4; i++) {
    const sy = y - 16 + i * 8;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(20,22,34,0.9)' : 'rgba(80,88,110,0.9)';
    ctx.fillRect(v.x0, sy, v.w, 8);
  }
  ctx.fillStyle = 'rgba(255,200,60,0.75)';
  ctx.fillRect(v.x0, y + 15, v.w, 2);
}

function elevatorDoors(ctx: Ctx, v: View, close: number, shake: number): void {
  if (close <= 0) return;
  const half = v.w / 2 + 12;
  const w = half * close;
  const top = v.y0 - 12 + shake;
  const h = v.h + 24;
  for (const side of [0, 1]) {
    const x = side === 0 ? v.x0 - 12 : v.x0 + v.w + 12 - w;
    ctx.fillStyle = vGrad(ctx, top, top + h, [[0, '#59647C'], [0.5, '#8C97AE'], [1, '#3F4860']]);
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = 1; k < 4; k++) ctx.fillRect(x + (w * k) / 4, top, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(side === 0 ? x + w - 4 : x, top, 4, h);
  }
  if (close > 0.98) {
    ctx.fillStyle = '#FFC93C';
    roundRect(ctx, v.x0 + v.w / 2 - 22, 238 + shake, 44, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#1E1A3A';
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▲', v.x0 + v.w / 2, 247.5 + shake);
  }
}

// ---------- door frame ----------

function quad(ctx: Ctx, x: number, da: number, db: number, h0: number, h1: number): void {
  ctx.beginPath();
  ctx.moveTo(projX(x, da), projY(da, h0));
  ctx.lineTo(projX(x, db), projY(db, h0));
  ctx.lineTo(projX(x, db), projY(db, h1));
  ctx.lineTo(projX(x, da), projY(da, h1));
  ctx.closePath();
}

/** Panel opening 0 (shut) .. 1 (open). */
function opening(tu: number): number {
  return clamp((1.0 - tu) / 0.7, 0, 1);
}

function panel(ctx: Ctx, x: number, da: number, db: number, lo: number, hi: number): void {
  const a = Math.max(da, lo);
  const b = Math.min(db, hi);
  if (b - a < 0.02) return;
  quad(ctx, x, a, b, 0, DOOR_H);
  ctx.fillStyle = '#5B6680';
  ctx.fill();
  ctx.strokeStyle = 'rgba(14,16,30,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // hazard stripes band
  const n = Math.max(1, Math.round((b - a) / 0.25));
  for (let i = 0; i < n; i++) {
    quad(ctx, x, a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n, 64, 78);
    ctx.fillStyle = i % 2 === 0 ? '#FFC93C' : '#22263A';
    ctx.fill();
  }
  quad(ctx, x, a + 0.1 * (b - a), b - 0.1 * (b - a), 104, 132);
  ctx.fillStyle = 'rgba(120,220,255,0.35)';
  ctx.fill();
}

/** Back part: far post and the two sliding panels (drawn before the lanes). */
export function drawDoorBack(ctx: Ctx, d: DoorView, off: { ox: number; oy: number; alpha: number }): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  quad(ctx, x - POST_W / 2, WALL_DEPTH, WALL_DEPTH + 0.15, 0, DOOR_H + 14);
  ctx.fillStyle = '#2E3448';
  ctx.fill();
  const o = opening(d.timeUntil);
  const mid = 1;
  panel(ctx, x, WALL_DEPTH - (mid - WALL_DEPTH) * o, mid - (mid - WALL_DEPTH) * o, WALL_DEPTH, NEAR_D);
  panel(ctx, x, mid + (NEAR_D - mid) * o, NEAR_D + (NEAR_D - mid) * o, WALL_DEPTH, NEAR_D);
  ctx.restore();
}

/** Front part: near post and the lintel with its status light (drawn after the lanes). */
export function drawDoorFront(ctx: Ctx, d: DoorView, t: number, off: { ox: number; oy: number; alpha: number }): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  const px = projX(x, NEAR_D);
  const top = projY(NEAR_D, DOOR_H + 14);
  const bot = projY(NEAR_D, 0) + 4;
  ctx.fillStyle = vGrad(ctx, top, bot, [[0, '#4A5470'], [1, '#262C40']]);
  roundRect(ctx, px - POST_W * 0.6, top, POST_W * 1.2, bot - top, 3);
  ctx.fill();
  ctx.fillStyle = '#FFC93C';
  for (let y = top + 20; y < bot - 10; y += 26) ctx.fillRect(px - POST_W * 0.6, y, POST_W * 1.2, 8);
  // lintel across the corridor (up to the ceiling a bit)
  quad(ctx, x, SPAN_D0 - 0.1, NEAR_D, DOOR_H, DOOR_H + 22);
  ctx.fillStyle = '#3A4260';
  ctx.fill();
  ctx.strokeStyle = 'rgba(14,16,30,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  quad(ctx, x, SPAN_D0 - 0.1, NEAR_D, DOOR_H + 22, Math.min(CEIL_H, DOOR_H + 60));
  ctx.fillStyle = 'rgba(40,46,66,0.85)';
  ctx.fill();
  const open = opening(d.timeUntil) > 0.05;
  const blink = Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = open ? '#3DDC97' : blink ? '#FF3358' : '#7A1020';
  ctx.beginPath();
  ctx.arc(projX(x, 1), projY(1, DOOR_H + 11), 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** While the door is still off-screen to the right: a small "door ahead" sign on the right edge. */
export function drawDoorSign(ctx: Ctx, v: View, d: DoorView, t: number): void {
  const x = fixedX(d.timeUntil);
  const edge = v.x0 + v.w;
  if (d.timeUntil <= 0 || x < edge - 10) return;
  const slide = clamp((3 - d.timeUntil) / 0.3, 0, 1);
  const cx = edge - 24 * slide + 4;
  const cy = projY(1, DOOR_H * 0.6);
  ctx.globalAlpha = slide;
  ctx.fillStyle = 'rgba(14,16,40,0.85)';
  roundRect(ctx, cx - 18, cy - 22, 36, 44, 9);
  ctx.fill();
  ctx.strokeStyle = '#FFC93C';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // door glyph: frame + two panels + a status light
  ctx.fillStyle = '#5B6680';
  ctx.fillRect(cx - 10, cy - 12, 9, 22);
  ctx.fillRect(cx + 1, cy - 12, 9, 22);
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(cx - 10, cy + 2, 20, 3);
  ctx.fillStyle = Math.floor(t * 3) % 2 === 0 ? '#3DDC97' : '#1F7A55';
  ctx.beginPath();
  ctx.arc(cx, cy - 16, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 19, cy - 4);
  ctx.lineTo(cx - 19, cy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}
