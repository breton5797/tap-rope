// World 1 — 노을 해변: sunset gradient, huge banded sun, shimmering sea, palm silhouettes, sand.
import { GROUND_Y } from '../types';
import { blit, type SpriteCache } from './sprites';
import { wrapped, type TileSpec, type WorldArt } from './scenery';
import { circle, oval, radGrad, seeded, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

const HORIZON = 410;
const SUN_X = 180;
const SUN_Y = 396;

function palm(ctx: Ctx, bx: number, tx: number, ty: number, dir: number): void {
  ctx.lineCap = 'round';
  const midX = (bx + tx) / 2 - dir * 18;
  for (let i = 0; i < 2; i++) {
    ctx.strokeStyle = i === 0 ? '#2C1640' : 'rgba(255,140,110,0.35)';
    ctx.lineWidth = i === 0 ? 9 : 2;
    ctx.beginPath();
    ctx.moveTo(bx + (i ? dir * 3 : 0), GROUND_Y + 2);
    ctx.quadraticCurveTo(midX + (i ? dir * 3 : 0), (GROUND_Y + ty) / 2, tx + (i ? dir * 2 : 0), ty);
    ctx.stroke();
  }
  ctx.fillStyle = '#2A1440';
  const leaves = [-2.7, -2.2, -1.6, -1.0, -0.45, 0.1, 0.55];
  for (const a of leaves) {
    const len = 46 + Math.cos(a * 3) * 8;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.55 + 18;
    const nx = -Math.sin(a) * 9;
    const ny = Math.cos(a) * 9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2 + nx, (ty + ey) / 2 - 16 + ny, ex, ey);
    ctx.quadraticCurveTo((tx + ex) / 2 - nx * 0.2, (ty + ey) / 2 - 8, tx, ty);
    ctx.fill();
  }
  ctx.fillStyle = '#3B1E4E';
  circle(ctx, tx - 4, ty + 5, 4);
  ctx.fill();
  circle(ctx, tx + 4, ty + 6, 4);
  ctx.fill();
}

function sea(ctx: Ctx, v: View): void {
  ctx.fillStyle = vGrad(ctx, HORIZON, GROUND_Y, [[0, '#FFB089'], [0.18, '#E0708A'], [0.55, '#8C3D8A'], [1, '#4A2B78']]);
  ctx.fillRect(v.x0, HORIZON, v.w, GROUND_Y - HORIZON + 4);
  ctx.fillStyle = 'rgba(255,232,180,0.9)';
  ctx.fillRect(v.x0, HORIZON - 0.5, v.w, 1.5);
  const rnd = seeded(41);
  for (let i = 0; i < 70; i++) {
    const y = HORIZON + 4 + rnd() * rnd() * 52;
    const len = 4 + (y - HORIZON) * 0.4 * rnd();
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,200,170,0.28)' : 'rgba(60,20,90,0.25)';
    ctx.fillRect(v.x0 + rnd() * v.w, y, len, 1);
  }
  ctx.fillStyle = '#5A2C6E';
  ctx.beginPath();
  ctx.moveTo(v.x0 - 10, HORIZON + 1);
  ctx.quadraticCurveTo(v.x0 + 30, HORIZON - 14, v.x0 + 70, HORIZON - 6);
  ctx.quadraticCurveTo(v.x0 + 100, HORIZON - 12, v.x0 + 130, HORIZON + 1);
  ctx.fill();
}

function sand(ctx: Ctx, v: View): void {
  const bottom = v.y0 + v.h;
  ctx.fillStyle = vGrad(ctx, GROUND_Y, bottom, [[0, '#F9CB93'], [0.25, '#EDAE76'], [1, '#B97556']]);
  ctx.fillRect(v.x0, GROUND_Y, v.w, bottom - GROUND_Y);
  ctx.fillStyle = 'rgba(160,80,90,0.35)';
  ctx.fillRect(v.x0, GROUND_Y, v.w, 3);
  const rnd = seeded(8);
  ctx.strokeStyle = 'rgba(200,120,80,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 34; i++) {
    const x = v.x0 + rnd() * v.w;
    const y = GROUND_Y + 14 + rnd() * (bottom - GROUND_Y - 14);
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rnd() * 14, 2, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,215,0.45)';
  for (let i = 0; i < 140; i++) {
    circle(ctx, v.x0 + rnd() * v.w, GROUND_Y + 6 + rnd() * (bottom - GROUND_Y), 0.7);
    ctx.fill();
  }
  starfish(ctx, 300, 512);
  ctx.fillStyle = '#FFE3EC';
  oval(ctx, 74, 518, 6, 4.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,120,140,0.7)';
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(74, 522);
    ctx.lineTo(74 + i * 2.6, 514);
  }
  ctx.stroke();
}

function starfish(ctx: Ctx, x: number, y: number): void {
  ctx.fillStyle = '#FF7A6B';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2 + 0.2;
    const r = i % 2 === 0 ? 8 : 3.4;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,200,0.8)';
  circle(ctx, x, y, 1.2);
  ctx.fill();
}

function drawScene(ctx: Ctx, v: View): void {
  sea(ctx, v);
  sand(ctx, v);
  palm(ctx, 14, 36, 300, 1);
  palm(ctx, 350, 330, 326, -1);
  palm(ctx, v.x0 + v.w + 6, v.x0 + v.w - 8, 350, -1);
}

const STREAKS: TileSpec = {
  y: 30,
  h: 320,
  w: 620,
  speed: 6,
  draw(ctx, w) {
    const rnd = seeded(19);
    for (let i = 0; i < 8; i++) {
      const x = rnd() * w;
      const y = 70 + rnd() * 250;
      const rx = 50 + rnd() * 70;
      const ry = 4 + rnd() * 5;
      const g = vGrad(ctx, y - ry, y + ry, [[0, 'rgba(255,190,150,0.85)'], [1, 'rgba(150,60,130,0.7)']]);
      wrapped(x, w, (xx) => {
        ctx.fillStyle = g;
        oval(ctx, xx, y, rx, ry);
        ctx.fill();
        oval(ctx, xx + rx * 0.35, y - ry * 0.9, rx * 0.5, ry * 0.8);
        ctx.fill();
      });
    }
  },
};

function sunSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 30, 170, [[0, 'rgba(255,220,140,0.75)'], [0.4, 'rgba(255,150,110,0.3)'], [1, 'rgba(255,120,120,0)']]);
  circle(ctx, 0, 0, 170);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, -50, 50, [[0, '#FFF4B8'], [0.5, '#FFC56A'], [1, '#FF7E57']]);
  circle(ctx, 0, 0, 50);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) {
    const y = 6 + i * 8;
    ctx.fillRect(-52, y, 104, 1.4 + i * 0.7);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function shimmer(ctx: Ctx, t: number): void {
  ctx.fillStyle = '#FFE6A8';
  for (let i = 0; i < 20; i++) {
    const y = HORIZON + 2 + i * 2.7;
    const spread = 14 + i * 2.6;
    for (let j = 0; j < 2; j++) {
      const off = Math.sin(t * 1.7 + i * 1.9 + j * 2.4) * spread * 0.55;
      ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3.6 + i * 2.2 + j));
      ctx.fillRect(SUN_X + off - (6 + i * 0.5), y, 12 + i, 1.2);
    }
  }
  ctx.globalAlpha = 1;
}

function foam(ctx: Ctx, v: View, t: number): void {
  const x1 = v.x0 + v.w + 12;
  ctx.beginPath();
  ctx.moveTo(v.x0, GROUND_Y + 2);
  for (let x = v.x0; x <= x1; x += 12) {
    ctx.lineTo(x, GROUND_Y - 7 + 2.2 * Math.sin(x * 0.045 + t * 1.6) + 1.3 * Math.sin(x * 0.11 - t * 2.2));
  }
  ctx.lineTo(x1, GROUND_Y + 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,236,226,0.5)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let x = v.x0; x <= x1; x += 12) {
    const y = GROUND_Y - 7 + 2.2 * Math.sin(x * 0.045 + t * 1.6) + 1.3 * Math.sin(x * 0.11 - t * 2.2);
    if (x === v.x0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function gulls(ctx: Ctx, v: View, t: number): void {
  ctx.strokeStyle = 'rgba(42,22,64,0.75)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const span = v.w + 120;
  for (let i = 0; i < 3; i++) {
    const x = v.x0 - 60 + ((t * (11 + i * 2) + i * 150) % span);
    const y = 205 + i * 22 + Math.sin(t * 0.8 + i) * 6;
    const k = 2.5 + 2.5 * Math.sin(t * 6 + i * 2);
    const s = 6 - i;
    ctx.moveTo(x - s, y - k);
    ctx.quadraticCurveTo(x - s * 0.4, y - k * 0.2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - k * 0.2, x + s, y - k);
  }
  ctx.stroke();
}

export const BEACH: WorldArt = {
  sky: [[0, '#2A1858'], [0.3, '#682C7E'], [0.58, '#D2477C'], [0.82, '#FF8A5C'], [1, '#FFC879']],
  skyTo: HORIZON,
  tiles: [STREAKS],
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    const sp = sprites.get('w1sun', 340, 340, 170, 170, sunSprite);
    ctx.globalAlpha = 0.94 + 0.06 * Math.sin(t * 1.3);
    blit(ctx, sp, SUN_X, SUN_Y);
    ctx.globalAlpha = 1;
  },
  front(ctx: Ctx, v: View, t: number) {
    gulls(ctx, v, t);
    shimmer(ctx, t);
    foam(ctx, v, t);
  },
};
