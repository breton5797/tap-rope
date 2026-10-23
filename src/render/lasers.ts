// Laser hazards. Colour carries meaning: RED = jump over it, CYAN = slide under it.
// floor / ceiling emitters are world-fixed hardware that charge then fire; front / back
// beams fly in from the screen edges after a blinking edge warning.
import { GROUND_Y, type LaserFrom, type VisibleObstacle } from '../types';
import {
  ARM_TIME, BEAM_H, BEAM_LEN, CEIL_LASER_END, CHARGE_TIME, ENTER_TIME, FLOOR_LASER_H, HIGH_H, fixedX, flyingX, floorY,
} from './layout';
import { CEIL_BOT } from './plane';
import { blit, type SpriteCache } from './sprites';
import { circle, clamp, roundRect, type Ctx } from './util';
import type { View } from './view';

export const JUMP_RED = '#FF3358';
export const SLIDE_CYAN = '#2EE6FF';
const HUES: string[] = [];
for (let i = 0; i < 36; i++) HUES.push(`hsl(${i * 10},100%,62%)`);
/** bolt sprite colours: 0 red, 1 cyan, 2.. fever hues */
const BOLT_COLORS: readonly string[] = [JUMP_RED, SLIDE_CYAN, ...HUES];
const BOLT_KEYS = BOLT_COLORS.map((_, i) => `bolt${i}`);

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

function colorIndex(o: VisibleObstacle, fever: boolean, t: number, k: number): number {
  if (fever) return 2 + ((Math.floor(t * 30) + k * 5) % 36);
  return o.kind === 'high' || o.kind === 'ceiling' ? 1 : 0;
}

function colorFor(o: VisibleObstacle, fever: boolean, t: number, k: number): string {
  if (fever) return HUES[(Math.floor(t * 30) + k * 5) % 36];
  return o.kind === 'high' || o.kind === 'ceiling' ? SLIDE_CYAN : JUMP_RED;
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 97;
}

/** Glowing laser segment: wide additive halo, coloured body, white-hot core. */
export function beam(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, a: number): void {
  ctx.lineCap = 'round';
  ctx.globalAlpha = a * 0.28;
  ctx.strokeStyle = color;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.globalAlpha = a * 0.95;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function flicker(t: number, seed: number): number {
  return 0.86 + 0.14 * Math.sin(t * 57 + seed * 13) * Math.sin(t * 31 + seed);
}

function emitterPod(ctx: Ctx, x: number, y: number, dir: number, lens: string, glow: number): void {
  ctx.fillStyle = '#2A2F3E';
  roundRect(ctx, x - 15, dir > 0 ? y - 7 : y, 30, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#5A6278';
  roundRect(ctx, x - 13, dir > 0 ? y - 6 : y + 1, 26, 2, 1);
  ctx.fill();
  ctx.fillStyle = lens;
  for (const dx of [-8, 0, 8]) {
    ctx.globalAlpha = 0.35 + glow * 0.65;
    circle(ctx, x + dx, y - dir * 7.5, 2.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sparks(ctx: Ctx, x: number, y: number, color: string, t: number, seed: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const a = t * 20 + i * 1.3 + seed;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 40 + i);
    circle(ctx, x + Math.cos(a) * (8 + i * 2), y + Math.sin(a * 1.3) * 5, 1.1);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Floor (from bottom) and ceiling (from top) laser fences. */
/** Blink for status lights: hard 4Hz normally, a gentle 1Hz pulse with reduced motion. */
function blinkLevel(t: number, hz: number, reduced: boolean): number {
  if (reduced) return 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
  return (t * hz) % 1 < 0.5 ? 1 : 0.3;
}

function fence(ctx: Ctx, o: VisibleObstacle, t: number, fever: boolean, reduced: boolean): void {
  const x = fixedX(o.timeUntil);
  const seed = seedOf(o.id);
  const floor = o.kind === 'floor';
  const color = colorFor(o, fever, t, 0);
  const baseY = floor ? GROUND_Y + 3 : CEIL_BOT + 2;
  const tipY = floor ? floorY(FLOOR_LASER_H) : floorY(CEIL_LASER_END);
  const tu = o.timeUntil;
  const on = tu <= ARM_TIME && tu > -0.3;
  const charge = tu > ARM_TIME && tu <= CHARGE_TIME ? 1 - (tu - ARM_TIME) / (CHARGE_TIME - ARM_TIME) : on ? 1 : 0;
  const blink = blinkLevel(t, 4, reduced);
  emitterPod(ctx, x, baseY, floor ? 1 : -1, color, Math.max(charge, blink * 0.4));
  if (!on) {
    if (charge > 0) sparks(ctx, x, baseY - (floor ? 9 : -9), color, t, seed);
    return;
  }
  const grow = clamp((ARM_TIME - tu) / 0.07, 0, 1);
  const a = (reduced ? 1 : flicker(t, seed)) * (tu < 0 ? clamp(1 + tu / 0.3, 0, 1) : 1);
  const start = baseY - (floor ? 8 : -8);
  const end = start + (tipY - start) * grow;
  for (const dx of [-8, 0, 8]) beam(ctx, x + dx, start, x + dx, end, color, a);
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = a;
  for (const dx of [-8, 0, 8]) {
    circle(ctx, x + dx, end, 2.6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function heightsOf(o: VisibleObstacle): readonly number[] {
  if (o.kind === 'high') return [HIGH_H];
  return BEAM_H.slice(0, o.level);
}

/** Blinking arrow on the screen edge where a flying beam will enter. */
function warning(ctx: Ctx, v: View, o: VisibleObstacle, t: number, fever: boolean, reduced: boolean): void {
  const back = o.from === 'back';
  const x = back ? v.x0 + 12 : v.x0 + v.w - 12;
  const pulse = reduced ? blinkLevel(t, 1, true) : (t * 6) % 1 < 0.55 ? 1 : 0.35;
  const urgency = clamp(1 - (o.timeUntil - ENTER_TIME) / 1.1, 0.3, 1);
  if (o.kind === 'high') {
    ctx.globalAlpha = 0.18 * pulse * urgency;
    ctx.fillStyle = SLIDE_CYAN;
    ctx.fillRect(back ? v.x0 : x - 2, CEIL_BOT, 14, floorY(HIGH_H) - CEIL_BOT);
  }
  heightsOf(o).forEach((h, k) => {
    const y = floorY(h);
    const color = colorFor(o, fever, t, k);
    ctx.globalAlpha = pulse * urgency;
    ctx.fillStyle = color;
    ctx.beginPath();
    const d = back ? 1 : -1;
    ctx.moveTo(x + d * 10, y);
    ctx.lineTo(x - d * 4, y - 8);
    ctx.lineTo(x - d * 4, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha *= 0.35;
    ctx.fillRect(back ? v.x0 : x + 4, y - 9, 8, 18);
  });
  ctx.globalAlpha = 1;
}

function flying(ctx: Ctx, v: View, o: VisibleObstacle, t: number, fever: boolean, sprites: SpriteCache, reduced: boolean): void {
  const from: LaserFrom = o.from === 'back' ? 'back' : 'front';
  if (o.timeUntil > ENTER_TIME) {
    warning(ctx, v, o, t, fever, reduced);
    return;
  }
  const head = flyingX(from, o.timeUntil, v);
  const dir = from === 'back' ? -1 : 1;
  const seed = seedOf(o.id);
  if (o.kind === 'high') curtain(ctx, head, dir, sprites);
  heightsOf(o).forEach((h, k) => {
    const y = floorY(h);
    const ci = colorIndex(o, fever, t, k);
    ctx.globalAlpha = reduced ? 1 : flicker(t, seed + k);
    ctx.save();
    ctx.translate(head, y);
    ctx.scale(dir, 1);
    blit(ctx, sprites.get(BOLT_KEYS[ci], BEAM_LEN + 10, 18, 5, 9, boltSprite, ci), 0, 0);
    ctx.restore();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = BOLT_COLORS[ci];
    circle(ctx, head, y, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    circle(ctx, head, y, 3.6);
    ctx.fill();
  });
}

/** Head-height lasers carry a cyan grid curtain up to the ceiling: no jump can clear them. */
const CURTAIN_H = floorY(HIGH_H) - CEIL_BOT;

function curtainSprite(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, BEAM_LEN, 0);
  g.addColorStop(0, 'rgba(30,200,240,0.42)');
  g.addColorStop(1, 'rgba(46,230,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, -CURTAIN_H, BEAM_LEN, CURTAIN_H);
  const lg = ctx.createLinearGradient(0, 0, BEAM_LEN, 0);
  lg.addColorStop(0, 'rgba(40,215,255,0.95)');
  lg.addColorStop(1, 'rgba(160,248,255,0)');
  ctx.strokeStyle = lg;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = 0; x <= BEAM_LEN; x += 10) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, -CURTAIN_H);
  }
  for (let y = -26; y > -CURTAIN_H; y -= 26) {
    ctx.moveTo(0, y);
    ctx.lineTo(BEAM_LEN, y);
  }
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -CURTAIN_H);
  ctx.lineTo(BEAM_LEN, -CURTAIN_H);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -CURTAIN_H);
  ctx.stroke();
}

function curtain(ctx: Ctx, head: number, dir: number, sprites: SpriteCache): void {
  ctx.save();
  ctx.translate(head, floorY(HIGH_H));
  ctx.scale(dir, 1);
  blit(ctx, sprites.get('curtain', BEAM_LEN + 10, CURTAIN_H + 8, 5, CURTAIN_H + 4, curtainSprite), 0, 0);
  ctx.restore();
}

/** All laser hazards (not drones / pickups). */
export function drawLasers(
  ctx: Ctx, v: View, obs: readonly VisibleObstacle[], t: number, fever: boolean, sprites: SpriteCache, reduced: boolean,
): void {
  for (const o of obs) {
    if (o.kind === 'floor' || o.kind === 'ceiling') fence(ctx, o, t, fever, reduced);
    else if (o.kind === 'beam' || o.kind === 'high') flying(ctx, v, o, t, fever, sprites, reduced);
  }
}
