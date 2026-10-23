// Security drones (scan cones) and floating pickups — world-fixed, scrolling with the floor.
import { GROUND_Y, type VisibleObstacle } from '../types';
import { bubble, clockIcon, coinFace, heartIcon, shieldIcon } from './icons';
import { fixedX, floorY } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, oval, radGrad, roundRect, type Ctx } from './util';

const PICK_KEYS = ['pick0', 'pick1', 'pick2'];

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 163;
}

function droneBody(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, -5, -6, 2, 18, [[0, '#7A8298'], [0.6, '#3E4458'], [1, '#22263A']]);
  roundRect(ctx, -17, -9, 34, 18, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,10,20,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#15161F';
  circle(ctx, 3, 1, 7);
  ctx.fill();
  ctx.fillStyle = '#5A6078';
  for (const x of [-12, 12]) {
    ctx.fillRect(x - 1, -14, 2, 6);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  roundRect(ctx, -12, -7, 12, 3, 1.5);
  ctx.fill();
}

/** Drones hover above a 1단 hop: their scan fan covers the 2단/3단 zone (the fail rule). */
const DRONE_MIN_H = 150;

function drone(ctx: Ctx, o: VisibleObstacle, t: number, sprites: SpriteCache): void {
  const x = fixedX(o.timeUntil);
  const seed = seedOf(o.id);
  const y = floorY(Math.max(o.height, DRONE_MIN_H) + 10) + Math.sin(t * 3 + seed) * 3;
  ctx.fillStyle = 'rgba(10,8,20,0.22)';
  oval(ctx, x, GROUND_Y + 10, 12, 3);
  ctx.fill();
  const sweep = Math.sin(t * 2.4 + seed) * 0.22;
  ctx.save();
  ctx.translate(x + 2, y + 2);
  ctx.rotate(Math.PI * 0.86 + sweep);
  blitScaled(ctx, sprites.get('droneScan', 150, 70, 0, 35, scanSprite), 0, 0, 1, 1);
  ctx.restore();
  blitScaled(ctx, sprites.get('droneBody', 40, 32, 20, 16, droneBody), x, y, 1, 1);
  const pr = Math.abs(Math.sin(t * 40 + seed)) * 9 + 2;
  ctx.fillStyle = 'rgba(200,210,230,0.55)';
  for (const dx of [-12, 12]) {
    oval(ctx, x + dx, y - 15, pr, 1.6);
    ctx.fill();
  }
  ctx.fillStyle = '#FF3358';
  circle(ctx, x + 3, y + 1, 3.6 + Math.sin(t * 8) * 0.6);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, x + 4.4, y - 0.4, 1.1);
  ctx.fill();
}

/** Scan fan pointing along +x (rotated into place), fading with distance. */
function scanSprite(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 150, 0);
  g.addColorStop(0, 'rgba(255,60,90,0.55)');
  g.addColorStop(1, 'rgba(255,60,90,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(150, -34);
  ctx.lineTo(150, 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,120,140,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(0, 0);
    ctx.lineTo(150, i * 15);
  }
  ctx.stroke();
}

function coinSprite(ctx: Ctx): void {
  coinFace(ctx, 11);
}

function pickupSprite(ctx: Ctx, kind: number): void {
  const tints = ['rgba(120,190,255,0.3)', 'rgba(170,140,255,0.3)', 'rgba(255,140,170,0.3)'];
  bubble(ctx, 15, tints[kind]);
  if (kind === 0) shieldIcon(ctx, 8.5);
  else if (kind === 1) clockIcon(ctx, 7.5);
  else heartIcon(ctx, 8.5);
}

function pickup(ctx: Ctx, o: VisibleObstacle, t: number, sprites: SpriteCache): void {
  if (o.timeUntil < -0.05) return;
  const x = fixedX(o.timeUntil);
  const seed = seedOf(o.id);
  const y = floorY(o.height + 14) + Math.sin(t * 2.8 + seed) * 2.5;
  if (o.kind === 'coin') {
    const sx = Math.max(0.14, Math.abs(Math.cos(t * 4.5 + seed)));
    blitScaled(ctx, sprites.get('coin', 26, 26, 13, 13, coinSprite), x, y, sx, 1);
    return;
  }
  const idx = o.kind === 'shield' ? 0 : o.kind === 'slow' ? 1 : 2;
  const pulse = 1 + Math.sin(t * 5 + seed) * 0.05;
  blitScaled(ctx, sprites.get(PICK_KEYS[idx], 36, 36, 18, 18, pickupSprite, idx), x, y, pulse, pulse);
}

export function drawGadgets(ctx: Ctx, obs: readonly VisibleObstacle[], t: number, sprites: SpriteCache): void {
  for (const o of obs) {
    if (o.kind === 'drone') drone(ctx, o, t, sprites);
    else if (o.kind === 'coin' || o.kind === 'shield' || o.kind === 'slow' || o.kind === 'heart') pickup(ctx, o, t, sprites);
  }
}
