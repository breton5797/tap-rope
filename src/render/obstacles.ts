// In-world hurdles, birds and floating pickups.
import { GROUND_Y, type Level, type VisibleObstacle } from '../types';
import { bubble, clockIcon, coinFace, heartIcon, shieldIcon } from './icons';
import { blit, blitScaled, type SpriteCache } from './sprites';
import { circle, FONT, LEVEL_DARK, LEVEL_FILL, LEVEL_LIGHT, oval, roundRect, vGrad, type Ctx } from './util';

export const BLOCK_H = 22;
const BLOCK_W = 30;
const HURDLE_KEYS = ['', 'hurdle1', 'hurdle2', 'hurdle3'];
const PICK_KEYS = ['pick0', 'pick1', 'pick2'];

function block(ctx: Ctx, yTop: number, level: number): void {
  ctx.fillStyle = vGrad(ctx, yTop, yTop + BLOCK_H, [[0, LEVEL_LIGHT[level]], [0.35, LEVEL_FILL[level]], [1, LEVEL_DARK[level]]]);
  roundRect(ctx, -BLOCK_W / 2, yTop + 0.5, BLOCK_W, BLOCK_H - 1, 6);
  ctx.fill();
  ctx.strokeStyle = LEVEL_DARK[level];
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  roundRect(ctx, -BLOCK_W / 2 + 3.5, yTop + 2.6, BLOCK_W - 7, 4.2, 2.1);
  ctx.fill();
  ctx.font = `900 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = LEVEL_DARK[level];
  ctx.fillText(String(level), 0, yTop + BLOCK_H / 2 + 1.6);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(level), 0, yTop + BLOCK_H / 2 + 0.4);
}

function hurdleSprite(ctx: Ctx, level: number): void {
  for (let i = 0; i < level; i++) block(ctx, -(i + 1) * BLOCK_H, level);
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

function bird(ctx: Ctx, x: number, y: number, t: number, seed: number): void {
  const flap = Math.sin(t * 17 + seed);
  ctx.save();
  ctx.translate(x, y + flap * 1.5);
  ctx.fillStyle = vGrad(ctx, -10, 10, [[0, '#8EC5FF'], [1, '#3B6FD8']]);
  ctx.beginPath();
  ctx.moveTo(9, -2);
  ctx.lineTo(18, -7);
  ctx.lineTo(16, 3);
  ctx.closePath();
  ctx.fill();
  oval(ctx, 0, 0, 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,80,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#EAF5FF';
  oval(ctx, -2, 4, 7, 5);
  ctx.fill();
  ctx.fillStyle = '#FFB627';
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.lineTo(-17, 1);
  ctx.lineTo(-10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, -5, -3, 3.8);
  ctx.fill();
  ctx.fillStyle = '#1E1B3A';
  circle(ctx, -6, -3, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,120,150,0.55)';
  oval(ctx, -6, 3, 2.4, 1.5);
  ctx.fill();
  ctx.fillStyle = '#2F5FC4';
  ctx.beginPath();
  ctx.moveTo(-1, -9);
  ctx.quadraticCurveTo(1, -15, 5, -12);
  ctx.quadraticCurveTo(2, -11, 1, -8);
  ctx.fill();
  wing(ctx, flap);
  ctx.restore();
}

function wing(ctx: Ctx, flap: number): void {
  ctx.fillStyle = '#5B93F0';
  ctx.strokeStyle = 'rgba(20,30,80,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1, -2);
  ctx.quadraticCurveTo(6, -4 - flap * 14, 13, -3 - flap * 12);
  ctx.quadraticCurveTo(10, 2, 3, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 163;
}

function groundShadow(ctx: Ctx, x: number, rx: number, alpha: number): void {
  ctx.fillStyle = `rgba(20,12,40,${alpha.toFixed(3)})`;
  oval(ctx, x, GROUND_Y + 1, rx, rx * 0.26);
  ctx.fill();
}

export function drawHurdles(ctx: Ctx, obs: readonly VisibleObstacle[], sprites: SpriteCache): void {
  for (const o of obs) {
    if (o.kind !== 'hurdle') continue;
    const lv: Level = o.level;
    groundShadow(ctx, o.x, 19, 0.3);
    const sp = sprites.get(HURDLE_KEYS[lv], 36, lv * BLOCK_H + 4, 18, lv * BLOCK_H + 2, hurdleSprite, lv);
    blit(ctx, sp, o.x, GROUND_Y - o.height);
  }
}

/** Birds and pickups (drawn in front of the player). */
export function drawFloaters(ctx: Ctx, obs: readonly VisibleObstacle[], t: number, sprites: SpriteCache): void {
  for (const o of obs) {
    if (o.kind === 'hurdle') continue;
    const seed = seedOf(o.id);
    const baseY = GROUND_Y - o.height;
    if (o.kind === 'bird') {
      groundShadow(ctx, o.x, 10, 0.16);
      bird(ctx, o.x, baseY - 10, t, seed);
      continue;
    }
    const y = baseY - 15 + Math.sin(t * 2.8 + seed) * 2.5;
    if (o.kind === 'coin') {
      const c = Math.cos(t * 4.5 + seed);
      const sx = Math.max(0.14, Math.abs(c));
      const sp = sprites.get('coin', 26, 26, 13, 13, coinSprite);
      if (sx < 0.5) {
        ctx.fillStyle = '#B86E00';
        roundRect(ctx, o.x - 2.4, y - 11, 4.8, 22, 2.4);
        ctx.fill();
      }
      blitScaled(ctx, sp, o.x, y, sx, 1);
      continue;
    }
    const idx = o.kind === 'shield' ? 0 : o.kind === 'slow' ? 1 : 2;
    const sp = sprites.get(PICK_KEYS[idx], 36, 36, 18, 18, pickupSprite, idx);
    const pulse = 1 + Math.sin(t * 5 + seed) * 0.04;
    blitScaled(ctx, sp, o.x, y, pulse, pulse);
  }
}
