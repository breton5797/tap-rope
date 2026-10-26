// v5 lane hazards, cute-spy style, one figure per blocked lane (drawn in that lane's painter pass):
// guard  — red-eyed patrol robot with a laser shield, rolling in with the floor.
// drop   — a hazard crate held by a ceiling claw; it drops onto the lane and its landing shadow
//          darkens from WARN_LEAD on.
// chaser — a pursuit drone dashing in from the left screen edge along its lane.
import { PLAYER_X, WARN_LEAD, type VisibleObstacle } from '../types';
import { CEIL_H, fixedX, laneY, project, projX, projY } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, clamp, oval, radGrad, roundRect, vGrad, type Ctx } from './util';
import type { View } from './view';

const OUT = 'rgba(20,14,36,0.75)';
/** crate hangs here, starts falling at DROP_START and lands at DROP_LAND (seconds before arrival) */
const HANG_H = 196;
const DROP_START = 0.42;
const DROP_LAND = 0.1;
/** chaser enters the screen this long before it reaches the agent */
export const CHASE_ENTER = 0.55;
const CHASE_H = 30;

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 131;
}

// ---------- guard ----------

function guardSprite(ctx: Ctx): void {
  // treads
  ctx.fillStyle = '#23263A';
  roundRect(ctx, -17, -11, 34, 11, 5.5);
  ctx.fill();
  ctx.fillStyle = '#4A5070';
  for (const x of [-10, 0, 10]) {
    circle(ctx, x, -5.5, 3);
    ctx.fill();
  }
  // body
  ctx.fillStyle = vGrad(ctx, -46, -10, [[0, '#B9C3D8'], [0.5, '#7D88A3'], [1, '#4A5470']]);
  roundRect(ctx, -13, -46, 26, 37, 11);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(-13, -24, 26, 4);
  ctx.fillStyle = '#22263A';
  for (let x = -11; x < 13; x += 6) ctx.fillRect(x, -24, 3, 4);
  // head dome + visor
  ctx.fillStyle = vGrad(ctx, -62, -44, [[0, '#D5DCEA'], [1, '#8C97AE']]);
  roundRect(ctx, -12, -62, 24, 20, 10);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.stroke();
  ctx.fillStyle = '#121424';
  roundRect(ctx, -10, -56, 20, 9, 4.5);
  ctx.fill();
  // antenna
  ctx.strokeStyle = '#4A5070';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(3, -62);
  ctx.lineTo(5, -69);
  ctx.stroke();
  // arm holding the shield (on the side facing the agent = left)
  ctx.strokeStyle = '#5A6480';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, -34);
  ctx.lineTo(-19, -30);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, -9, -43, 5, 16, 2.5);
  ctx.fill();
}

function guardShield(ctx: Ctx, x: number, y: number, s: number, glow: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-21, -54);
  ctx.lineTo(-28, -44);
  ctx.lineTo(-28, -14);
  ctx.lineTo(-21, -4);
  ctx.lineTo(-17, -14);
  ctx.lineTo(-17, -44);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,51,88,${(0.28 + 0.2 * glow).toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = '#FF5E7A';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-25, -42);
  ctx.lineTo(-25, -18);
  ctx.stroke();
  ctx.restore();
}

function guard(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const seed = seedOf(o.id) + lane;
  const p = project(fixedX(o.timeUntil), lane, 0);
  const s = p.scale * 1.15;
  const bob = reduced ? 0 : Math.sin(t * 9 + seed) * 0.8;
  ctx.fillStyle = 'rgba(5,4,12,0.35)';
  oval(ctx, p.x, p.y + 1, 21 * s, 4.5 * s);
  ctx.fill();
  blitScaled(ctx, sprites.get('guard', 44, 74, 22, 71, guardSprite), p.x, p.y + bob, s, s);
  const glow = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(t * 7 + seed);
  // red eyes scanning
  const look = reduced ? 0 : Math.sin(t * 2.2 + seed) * 2;
  ctx.fillStyle = '#FF3358';
  for (const ex of [-5, 3]) {
    circle(ctx, p.x + (ex + look) * s, p.y + bob - 51.5 * s, 2.6 * s);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(255,80,110,${(0.25 + 0.25 * glow).toFixed(3)})`;
  circle(ctx, p.x + (-1 + look) * s, p.y + bob - 51.5 * s, 9 * s);
  ctx.fill();
  ctx.fillStyle = glow > 0.5 || reduced ? '#FF3358' : '#7A1020';
  circle(ctx, p.x + 5 * s, p.y + bob - 70 * s, 2.4 * s);
  ctx.fill();
  guardShield(ctx, p.x, p.y + bob, s, glow);
}

// ---------- drop ----------

function crateSprite(ctx: Ctx): void {
  ctx.fillStyle = vGrad(ctx, -30, 0, [[0, '#FFB45E'], [1, '#D9701F']]);
  roundRect(ctx, -17, -30, 34, 30, 4);
  ctx.fill();
  ctx.strokeStyle = '#7A3A10';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(122,58,16,0.6)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-17, -30);
  ctx.lineTo(17, 0);
  ctx.moveTo(17, -30);
  ctx.lineTo(-17, 0);
  ctx.stroke();
  ctx.fillStyle = '#FFC93C';
  roundRect(ctx, -10, -24, 20, 18, 3);
  ctx.fill();
  ctx.fillStyle = '#22263A';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(8, -8);
  ctx.lineTo(-8, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFC93C';
  ctx.fillRect(-1, -18.5, 2, 6);
  ctx.fillRect(-1, -11.5, 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(-15, -28, 30, 3);
}

/** Crate height above its lane floor for a given timeUntil. */
export function dropHeight(tu: number): number {
  if (tu >= DROP_START) return HANG_H;
  if (tu <= DROP_LAND) return 0;
  const k = (DROP_START - tu) / (DROP_START - DROP_LAND);
  return HANG_H * (1 - k * k);
}

function claw(ctx: Ctx, x: number, y: number, s: number, open: number): void {
  ctx.strokeStyle = '#3A3F52';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * (12 + open * 6) * s, y + 6 * s);
    ctx.lineTo(x + side * (13 - open * 4 + open * 10) * s, y + (14 - open * 4) * s);
  }
  ctx.stroke();
  ctx.fillStyle = '#5A6278';
  roundRect(ctx, x - 7 * s, y - 6 * s, 14 * s, 8 * s, 3 * s);
  ctx.fill();
}

function drop(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  const tu = o.timeUntil;
  const wx = fixedX(tu);
  const p = project(wx, lane, 0);
  const s = p.scale;
  // landing shadow: faint until WARN_LEAD, then darkening and tightening to the landing
  const k = clamp(1 - tu / WARN_LEAD, 0, 1);
  ctx.fillStyle = `rgba(5,4,12,${(0.12 + 0.48 * k).toFixed(3)})`;
  oval(ctx, p.x, p.y + 1, (26 - 6 * k) * s, (6 - 1 * k) * s);
  ctx.fill();
  if (tu <= WARN_LEAD && tu > DROP_LAND) {
    ctx.strokeStyle = `rgba(255,51,88,${(0.35 + 0.45 * k).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    oval(ctx, p.x, p.y + 1, 24 * s, 5.5 * s);
    ctx.stroke();
  }
  const h = dropHeight(tu);
  const sway = tu > DROP_START && !reduced ? Math.sin(t * 3 + seedOf(o.id)) * 2 : 0;
  // claw and cable from the ceiling
  const clawH = tu > DROP_START ? HANG_H + 32 : HANG_H + 32 + (DROP_START - tu) * 120;
  const ceilY = projY(lane, CEIL_H);
  const cx = projX(wx, lane) + sway;
  const cy = projY(lane, Math.min(clawH, CEIL_H - 6));
  ctx.strokeStyle = '#2A2F3E';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, ceilY);
  ctx.lineTo(cx, cy);
  ctx.stroke();
  claw(ctx, cx, cy, s, tu > DROP_START ? 0 : 1);
  const squash = tu <= DROP_LAND && tu > DROP_LAND - 0.12 && !reduced ? Math.sin(((DROP_LAND - tu) / 0.12) * Math.PI) * 0.18 : 0;
  const y = projY(lane, h);
  blitScaled(ctx, sprites.get('crate', 38, 34, 19, 32, crateSprite), p.x + sway * (h / HANG_H), y, s * (1 + squash), s * (1 - squash));
}

// ---------- chaser ----------

function chaserSprite(ctx: Ctx): void {
  ctx.fillStyle = '#2A1E44';
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(-22, -13);
  ctx.lineTo(-10, -11);
  ctx.closePath();
  ctx.moveTo(-14, 6);
  ctx.lineTo(-22, 13);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -3, -5, 2, 17, [[0, '#9A7BE0'], [0.6, '#5A3E9A'], [1, '#2A1E44']]);
  circle(ctx, 0, 0, 14);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#3A3F52';
  roundRect(ctx, -19, -4, 7, 8, 2);
  ctx.fill();
  // big eye with an angry brow
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 5, 0, 6.5);
  ctx.fill();
  ctx.fillStyle = '#FF3358';
  circle(ctx, 7, 0.5, 3.8);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, 8.2, -1, 1.2);
  ctx.fill();
  ctx.strokeStyle = '#1E1A3A';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1, -9);
  ctx.lineTo(11, -5.5);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, -9, -10, 8, 3, 1.5);
  ctx.fill();
}

/** Middle-lane screen x of a chaser (it reaches PLAYER_X exactly at timeUntil 0). */
export function chaserX(tu: number, v: View): number {
  const speed = (PLAYER_X - v.x0 + 30) / CHASE_ENTER;
  return PLAYER_X - tu * speed;
}

function chaser(ctx: Ctx, v: View, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache, reduced: boolean): void {
  if (o.timeUntil > CHASE_ENTER) return;
  const p = project(chaserX(o.timeUntil, v), lane, CHASE_H);
  const s = p.scale;
  const wob = reduced ? 0 : Math.sin(t * 20 + seedOf(o.id)) * 1.2;
  ctx.fillStyle = 'rgba(5,4,12,0.3)';
  oval(ctx, p.x, laneY(lane) + 1, 15 * s, 3.5 * s);
  ctx.fill();
  // speed lines + jet flame
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const o2 = reduced ? 0 : (t * 300 + i * 17) % 24;
    const y = p.y + (i - 1) * 8 * s;
    ctx.moveTo(p.x - (26 + o2) * s, y);
    ctx.lineTo(p.x - (46 + o2) * s, y);
  }
  ctx.stroke();
  const fl = reduced ? 1 : 0.8 + 0.4 * Math.abs(Math.sin(t * 40));
  ctx.fillStyle = 'rgba(255,170,60,0.9)';
  oval(ctx, p.x - 22 * s, p.y + wob, 8 * fl * s, 3.4 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,0.95)';
  oval(ctx, p.x - 20 * s, p.y + wob, 4 * fl * s, 1.8 * s);
  ctx.fill();
  blitScaled(ctx, sprites.get('chaser', 46, 32, 24, 16, chaserSprite), p.x, p.y + wob, s, s);
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
