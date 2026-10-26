// Section doors (GDD-v5 §6): a security door frame scrolls in spanning all lanes, its panels slide
// open (far panel into the wall, near panel out toward the camera) during timeUntil 1.0 → 0.3,
// and when the agent passes the doorway (timeUntil ≤ 0) the corridor background runs a 0.6s
// transition from door.from to door.to: turn = horizontal push, stairs = vertical push upward,
// elevator = doors close, shake, open. Reduced motion = a quick crossfade.
import type { DoorView, Scene } from '../types';
import type { Corridor } from './corridor';
import { depthScale, fixedX, projX, projY, WALL_DEPTH } from './layout';
import { puffSprite } from './corridor-fx';
import { HUD_FONT } from './lane-icons';
import { blitScaled, type SpriteCache } from './sprites';
import { clamp, vGrad, type Ctx, type Stops } from './util';
import type { View } from './view';

export const TRANSITION_TIME = 0.6;
/** start pre-baking the next scene this long before the door (one tile per frame) */
const PREWARM_LEAD = 2.8;
const DOOR_H = 150;
const NEAR_D = 2.6;

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
function nextDoor(doors: readonly DoorView[]): DoorView | null {
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
    seam(ctx, v, v.x0 - 12 + ox + v.w + 24, true);
    dip(ctx, v, e);
    return offset(ox, 0, 1);
  }
  if (door.transition === 'stairs') {
    const oy = -e * (v.h + 24);
    corridor.drawScene(ctx, v, door.from, scroll, t, 0, oy);
    corridor.drawScene(ctx, v, cur, scroll, t, 0, oy + v.h + 24);
    seam(ctx, v, v.y0 - 12 + oy + v.h + 24, false);
    dip(ctx, v, e);
    return offset(0, oy, 1);
  }
  // elevator: close 0..0.4, closed + shake 0.4..0.6, open 0.6..1; the scene swaps while closed
  const close = p < 0.4 ? easeInOut(p / 0.4) : p < 0.6 ? 1 : 1 - easeInOut((p - 0.6) / 0.4);
  const shake = p > 0.38 && p < 0.66 ? Math.sin(p * 140) * 2.2 : 0;
  corridor.drawScene(ctx, v, p < 0.5 ? door.from : cur, scroll, t, 0, 0);
  elevatorDoors(ctx, v, close, shake);
  return offset(0, 0, p < 0.5 ? 1 - close : 0);
}

const SEAM_W = 90;

/** A wide dark falloff where the two scenes meet (no hard cut): vertical for turn, horizontal for stairs. */
function seam(ctx: Ctx, v: View, at: number, vertical: boolean): void {
  // gradient built once per context and orientation around 0, positioned by translate
  const key = vertical ? 'seamV' : 'seamH';
  let hit = GRADS.get(key);
  if (!hit || hit.ctx !== ctx) {
    const g = vertical ? ctx.createLinearGradient(-SEAM_W, 0, SEAM_W, 0) : ctx.createLinearGradient(0, -SEAM_W, 0, SEAM_W);
    g.addColorStop(0, 'rgba(3,4,6,0)');
    g.addColorStop(0.5, 'rgba(3,4,6,0.92)');
    g.addColorStop(1, 'rgba(3,4,6,0)');
    hit = { ctx, h: 0, g };
    GRADS.set(key, hit);
  }
  ctx.save();
  ctx.fillStyle = hit.g;
  if (vertical) {
    ctx.translate(at, 0);
    ctx.fillRect(-SEAM_W, v.y0, SEAM_W * 2, v.h);
  } else {
    ctx.translate(0, at);
    ctx.fillRect(v.x0, -SEAM_W, v.w, SEAM_W * 2);
  }
  ctx.restore();
}

/** Brief dip toward black in the middle of a push transition. */
function dip(ctx: Ctx, v: View, e: number): void {
  ctx.fillStyle = '#030406';
  ctx.globalAlpha = 0.45 * Math.sin(e * Math.PI);
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
  ctx.globalAlpha = 1;
}

function elevatorDoors(ctx: Ctx, v: View, close: number, shake: number): void {
  if (close <= 0) return;
  const half = v.w / 2 + 12;
  const w = half * close;
  const top = v.y0 - 12 + shake;
  const h = v.h + 24;
  for (let side = 0; side < 2; side++) {
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


/** Panel opening 0 (shut) .. 1 (open). */
function opening(tu: number): number {
  return clamp((1.0 - tu) / 0.7, 0, 1);
}

// The door is drawn in SCREEN space at the middle-lane x of its world position: a vertical
// guillotine leaf between two vertical rails, under a lintel. (Drawn along the depth axis the
// leaf reads as a diagonal card from this camera; upright it reads as a blast door.)
const LEAF_W = 30; // front face
const SIDE_W = 9; // side face (thickness) facing the agent
const RAIL_W = 7;
const LINTEL_H = 18;

interface DoorBox {
  x: number; // centre x
  top: number; // top of the lintel
  open: number; // top of the opening (under the lintel)
  bot: number; // floor line at the near edge
}

const BOX: DoorBox = { x: 0, top: 0, open: 0, bot: 0 };

function box(wx: number): DoorBox {
  BOX.x = projX(wx, 1);
  BOX.top = projY(WALL_DEPTH, DOOR_H + 20);
  BOX.open = BOX.top + LINTEL_H;
  BOX.bot = projY(NEAR_D, 0) + 2;
  return BOX;
}

/** The leaf (opening o: 0 shut .. 1 up inside the lintel), clipped to the opening. */
function leaf(ctx: Ctx, b: DoorBox, o: number): void {
  const h = b.bot - b.open;
  const y0 = b.open - o * h;
  if (o >= 0.999) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - LEAF_W / 2 - SIDE_W - 1, b.open, LEAF_W + SIDE_W + 2, h);
  ctx.clip();
  const x0 = b.x - LEAF_W / 2;
  // side face (thickness) toward the agent, then the front face
  ctx.fillStyle = '#16191C';
  ctx.fillRect(x0 - SIDE_W, y0, SIDE_W, h);
  ctx.fillStyle = '#2A3036';
  ctx.fillRect(x0 - SIDE_W, y0, 1.2, h);
  ctx.fillStyle = vGradCached(ctx, h);
  ctx.save();
  ctx.translate(0, y0);
  ctx.fillRect(x0, 0, LEAF_W, h);
  ctx.restore();
  ctx.fillStyle = '#5E6770';
  ctx.fillRect(x0, y0, 1, h);
  // reinforcement ribs, rivets, hazard-striped leading (bottom) edge
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let k = 1; k < 4; k++) ctx.fillRect(x0, y0 + (h * k) / 4, LEAF_W, 1.5);
  ctx.fillStyle = '#7A838C';
  for (let k = 0; k < 4; k++) {
    const ry = y0 + (h * k) / 4 + 5;
    ctx.fillRect(x0 + 3, ry, 1.2, 1.2);
    ctx.fillRect(x0 + LEAF_W - 4, ry, 1.2, 1.2);
  }
  const by = y0 + h - 14;
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k % 2 === 0 ? '#B98A1E' : '#15171A';
    ctx.fillRect(x0 - SIDE_W, by + k * 3.5, LEAF_W + SIDE_W, 3.5);
  }
  ctx.restore();
}

/** Back part: the leaf + steam (drawn before the lanes). */
export function drawDoorBack(ctx: Ctx, d: DoorView, off: DoorOffset, t: number, sprites: SpriteCache, reduced: boolean): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  const o = opening(d.timeUntil);
  leaf(ctx, box(x), o);
  if (o > 0 && o < 1) steam(ctx, x, o, t, sprites, reduced);
  ctx.restore();
}

const STEAM_DEPTHS: readonly number[] = [1, -0.2, 2.3];

/** Hydraulic steam venting from under the rising leaf (strongest as it breaks the seal). */
function steam(ctx: Ctx, x: number, o: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const sp = sprites.get('puff', 62, 62, 31, 31, puffSprite);
  const n = reduced ? 2 : 5;
  const strength = o < 0.25 ? o / 0.25 : 1 - (o - 0.25) / 0.75;
  for (const d of STEAM_DEPTHS) {
    for (let i = 0; i < n; i++) {
      const f = (i / n + (reduced ? 0 : t * 1.1)) % 1;
      ctx.globalAlpha = (1 - f) * 0.3 * strength;
      const sc = (0.3 + f * 0.9) * depthScale(d);
      blitScaled(ctx, sp, projX(x, 1) + (i % 2 ? 1 : -1) * f * 26, projY(d, 6 + f * 26), sc * 1.6, sc * 0.8);
    }
  }
  ctx.globalAlpha = 1;
}

/** Front part: the two rails and the lintel with status light + sector stencil (after the lanes). */
export function drawDoorFront(ctx: Ctx, d: DoorView, t: number, off: DoorOffset): void {
  if (off.alpha <= 0.01) return;
  const x = fixedX(d.timeUntil);
  if (x < -80 || x > 520) return;
  ctx.save();
  ctx.translate(off.ox, off.oy);
  ctx.globalAlpha = off.alpha;
  const b = box(x);
  const left = b.x - LEAF_W / 2 - SIDE_W - RAIL_W;
  const right = b.x + LEAF_W / 2;
  for (let side = 0; side < 2; side++) {
    const rx = side === 0 ? left : right;
    ctx.fillStyle = '#23282D';
    ctx.fillRect(rx, b.top, RAIL_W, b.bot - b.top);
    ctx.fillStyle = '#4A525B';
    ctx.fillRect(rx, b.top, 1.2, b.bot - b.top);
    // piston rod
    ctx.fillStyle = '#B9C0C6';
    ctx.fillRect(rx + RAIL_W / 2 - 0.6, b.open + 8, 1.2, (b.bot - b.open) * 0.4);
    ctx.fillStyle = '#B98A1E';
    ctx.fillRect(rx, b.bot - 16, RAIL_W, 3);
    ctx.fillRect(rx, b.bot - 9, RAIL_W, 3);
  }
  // lintel housing (the leaf retracts into it)
  ctx.fillStyle = '#1E2327';
  ctx.fillRect(left - 3, b.top, right + RAIL_W + 3 - (left - 3), LINTEL_H);
  ctx.fillStyle = '#4A525B';
  ctx.fillRect(left - 3, b.top, right + RAIL_W + 3 - (left - 3), 1.2);
  const open = opening(d.timeUntil) > 0.05;
  const blink = Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = open ? '#3FE0D0' : blink ? '#FF2A3A' : '#5A0E14';
  ctx.fillRect(b.x - 2, b.top + 5, 4, 4);
  // sector being entered, stencilled vertically down the right rail's housing
  ctx.fillStyle = '#B98A1E';
  ctx.font = `700 7px ${HUD_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(SECTOR_LABELS[Math.min(SECTOR_LABELS.length - 1, d.section)] ?? 'SEC', right + RAIL_W + 4, b.top + LINTEL_H / 2);
  ctx.restore();
}

/** stencil per door: the sector entered = door.section + 1 (no per-frame string building) */
const SECTOR_LABELS: readonly string[] = Array.from({ length: 10 }, (_, i) => `SEC-${String(i + 1).padStart(2, '0')}`);

/** leaf face gradient (cached per context and height) */
function vGradCached(ctx: Ctx, h: number): CanvasGradient {
  return cachedGrad(ctx, 'leaf', h, [[0, '#56606A'], [0.5, '#434B53'], [1, '#30363C']]);
}

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
