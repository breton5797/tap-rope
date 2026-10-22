// In-world obstacles in perspective: full-width block fences, rainbow rings, rolling
// beach balls, overhead birds and floating pickups. Sprites are built at depth 1 and
// scaled by depthScale(z) (every obstacle sits at a single depth).
import { LANE_W, type Level, type VisibleObstacle } from '../types';
import { bubble, clockIcon, coinFace, heartIcon, shieldIcon } from './icons';
import { depthScale, groundRy, groundY, HEIGHT_K, screenX, screenY } from './projection';
import { blitScaled, type SpriteCache } from './sprites';
import { circle, FONT, LEVEL_DARK, LEVEL_FILL, LEVEL_LIGHT, oval, roundRect, starPath, vGrad, type Ctx } from './util';

const BLOCK_H = 22 * HEIGHT_K;
const TOP_D = 8;
const FENCE_HALF = LANE_W * 1.5 + 4;
const BLOCKS = 5;
const RING_R = 132;
const RING_BANDS = ['#FF5E5B', '#FF9F43', '#FFD23F', '#3DDC97', '#3BB8FF', '#7B61FF'];
const BALL_R = 26;
const HURDLE_KEYS = ['', 'fence1', 'fence2', 'fence3'];
const PICK_KEYS = ['pick0', 'pick1', 'pick2'];

function block(ctx: Ctx, x: number, yTop: number, w: number, level: number, numeral: boolean): void {
  ctx.fillStyle = LEVEL_LIGHT[level];
  ctx.beginPath();
  ctx.moveTo(x + 3, yTop);
  ctx.lineTo(x + w - 3, yTop);
  ctx.lineTo(x + w - 6, yTop - TOP_D);
  ctx.lineTo(x + 6, yTop - TOP_D);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, yTop, yTop + BLOCK_H, [[0, LEVEL_FILL[level]], [1, LEVEL_DARK[level]]]);
  roundRect(ctx, x + 1, yTop, w - 2, BLOCK_H, 4);
  ctx.fill();
  ctx.strokeStyle = LEVEL_DARK[level];
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, x + 4, yTop + 2, w - 8, 3, 1.5);
  ctx.fill();
  if (!numeral) return;
  ctx.font = `900 14px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = LEVEL_DARK[level];
  ctx.fillText(String(level), x + w / 2, yTop + BLOCK_H / 2 + 1.8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(level), x + w / 2, yTop + BLOCK_H / 2 + 0.6);
}

function fenceSprite(ctx: Ctx, level: number): void {
  const w = (FENCE_HALF * 2) / BLOCKS;
  for (let r = 0; r < level; r++) {
    const yTop = -(r + 1) * BLOCK_H;
    for (let i = 0; i < BLOCKS; i++) {
      block(ctx, -FENCE_HALF + i * w, yTop, w, level, r === level - 1);
    }
  }
}

function ringSprite(ctx: Ctx): void {
  const bw = 4.6;
  ctx.lineCap = 'butt';
  for (let i = 0; i < RING_BANDS.length; i++) {
    const r = RING_R - i * bw;
    ctx.strokeStyle = RING_BANDS[i];
    ctx.lineWidth = bw + 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * HEIGHT_K, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, RING_R + 2.6, (RING_R + 2.6) * HEIGHT_K, 0, Math.PI * 1.08, Math.PI * 1.45);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, s * (RING_R - 13) - 9, -6, 18, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,190,255,0.9)';
    roundRect(ctx, s * (RING_R - 13) - 9, -2, 18, 3, 1.5);
    ctx.fill();
  }
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

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 163;
}

const BALL_COLS = ['#FF5E5B', '#FFFFFF', '#FFD23F', '#FFFFFF', '#3BB8FF', '#FFFFFF'];

function ball(ctx: Ctx, x: number, y: number, r: number, roll: number): void {
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    const a = roll + (i / 6) * Math.PI * 2;
    ctx.fillStyle = BALL_COLS[i];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a, a + Math.PI / 3 + 0.02);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(40,20,80,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, x, y, r * 0.16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,80,0.55)';
  ctx.lineWidth = 1.2;
  circle(ctx, x, y, r);
  ctx.stroke();
}

/** Front-facing bird flying toward the camera, wings flapping. */
function bird(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number): void {
  const flap = Math.sin(t * 16 + seed);
  ctx.save();
  ctx.translate(x, y + flap * 1.5 * s);
  ctx.scale(s * 1.15, s * 1.15);
  ctx.fillStyle = '#5B93F0';
  ctx.strokeStyle = 'rgba(20,30,80,0.55)';
  ctx.lineWidth = 1;
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(d * 8, -3);
    ctx.quadraticCurveTo(d * 20, -8 - flap * 10, d * 30, -4 - flap * 14);
    ctx.quadraticCurveTo(d * 20, 4 - flap * 4, d * 8, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = vGrad(ctx, -12, 12, [[0, '#8EC5FF'], [1, '#3B6FD8']]);
  circle(ctx, 0, 0, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#EAF5FF';
  oval(ctx, 0, 4, 6.5, 5);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  for (const d of [-1, 1]) {
    circle(ctx, d * 4.2, -3, 3.4);
    ctx.fill();
  }
  ctx.fillStyle = '#1E1B3A';
  for (const d of [-1, 1]) {
    circle(ctx, d * 4, -2.6, 1.8);
    ctx.fill();
  }
  ctx.fillStyle = '#FFB627';
  ctx.beginPath();
  ctx.moveTo(-2.6, 1);
  ctx.lineTo(2.6, 1);
  ctx.lineTo(0, 5.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2F5FC4';
  ctx.beginPath();
  ctx.moveTo(-2, -10);
  ctx.quadraticCurveTo(0, -17, 4, -13);
  ctx.quadraticCurveTo(1, -12, 1, -9);
  ctx.fill();
  ctx.restore();
}

function laneX(o: VisibleObstacle): number {
  return o.kind === 'hurdle' || o.kind === 'ring' || o.kind === 'bird' ? 0 : o.lane * LANE_W;
}

/** Soft ground shadows for every obstacle (drawn before anything stands on the ground). */
export function drawObstacleShadows(ctx: Ctx, obs: readonly VisibleObstacle[]): void {
  for (const o of obs) {
    const s = depthScale(o.z);
    const x = screenX(laneX(o), o.z);
    const y = groundY(o.z);
    let rx = 14;
    let a = 0.2;
    if (o.kind === 'hurdle') rx = FENCE_HALF + 6;
    else if (o.kind === 'ball') rx = BALL_R;
    else if (o.kind === 'ring') continue;
    else if (o.kind === 'bird') a = 0.16;
    else rx = 10;
    const lift = 1 / (1 + o.height / 80);
    ctx.fillStyle = `rgba(20,12,40,${(a * lift + 0.08).toFixed(3)})`;
    oval(ctx, x, y + 1, rx * s * lift, groundRy(o.z, o.kind === 'hurdle' ? 9 : rx * 0.8) * lift);
    ctx.fill();
  }
}

function drawOne(ctx: Ctx, o: VisibleObstacle, t: number, sprites: SpriteCache): void {
  const s = depthScale(o.z);
  const x = screenX(laneX(o), o.z);
  if (o.kind === 'hurdle') {
    const lv: Level = o.level;
    const h = lv * BLOCK_H + TOP_D + 4;
    blitScaled(ctx, sprites.get(HURDLE_KEYS[lv], FENCE_HALF * 2 + 4, h, FENCE_HALF + 2, h - 2, fenceSprite, lv), x, groundY(o.z), s, s);
    return;
  }
  if (o.kind === 'ring') {
    const h = RING_R * HEIGHT_K + 10;
    blitScaled(ctx, sprites.get('ring', RING_R * 2 + 10, h + 4, RING_R + 5, h, ringSprite), x, groundY(o.z), s, s);
    ringSparkles(ctx, x, groundY(o.z), s, t);
    return;
  }
  const seed = seedOf(o.id);
  if (o.kind === 'ball') {
    const bounce = Math.abs(Math.sin(t * 7 + seed)) * 4;
    ball(ctx, x, screenY(o.z, BALL_R + bounce), BALL_R * s, -o.z / BALL_R);
    return;
  }
  if (o.kind === 'bird') {
    bird(ctx, x, screenY(o.z, o.height + 10), s, t, seed);
    return;
  }
  const y = screenY(o.z, o.height + 15) + Math.sin(t * 2.8 + seed) * 2.5 * s;
  if (o.kind === 'coin') {
    const sx = Math.max(0.14, Math.abs(Math.cos(t * 4.5 + seed)));
    blitScaled(ctx, sprites.get('coin', 26, 26, 13, 13, coinSprite), x, y, sx * s, s);
    return;
  }
  const idx = o.kind === 'shield' ? 0 : o.kind === 'slow' ? 1 : 2;
  const pulse = (1 + Math.sin(t * 5 + seed) * 0.04) * s;
  blitScaled(ctx, sprites.get(PICK_KEYS[idx], 36, 36, 18, 18, pickupSprite, idx), x, y, pulse, pulse);
}

function ringSparkles(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + ((i + 0.5) / 6) * Math.PI;
    const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.9);
    ctx.globalAlpha = tw;
    starPath(ctx, x + Math.cos(a) * (RING_R + 8) * s, y + Math.sin(a) * (RING_R + 8) * HEIGHT_K * s, (2 + tw * 3) * s, 0.8 * s, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const order: number[] = [];

/** Draw obstacles with zMin < z <= zMax, far → near. */
export function drawObstacles(
  ctx: Ctx, obs: readonly VisibleObstacle[], zMin: number, zMax: number, t: number, sprites: SpriteCache,
): void {
  order.length = 0;
  for (let i = 0; i < obs.length; i++) if (obs[i].z > zMin && obs[i].z <= zMax) order.push(i);
  order.sort((a, b) => obs[b].z - obs[a].z);
  for (const i of order) drawOne(ctx, obs[i], t, sprites);
}
