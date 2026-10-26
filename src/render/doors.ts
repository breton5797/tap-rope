// Section doors (GDD-v5 §6): a security door frame scrolls in spanning all lanes, its panels slide
// open (far panel into the wall, near panel out toward the camera) during timeUntil 1.0 → 0.3,
// and when the agent passes the doorway (timeUntil ≤ 0) the corridor background runs a 0.6s
// transition from door.from to door.to: turn = horizontal push, stairs = vertical push upward,
// elevator = doors close, shake, open. Reduced motion = a quick crossfade.
import type { DoorView, Scene } from '../types';
import type { Corridor } from './corridor';
import { CEIL_H, depthScale, fixedX, projX, projY, SPAN_D0, WALL_DEPTH } from './layout';
import { puffSprite } from './corridor-fx';
import { HUD_FONT } from './lane-icons';
import { blitScaled, type SpriteCache } from './sprites';
import { clamp, vGrad, type Ctx, type Stops } from './util';
import type { View } from './view';

export const TRANSITION_TIME = 0.6;
/** start pre-baking the next scene this long before the door (one tile per frame) */
const PREWARM_LEAD = 1.6;
const DOOR_H = 150;
const NEAR_D = 2.6;
const POST_W = 12;

export interface ActiveTransition {
  door: DoorView;
  /** 0..1 progress of the transition */
  p: number;
}

/** Vertical gradients from y=0 to y=h, cached per (context, name, h) — no per-frame allocation. */
const GRADS = new Map<string, { ctx: Ctx; h: number; g: CanvasGradient }>();

function cachedGrad(ctx: Ctx, name: string, h: number, stops: Stops): CanvasGradient {
  const hit = GRADS.get(name);
  if (hit && hit.ctx === ctx && Math.abs(hit.h - h) < 0.5) return hit.g;
  const g = vGrad(ctx, 0, h, stops);
  GRADS.set(name, { ctx, h, g });
  return g;
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** reused result object (read it before the next call) */
const TR: ActiveTransition = { door: null as unknown as DoorView, p: 0 };

/** The door transition in progress, if any. Returns a shared object overwritten on every call — read it, don't keep it. */
export function activeTransition(doors: readonly DoorView[]): ActiveTransition | null {
  for (const d of doors) {
    if (d.timeUntil <= 0 && d.timeUntil > -TRANSITION_TIME) {
      TR.door = d;
      TR.p = clamp(-d.timeUntil / TRANSITION_TIME, 0, 1);
      return TR;
    }
  }
  return null;
}

/** Eased 0..1 progress of the running transition (0 = none / just started). */
export function transitionEase(p: number): number {
  return easeInOut(p);
}

/** The one extra scene the corridor must hold this frame: the outgoing look mid-transition,
 * else the next door's look while pre-warming, else none. */
export function doorScene(doors: readonly DoorView[]): Scene | null {
  for (const d of doors) if (d.timeUntil <= 0 && d.timeUntil > -TRANSITION_TIME) return d.from;
  const next = nextDoor(doors);
  return next ? next.to : null;
}

/** The upcoming door inside the pre-warm window, if any. */
export function nextDoor(doors: readonly DoorView[]): DoorView | null {
  return doors.find((d) => d.timeUntil > 0 && d.timeUntil <= PREWARM_LEAD) ?? null;
}

/** Background with any running door transition. Returns the offset to apply to the door frame. */
export interface DoorOffset {
  ox: number;
  oy: number;
  alpha: number;
}

/** reused every frame (no allocation): how the outgoing scene's door frame is offset / faded */
const OFF: DoorOffset = { ox: 0, oy: 0, alpha: 1 };

function offset(ox: number, oy: number, alpha: number): DoorOffset {
  OFF.ox = ox;
  OFF.oy = oy;
  OFF.alpha = alpha;
  return OFF;
}

export function drawBackground(
  ctx: Ctx, v: View, corridor: Corridor, cur: Scene, doors: readonly DoorView[], scroll: number, t: number, reduced: boolean,
): DoorOffset {
  const tr = activeTransition(doors);
  if (!tr) {
    corridor.drawScene(ctx, v, cur, scroll, t, 0, 0);
    return offset(0, 0, 1);
  }
  const { door, p } = tr;
  const e = easeInOut(p);
  if (reduced) {
    corridor.drawScene(ctx, v, cur, scroll, t, 0, 0);
    ctx.globalAlpha = 1 - e;
    corridor.drawScene(ctx, v, door.from, scroll, t, 0, 0);
    ctx.globalAlpha = 1;
    return offset(0, 0, 1 - e);
  }
  if (door.transition === 'turn') {
    const ox = -e * (v.w + 24);
    corridor.drawScene(ctx, v, door.from, scroll, t, ox, 0);
    corridor.drawScene(ctx, v, cur, scroll, t, ox + v.w + 24, 0);
    cornerSeam(ctx, v, v.x0 - 12 + ox + v.w + 24);
    return offset(ox, 0, 1);
  }
  if (door.transition === 'stairs') {
    const oy = -e * (v.h + 24);
    corridor.drawScene(ctx, v, door.from, scroll, t, 0, oy);
    corridor.drawScene(ctx, v, cur, scroll, t, 0, oy + v.h + 24);
    stairSeam(ctx, v, v.y0 - 12 + oy + v.h + 24);
    return offset(0, oy, 1);
  }
  // elevator: close 0..0.4, closed + shake 0.4..0.6, open 0.6..1; the scene swaps while closed
  const close = p < 0.4 ? easeInOut(p / 0.4) : p < 0.6 ? 1 : 1 - easeInOut((p - 0.6) / 0.4);
  const shake = p > 0.38 && p < 0.66 ? Math.sin(p * 140) * 2.2 : 0;
  corridor.drawScene(ctx, v, p < 0.5 ? door.from : cur, scroll, t, 0, 0);
  elevatorDoors(ctx, v, close, shake);
  return offset(0, 0, p < 0.5 ? 1 - close : 0);
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
    ctx.fillStyle = i % 2 === 0 ? 'rgba(14,16,18,0.92)' : 'rgba(70,76,84,0.92)';
    ctx.fillRect(v.x0, sy, v.w, 8);
  }
  ctx.fillStyle = 'rgba(255,176,32,0.7)';
  ctx.fillRect(v.x0, y + 15, v.w, 1.5);
}

function elevatorDoors(ctx: Ctx, v: View, close: number, shake: number): void {
  if (close <= 0) return;
  const half = v.w / 2 + 12;
  const w = half * close;
  const top = v.y0 - 12 + shake;
  const h = v.h + 24;
  for (const side of [0, 1]) {
    const x = side === 0 ? v.x0 - 12 : v.x0 + v.w + 12 - w;
    ctx.save();
    ctx.translate(0, top);
    ctx.fillStyle = cachedGrad(ctx, 'elev', h, [[0, '#2E3338'], [0.5, '#5C646C'], [1, '#24282C']]);
    ctx.fillRect(x, 0, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = 1; k < 4; k++) ctx.fillRect(x + (w * k) / 4, top, 1, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(side === 0 ? x + w - 4 : x, top, 4, h);
  }
  if (close > 0.98) {
    // floor indicator: amber up-chevron in a dark slot
    const cx = v.x0 + v.w / 2;
    ctx.fillStyle = '#0B0D0F';
    ctx.fillRect(cx - 18, 236 + shake, 36, 16);
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 5, 247 + shake);
    ctx.lineTo(cx, 241 + shake);
    ctx.lineTo(cx + 5, 247 + shake);
    ctx.stroke();
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

/** Blast-door leaf between depths da..db (clipped to lo..hi): thick steel with an edge face,
 * hazard-striped bands, rivets and a narrow viewing slot. */
function panel(ctx: Ctx, x: number, da: number, db: number, lo: number, hi: number): void {
  const a = Math.max(da, lo);
  const b = Math.min(db, hi);
  if (b - a < 0.02) return;
  // edge face (door thickness) toward the agent
  quad(ctx, x - DOOR_T, a, b, 0, DOOR_H);
  ctx.fillStyle = '#1C2024';
  ctx.fill();
  quad(ctx, x, a, b, 0, DOOR_H);
  ctx.fillStyle = '#495159';
  ctx.fill();
  ctx.strokeStyle = '#121518';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const n = Math.max(1, Math.round((b - a) / 0.22));
  for (const [h0, h1] of STRIPE_BANDS) {
    for (let i = 0; i < n; i++) {
      quad(ctx, x, a + ((b - a) * i) / n, a + ((b - a) * (i + 1)) / n, h0, h1);
      ctx.fillStyle = i % 2 === 0 ? '#B98A1E' : '#15171A';
      ctx.fill();
    }
  }
  // rivet rows + viewing slot
  ctx.fillStyle = '#6E777F';
  for (const h of [40, 110]) {
    for (let i = 1; i < n * 2; i++) {
      const d = a + ((b - a) * i) / (n * 2);
      ctx.fillRect(projX(x, d) - 0.6, projY(d, h) - 0.6, 1.2, 1.2);
    }
  }
  quad(ctx, x, a + 0.3 * (b - a), b - 0.3 * (b - a), 118, 126);
  ctx.fillStyle = '#0A0C0E';
  ctx.fill();
}

const DOOR_T = 9;
const STRIPE_BANDS: readonly (readonly [number, number])[] = [[0, 14], [DOOR_H - 12, DOOR_H]];

/** Back part: far post and the two sliding panels (drawn before the lanes). */
export function drawDoorBack(ctx: Ctx, d: DoorView, off: DoorOffset, t: number, sprites: SpriteCache, reduced: boolean): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  quad(ctx, x - POST_W / 2, WALL_DEPTH, WALL_DEPTH + 0.15, 0, DOOR_H + 14);
  ctx.fillStyle = '#23272C';
  ctx.fill();
  const o = opening(d.timeUntil);
  const mid = 1;
  panel(ctx, x, WALL_DEPTH - (mid - WALL_DEPTH) * o, mid - (mid - WALL_DEPTH) * o, WALL_DEPTH, NEAR_D);
  panel(ctx, x, mid + (NEAR_D - mid) * o, NEAR_D + (NEAR_D - mid) * o, WALL_DEPTH, NEAR_D);
  if (o > 0 && o < 1) steam(ctx, x, o, t, sprites, reduced);
  ctx.restore();
}

/** Hydraulic vent steam bursting from the seam while the leaves part. */
function steam(ctx: Ctx, x: number, o: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const sp = sprites.get('puff', 62, 62, 31, 31, puffSprite);
  const n = reduced ? 2 : 5;
  const strength = Math.sin(o * Math.PI);
  for (const d of [1, -0.2, 2.3]) {
    for (let i = 0; i < n; i++) {
      const f = (i / n + (reduced ? 0 : t * 1.3)) % 1;
      ctx.globalAlpha = (1 - f) * 0.32 * strength;
      const sc = (0.25 + f * 0.8) * depthScale(d);
      blitScaled(ctx, sp, projX(x, d) + f * 18, projY(d, 8 + f * 60), sc * 1.4, sc);
    }
  }
  ctx.globalAlpha = 1;
}

/** Front part: near post and the lintel with its status light (drawn after the lanes). */
export function drawDoorFront(ctx: Ctx, d: DoorView, t: number, off: DoorOffset): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  const px = projX(x, NEAR_D);
  const top = projY(NEAR_D, DOOR_H + 14);
  const bot = projY(NEAR_D, 0) + 4;
  ctx.save();
  ctx.translate(0, top);
  ctx.fillStyle = cachedGrad(ctx, 'post', bot - top, [[0, '#3A4047'], [1, '#1C2024']]);
  ctx.fillRect(px - POST_W * 0.6, 0, POST_W * 1.2, bot - top);
  ctx.restore();
  ctx.fillStyle = '#5A626B';
  ctx.fillRect(px - POST_W * 0.6, top, 1.2, bot - top);
  // hydraulic pistons: dark cylinders with chrome rods
  for (const dx of [-3, 3]) {
    ctx.fillStyle = '#121416';
    ctx.fillRect(px + dx - 1.6, top + 26, 3.2, 40);
    ctx.fillStyle = '#B9C0C6';
    ctx.fillRect(px + dx - 0.7, top + 66, 1.4, 22);
  }
  ctx.fillStyle = '#B98A1E';
  ctx.fillRect(px - POST_W * 0.6, bot - 18, POST_W * 1.2, 4);
  ctx.fillRect(px - POST_W * 0.6, bot - 10, POST_W * 1.2, 4);
  // lintel across the corridor (up to the ceiling a bit)
  quad(ctx, x, SPAN_D0 - 0.1, NEAR_D, DOOR_H, DOOR_H + 22);
  ctx.fillStyle = '#2A2F35';
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,14,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  quad(ctx, x, SPAN_D0 - 0.1, NEAR_D, DOOR_H + 22, Math.min(CEIL_H, DOOR_H + 60));
  ctx.fillStyle = 'rgba(22,25,28,0.9)';
  ctx.fill();
  const open = opening(d.timeUntil) > 0.05;
  const blink = Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = open ? '#3FE0D0' : blink ? '#FF2A3A' : '#5A0E14';
  ctx.beginPath();
  ctx.arc(projX(x, 1), projY(1, DOOR_H + 11), 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#B98A1E';
  ctx.font = `700 7px ${HUD_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SEC-${String(d.section).padStart(2, '0')}`, projX(x, 1.8), projY(1.8, DOOR_H + 11));
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
  ctx.fillStyle = 'rgba(8,10,12,0.85)';
  ctx.fillRect(cx - 17, cy - 21, 34, 42);
  ctx.strokeStyle = '#FFB020';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 16.5, cy - 20.5, 33, 41);
  // door glyph (line icon): frame + split leaves + status light
  ctx.strokeStyle = '#E8ECEF';
  ctx.strokeRect(cx - 9.5, cy - 11.5, 19, 22);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 11);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
  ctx.fillStyle = Math.floor(t * 3) % 2 === 0 ? '#3FE0D0' : '#1C6A62';
  ctx.fillRect(cx - 1.5, cy - 17, 3, 3);
  ctx.strokeStyle = '#E8ECEF';
  ctx.beginPath();
  ctx.moveTo(cx - 21, cy - 4);
  ctx.lineTo(cx - 25, cy);
  ctx.lineTo(cx - 21, cy + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
