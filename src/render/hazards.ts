// v5 lane hazards in the v6 realistic style (GDD-v6 §4), one per blocked lane (drawn in that lane's
// painter pass):
// guard  — bipedal armoured sentry walker with a red sensor slit and a gun arm, rolling in with the floor.
// drop   — a ribbed steel cargo crate on a crane claw (chain sway); it drops onto the lane and a red
//          targeting ring + darkening shadow mark the landing spot from WARN_LEAD on.
// chaser — a pursuit quadcopter with a searchlight dashing in from the left screen edge along its lane.
import { PLAYER_X, WARN_LEAD, type VisibleObstacle } from '../types';
import { CEIL_H, fixedX, laneY, project, projX, projY } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { clamp, oval, vGrad, type Ctx } from './util';
import type { View } from './view';

/** crate hangs here, starts falling at DROP_START and lands at DROP_LAND (seconds before arrival) */
const HANG_H = 196;
const DROP_START = 0.42;
const DROP_LAND = 0.1;
/** chaser enters the screen this long before it reaches the agent */
export const CHASE_ENTER = 0.55;
const CHASE_H = 34;

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 131;
}

// ---------- sentry walker ----------

/** Bipedal sentry facing −x (toward the agent); anchor = feet centre. ~74px tall. */
function guardSprite(ctx: Ctx): void {
  const dark = '#1E2226';
  const mid = '#343A41';
  const lit = '#58616B';
  // far leg (reverse knee)
  ctx.strokeStyle = dark;
  ctx.lineCap = 'butt';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(4, -38);
  ctx.lineTo(10, -22);
  ctx.lineTo(5, -3);
  ctx.stroke();
  // near leg
  ctx.strokeStyle = mid;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-2, -38);
  ctx.lineTo(4, -21);
  ctx.lineTo(-4, -3);
  ctx.stroke();
  ctx.strokeStyle = lit;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4.5, -38);
  ctx.lineTo(1.2, -22);
  ctx.stroke();
  // feet
  ctx.fillStyle = dark;
  ctx.fillRect(-12, -4, 14, 4);
  ctx.fillRect(0, -4, 12, 4);
  // hip actuator
  ctx.fillStyle = '#121416';
  ctx.beginPath();
  ctx.arc(1, -38, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // armoured torso
  ctx.fillStyle = vGrad(ctx, -66, -38, [[0, lit], [1, mid]]);
  ctx.beginPath();
  ctx.moveTo(-12, -64);
  ctx.lineTo(10, -66);
  ctx.lineTo(13, -46);
  ctx.lineTo(6, -38);
  ctx.lineTo(-10, -39);
  ctx.lineTo(-14, -50);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#15181B';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(-12, -52);
  ctx.lineTo(12, -54);
  ctx.stroke();
  // hazard stencil on the plate
  ctx.fillStyle = '#B98A1E';
  ctx.fillRect(4, -50, 7, 2);
  // head / sensor housing
  ctx.fillStyle = '#23272C';
  ctx.fillRect(-14, -73, 18, 9);
  ctx.fillStyle = '#0B0C0E';
  ctx.fillRect(-15, -70, 9, 3);
  // gun arm toward the agent
  ctx.fillStyle = '#2A2F35';
  ctx.fillRect(-24, -55, 16, 6);
  ctx.fillStyle = '#121416';
  ctx.fillRect(-31, -54, 8, 3);
  ctx.fillStyle = lit;
  ctx.fillRect(-24, -55, 16, 1);
}

function guard(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const seed = seedOf(o.id) + lane;
  const p = project(fixedX(o.timeUntil), lane, 0);
  const s = p.scale * 1.1;
  const bob = reduced ? 0 : Math.abs(Math.sin(t * 5 + seed)) * -1;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.4;
  oval(ctx, p.x, p.y + 1, 17 * s, 3.4 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  blitScaled(ctx, sprites.get('guard', 50, 80, 32, 77, guardSprite), p.x, p.y + bob, s, s);
  // red sensor slit + its glow, scanning
  const glow = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * 7 + seed);
  const sx = p.x + (-14 + (reduced ? 2 : 2 + Math.sin(t * 2.2 + seed) * 2)) * s;
  const sy = p.y + bob - 69.5 * s;
  ctx.fillStyle = '#FF2A3A';
  ctx.fillRect(sx, sy, 5 * s, 1.6 * s);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35 * glow;
  oval(ctx, sx + 2.5 * s, sy + 0.8 * s, 7 * s, 3 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- crane crate ----------

function crateSprite(ctx: Ctx): void {
  ctx.fillStyle = vGrad(ctx, -30, 0, [[0, '#5E676F'], [1, '#353B41']]);
  ctx.fillRect(-17, -30, 34, 30);
  ctx.strokeStyle = '#1B1E22';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-17, -30, 34, 30);
  // corrugation ribs
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -13; x < 17; x += 4) {
    ctx.moveTo(x, -28);
    ctx.lineTo(x, -2);
  }
  ctx.stroke();
  // corner castings + stencil band
  ctx.fillStyle = '#2A2E33';
  for (const [x, y] of [[-17, -30], [13, -30], [-17, -4], [13, -4]]) ctx.fillRect(x, y, 4, 4);
  ctx.fillStyle = '#B98A1E';
  ctx.fillRect(-17, -17, 34, 4);
  ctx.fillStyle = '#15171A';
  for (let x = -15; x < 17; x += 6) ctx.fillRect(x, -17, 3, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-17, -30, 34, 1.2);
}

/** Crate height above its lane floor for a given timeUntil. */
export function dropHeight(tu: number): number {
  if (tu >= DROP_START) return HANG_H;
  if (tu <= DROP_LAND) return 0;
  const k = (DROP_START - tu) / (DROP_START - DROP_LAND);
  return HANG_H * (1 - k * k);
}

/** Two-finger crane claw (open 0..1) at its hub. */
function claw(ctx: Ctx, x: number, y: number, s: number, open: number): void {
  ctx.strokeStyle = '#2A2E33';
  ctx.lineWidth = 2.6 * s;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let side = -1; side <= 1; side += 2) {
    ctx.moveTo(x + side * 3 * s, y + 3 * s);
    ctx.lineTo(x + side * (15 + open * 5) * s, y + 9 * s);
    ctx.lineTo(x + side * (13 + open * 8) * s, y + (17 - open * 5) * s);
  }
  ctx.stroke();
  ctx.fillStyle = '#3A4047';
  ctx.fillRect(x - 8 * s, y - 4 * s, 16 * s, 8 * s);
  ctx.fillStyle = '#B98A1E';
  ctx.fillRect(x - 8 * s, y - 4 * s, 16 * s, 1.6 * s);
}

/** Chain from the ceiling trolley to the claw: alternating links. */
function chain(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, s: number): void {
  const n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / (4 * s)));
  ctx.lineWidth = 1.4 * s;
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = (i + 1) / n;
    ctx.strokeStyle = i % 2 === 0 ? '#4A5058' : '#2A2E33';
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a);
    ctx.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
    ctx.stroke();
  }
}

function drop(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const tu = o.timeUntil;
  const wx = fixedX(tu);
  const p = project(wx, lane, 0);
  const s = p.scale;
  // landing shadow darkening + targeting ring from WARN_LEAD on
  const k = clamp(1 - tu / WARN_LEAD, 0, 1);
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.1 + 0.5 * k;
  oval(ctx, p.x, p.y + 1, (24 - 5 * k) * s, (5.5 - 1 * k) * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (tu <= WARN_LEAD && tu > DROP_LAND) targetRing(ctx, p.x, p.y + 1, s, t, reduced, 0.4 + 0.6 * k);
  const h = dropHeight(tu);
  const sway = tu > DROP_START && !reduced ? Math.sin(t * 2.2 + seedOf(o.id)) * 3 : 0;
  const clawH = tu > DROP_START ? HANG_H + 34 : HANG_H + 34 + (DROP_START - tu) * 120;
  const ceilY = projY(lane, CEIL_H);
  const tx = projX(wx, lane);
  const cy = projY(lane, Math.min(clawH, CEIL_H - 6));
  // trolley on the ceiling rail
  ctx.fillStyle = '#23272C';
  ctx.fillRect(tx - 7 * s, ceilY - 2, 14 * s, 5 * s);
  chain(ctx, tx, ceilY + 3 * s, tx + sway, cy - 4 * s, s);
  claw(ctx, tx + sway, cy, s, tu > DROP_START ? 0 : 1);
  const settle = tu <= DROP_LAND && tu > DROP_LAND - 0.12 && !reduced ? Math.sin(((DROP_LAND - tu) / 0.12) * Math.PI) * 1.5 : 0;
  const y = projY(lane, h) + settle;
  blitScaled(ctx, sprites.get('crate', 38, 34, 19, 32, crateSprite), p.x + sway * (h / HANG_H), y, s, s);
}

/** Rotating red laser targeting ring on the floor (steady under reduced motion). */
export function targetRing(ctx: Ctx, x: number, y: number, s: number, t: number, reduced: boolean, a: number): void {
  const rot = reduced ? 0 : t * 2.4;
  ctx.strokeStyle = '#FF2A3A';
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = a;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a0 = rot + (i * Math.PI) / 2;
    ctx.moveTo(x + Math.cos(a0) * 16 * s, y + Math.sin(a0) * 4 * s);
    ctx.ellipse(x, y, 16 * s, 4 * s, 0, a0, a0 + 1.1);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 20 * s, y);
  ctx.lineTo(x - 11 * s, y);
  ctx.moveTo(x + 11 * s, y);
  ctx.lineTo(x + 20 * s, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- pursuit quadcopter ----------

/** Chaser quadcopter flying +x (anchor = body centre). */
function chaserSprite(ctx: Ctx): void {
  ctx.fillStyle = '#1B1E22';
  ctx.fillRect(-18, -2, 36, 3);
  for (const x of [-17, 17]) {
    ctx.fillStyle = '#26292E';
    ctx.fillRect(x - 3, -6, 6, 5);
  }
  ctx.fillStyle = '#2C3136';
  ctx.beginPath();
  ctx.moveTo(-11, -5);
  ctx.lineTo(9, -6);
  ctx.lineTo(13, 0);
  ctx.lineTo(9, 5);
  ctx.lineTo(-11, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4B525A';
  ctx.fillRect(-11, -5, 20, 1.2);
  // searchlight head
  ctx.fillStyle = '#121416';
  ctx.fillRect(9, -2, 6, 6);
  ctx.fillStyle = '#F4F0E0';
  ctx.fillRect(14, -1, 1.6, 4);
}

/** Middle-lane screen x of a chaser (it reaches PLAYER_X exactly at timeUntil 0). */
export function chaserX(tu: number, v: View): number {
  const speed = (PLAYER_X - v.x0 + 30) / CHASE_ENTER;
  return PLAYER_X - tu * speed;
}

function searchSprite(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 110, 0);
  g.addColorStop(0, 'rgba(255,244,214,0.38)');
  g.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(110, -18);
  ctx.lineTo(110, 26);
  ctx.lineTo(0, 2);
  ctx.closePath();
  ctx.fill();
}

function chaser(ctx: Ctx, v: View, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  if (o.timeUntil > CHASE_ENTER) return;
  const p = project(chaserX(o.timeUntil, v), lane, CHASE_H);
  const s = p.scale;
  const wob = reduced ? 0 : Math.sin(t * 17 + seedOf(o.id)) * 0.8;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.3;
  oval(ctx, p.x, laneY(lane) + 1, 15 * s, 3 * s);
  ctx.fill();
  ctx.globalAlpha = 1;
  // searchlight cone ahead (additive) + motion streaks behind
  ctx.globalCompositeOperation = 'lighter';
  blitScaled(ctx, sprites.get('search', 112, 48, 0, 20, searchSprite), p.x + 15 * s, p.y + 1 * s + wob, s, s);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(200,210,220,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const o2 = reduced ? 0 : (t * 300 + i * 17) % 24;
    const y = p.y + (i - 1) * 6 * s;
    ctx.moveTo(p.x - (24 + o2) * s, y);
    ctx.lineTo(p.x - (44 + o2) * s, y);
  }
  ctx.stroke();
  // nose-down pitch while dashing
  ctx.save();
  ctx.translate(p.x, p.y + wob);
  ctx.rotate(0.14);
  blitScaled(ctx, sprites.get('chaser', 40, 18, 20, 8, chaserSprite), 0, 0, s, s);
  ctx.fillStyle = '#9AA3AD';
  ctx.globalAlpha = 0.28;
  for (let dx = -17; dx <= 17; dx += 34) {
    oval(ctx, dx * s, -7 * s, 8 * s, 1 * s);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Lane hazards occupying lane `lane` (call once per lane in painter order, far → near). */
export function drawLaneHazards(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], lane: number, t: number, sprites: SpriteCache, reduced: boolean,
): void {
  for (const o of obs) {
    if (!o.lanes || !o.lanes.includes(lane as 0 | 1 | 2)) continue;
    if (o.kind === 'guard') guard(ctx, o, lane, t, sprites, reduced);
    else if (o.kind === 'drop') drop(ctx, o, lane, t, sprites, reduced);
    else if (o.kind === 'chaser') chaser(ctx, v, o, lane, t, sprites, reduced);
  }
}
