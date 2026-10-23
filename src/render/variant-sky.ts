// Sky pieces for look variants: moon, low autumn sun, eclipse corona, rainbow arch,
// star tile and storm clouds. Everything heavy is a cached sprite.
import type { WorldId } from '../types';
import { HORIZON_Y } from './projection';
import { cloud, starField, type TileSpec } from './scenery';
import { blit, type SpriteCache } from './sprites';
import { circle, radGrad, seeded, TAU, type Ctx } from './util';
import type { View } from './view';

export const STARS: TileSpec = {
  y: -140,
  h: 250,
  w: 620,
  speed: 1.5,
  draw(ctx, w) {
    starField(ctx, seeded(57), 0, -140, w, 240, 70, 1.5);
  },
};

function moonSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 10, 60, [[0, 'rgba(220,230,255,0.55)'], [0.4, 'rgba(180,200,255,0.18)'], [1, 'rgba(180,200,255,0)']]);
  circle(ctx, 0, 0, 60);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -4, -5, 2, 18, [[0, '#FFFDF2'], [0.7, '#F3EBCB'], [1, '#D9CFA6']]);
  circle(ctx, 0, 0, 16);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,160,120,0.35)';
  for (const [x, y, r] of [[-5, -3, 3.4], [5, 4, 2.6], [3, -7, 1.8], [-3, 7, 1.6]] as const) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
}

export function moonAt(world: WorldId): readonly [number, number] {
  return world === 1 ? [180, 58] : [292, 26];
}

export function drawMoon(ctx: Ctx, world: WorldId, t: number, sprites: SpriteCache): void {
  const [x, y] = moonAt(world);
  blit(ctx, sprites.get('vMoon', 120, 120, 60, 60, moonSprite), x, y + Math.sin(t * 0.3) * 1.2);
}

function warmSunSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 10, 110, [[0, 'rgba(255,214,140,0.85)'], [0.35, 'rgba(255,160,80,0.35)'], [1, 'rgba(255,140,60,0)']]);
  circle(ctx, 0, 0, 110);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -6, -8, 2, 30, [[0, '#FFF6D6'], [0.6, '#FFC45E'], [1, '#FF8F3C']]);
  circle(ctx, 0, 0, 28);
  ctx.fill();
}

export function drawWarmSun(ctx: Ctx, t: number, sprites: SpriteCache): void {
  ctx.globalAlpha = 0.95 + 0.05 * Math.sin(t * 1.1);
  blit(ctx, sprites.get('vWarmSun', 220, 220, 110, 110, warmSunSprite), 270, HORIZON_Y - 26);
  ctx.globalAlpha = 1;
}

function coronaSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 20, 90, [[0, 'rgba(255,240,220,0.95)'], [0.3, 'rgba(255,170,120,0.45)'], [0.6, 'rgba(255,80,140,0.18)'], [1, 'rgba(255,60,140,0)']]);
  circle(ctx, 0, 0, 90);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,210,0.35)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  const rnd = seeded(77);
  ctx.beginPath();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + rnd() * 0.1;
    const len = 30 + rnd() * 34;
    ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
  }
  ctx.stroke();
  ctx.fillStyle = '#0A0412';
  circle(ctx, 0, 0, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,170,0.9)';
  ctx.lineWidth = 1.6;
  circle(ctx, 0, 0, 22.5);
  ctx.stroke();
}

export function drawEclipse(ctx: Ctx, world: WorldId, t: number, sprites: SpriteCache): void {
  const x = world === 3 ? 74 : 180;
  const y = world === 3 ? 30 : 34;
  blit(ctx, sprites.get('vCorona', 180, 180, 90, 90, coronaSprite), x, y);
  const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
  const fx = x + 16;
  const fy = y - 16;
  ctx.fillStyle = `rgba(255,255,255,${(0.35 * pulse).toFixed(3)})`;
  circle(ctx, fx, fy, 6 + pulse * 3);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  circle(ctx, fx, fy, 2.2);
  ctx.fill();
}

const RAINBOW = ['#FF9AA8', '#FFC48A', '#FFE98A', '#A8EBA0', '#9AD4FF', '#B9A6FF'];

function rainbowSprite(ctx: Ctx): void {
  const bw = 7;
  ctx.lineCap = 'butt';
  for (let i = 0; i < RAINBOW.length; i++) {
    ctx.strokeStyle = RAINBOW[i];
    ctx.lineWidth = bw + 0.8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, 190 - i * bw, Math.PI, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 196, Math.PI, TAU);
  ctx.stroke();
}

export function drawRainbowArch(ctx: Ctx, sprites: SpriteCache): void {
  blit(ctx, sprites.get('vRainbow', 400, 210, 200, 205, rainbowSprite), 180, HORIZON_Y + 8);
}

/** Static storm-cloud blanket over the sky band (baked into the scene canvas). */
export function stormClouds(ctx: Ctx, v: View): void {
  const g = ctx.createLinearGradient(0, v.y0, 0, HORIZON_Y);
  g.addColorStop(0, 'rgba(10,10,24,0.95)');
  g.addColorStop(1, 'rgba(40,36,70,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.w, HORIZON_Y - 18 - v.y0);
  const rnd = seeded(61);
  for (let i = 0; i < 16; i++) {
    const x = v.x0 + rnd() * v.w;
    const y = v.y0 + 20 + rnd() * (HORIZON_Y - 40 - v.y0);
    cloud(ctx, x, y, 26 + rnd() * 26, 'rgba(70,66,100,0.85)', 'rgba(24,22,44,0.9)');
  }
}
