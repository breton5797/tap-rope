// World 3 — 달 기지: deep space, twinkling stars, Earth, moon base domes, grey cratered regolith.
import { GROUND_Y } from '../types';
import { blit, type SpriteCache } from './sprites';
import { starField, type TileSpec, type WorldArt } from './scenery';
import { circle, oval, radGrad, roundRect, seeded, starPath, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

const EARTH_X = 76;
const EARTH_Y = 112;
const ANTENNA_X = 300;
const ANTENNA_TOP = 392;

function mountains(ctx: Ctx, v: View): void {
  const rnd = seeded(14);
  ctx.beginPath();
  ctx.moveTo(v.x0, GROUND_Y + 2);
  let x = v.x0;
  while (x < v.x0 + v.w + 20) {
    ctx.lineTo(x, 440 - rnd() * 34);
    x += 14 + rnd() * 22;
  }
  ctx.lineTo(x, GROUND_Y + 2);
  ctx.closePath();
  ctx.fillStyle = vGrad(ctx, 400, GROUND_Y, [[0, '#4A5482'], [1, '#2B3358']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,205,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function dome(ctx: Ctx, x: number, r: number): void {
  const y = GROUND_Y - 4;
  ctx.fillStyle = '#B9C2DA';
  roundRect(ctx, x - r - 4, y - 3, r * 2 + 8, 8, 3);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, x, y, 2, r, [[0, 'rgba(255,214,140,0.75)'], [0.6, 'rgba(140,200,255,0.35)'], [1, 'rgba(170,220,255,0.5)']]);
  ctx.beginPath();
  ctx.arc(x, y - 2, r, Math.PI, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,235,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(x - r, y - 2);
    ctx.quadraticCurveTo(x - r + (i * r) / 2, y - 2 - r * 1.3, x + r * (i / 2 - 1) + r, y - 2);
  }
  ctx.ellipse(x, y - 2 - r * 0.45, r * 0.9, r * 0.12, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 2, r - 4, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
}

function base(ctx: Ctx): void {
  ctx.fillStyle = '#9AA4C2';
  roundRect(ctx, 130, GROUND_Y - 16, 112, 9, 4.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,150,0.8)';
  for (let x = 140; x < 236; x += 12) {
    roundRect(ctx, x, GROUND_Y - 14, 5, 4, 2);
    ctx.fill();
  }
  dome(ctx, 112, 34);
  dome(ctx, 262, 24);
  ctx.strokeStyle = '#8E98B8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(ANTENNA_X - 8, GROUND_Y - 2);
  ctx.lineTo(ANTENNA_X, ANTENNA_TOP + 4);
  ctx.lineTo(ANTENNA_X + 8, GROUND_Y - 2);
  for (let y = GROUND_Y - 12; y > ANTENNA_TOP + 10; y -= 12) {
    const hw = ((y - ANTENNA_TOP) / (GROUND_Y - ANTENNA_TOP)) * 8;
    ctx.moveTo(ANTENNA_X - hw, y);
    ctx.lineTo(ANTENNA_X + hw, y - 6);
  }
  ctx.stroke();
  ctx.fillStyle = '#C7CFE6';
  ctx.beginPath();
  ctx.ellipse(ANTENNA_X - 2, ANTENNA_TOP + 12, 9, 4, -0.5, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#3B5BA8';
  ctx.strokeStyle = '#B7C1DD';
  ctx.lineWidth = 1;
  for (const px of [6, 330]) {
    ctx.fillRect(px, GROUND_Y - 26, 24, 14);
    ctx.strokeRect(px, GROUND_Y - 26, 24, 14);
    ctx.beginPath();
    ctx.moveTo(px + 12, GROUND_Y - 12);
    ctx.lineTo(px + 12, GROUND_Y);
    ctx.stroke();
  }
}

function crater(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(40,46,72,0.45)';
  oval(ctx, x, y, r, r * 0.32);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,128,156,0.9)';
  oval(ctx, x, y + r * 0.06, r * 0.86, r * 0.24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,236,250,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.32, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

function regolith(ctx: Ctx, v: View): void {
  const bottom = v.y0 + v.h;
  ctx.fillStyle = vGrad(ctx, GROUND_Y, bottom, [[0, '#B4BACF'], [0.25, '#8E95AE'], [1, '#4F5572']]);
  ctx.fillRect(v.x0, GROUND_Y, v.w, bottom - GROUND_Y);
  ctx.fillStyle = '#D9DEEC';
  ctx.fillRect(v.x0, GROUND_Y - 1, v.w, 2);
  const rnd = seeded(23);
  for (let i = 0; i < 14; i++) {
    const x = v.x0 + rnd() * v.w;
    const y = GROUND_Y + 20 + rnd() * (bottom - GROUND_Y - 20);
    if (Math.abs(x - 180) < 60 && y < 500) continue;
    crater(ctx, x, y, 8 + rnd() * 18 * ((y - GROUND_Y) / 120 + 0.4));
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(60,66,92,0.5)' : 'rgba(235,240,255,0.5)';
    circle(ctx, v.x0 + rnd() * v.w, GROUND_Y + 4 + rnd() * (bottom - GROUND_Y), 0.5 + rnd());
    ctx.fill();
  }
}

function drawScene(ctx: Ctx, v: View): void {
  starField(ctx, seeded(2), v.x0, v.y0, v.w, 440 - v.y0, 170, 1.1);
  ctx.fillStyle = radGrad(ctx, 250, 170, 0, 140, [[0, 'rgba(150,90,255,0.2)'], [1, 'rgba(150,90,255,0)']]);
  ctx.fillRect(v.x0, v.y0, v.w, 420 - v.y0);
  ctx.fillStyle = radGrad(ctx, 300, 260, 0, 110, [[0, 'rgba(60,200,255,0.14)'], [1, 'rgba(60,200,255,0)']]);
  ctx.fillRect(v.x0, v.y0, v.w, 420 - v.y0);
  mountains(ctx, v);
  base(ctx);
  regolith(ctx, v);
}

function earthSprite(ctx: Ctx): void {
  const r = 30;
  ctx.fillStyle = radGrad(ctx, 0, 0, r * 0.9, r * 1.8, [[0, 'rgba(120,190,255,0.5)'], [1, 'rgba(120,190,255,0)']]);
  circle(ctx, 0, 0, r * 1.8);
  ctx.fill();
  ctx.save();
  circle(ctx, 0, 0, r);
  ctx.clip();
  ctx.fillStyle = radGrad(ctx, -8, -10, 2, r * 1.2, [[0, '#7CC8FF'], [1, '#1D57B8']]);
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = '#4CC46A';
  for (const [x, y, rx, ry, a] of [[-10, -8, 11, 7, 0.5], [8, 6, 9, 12, -0.3], [-14, 14, 6, 4, 0.2], [14, -16, 7, 4, 0.8]] as const) {
    oval(ctx, x, y, rx, ry, a);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, rx] of [[-4, -18, 12], [10, 0, 10], [-16, 6, 8], [2, 20, 12]] as const) {
    oval(ctx, x, y, rx, 2.6, -0.2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(5,10,40,0.55)';
  circle(ctx, 16, 10, r * 1.05);
  ctx.fill();
  ctx.restore();
}

const BRIGHT_STARS: TileSpec = {
  y: -140,
  h: 560,
  w: 620,
  speed: 2.5,
  draw(ctx, w) {
    starField(ctx, seeded(31), 0, -140, w, 540, 46, 1.9);
  },
};

function twinkle(ctx: Ctx, t: number): void {
  const rnd = seeded(66);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 9; i++) {
    const x = 20 + rnd() * 320;
    const y = 20 + rnd() * 300;
    const a = 0.5 + 0.5 * Math.sin(t * (1.2 + rnd()) + i * 1.7);
    ctx.globalAlpha = a;
    starPath(ctx, x, y, 2.5 + a * 2.5, 0.7, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function shootingStar(ctx: Ctx, t: number): void {
  const cyc = t % 7.5;
  if (cyc > 0.7) return;
  const p = cyc / 0.7;
  const n = Math.floor(t / 7.5);
  const sx = 40 + ((n * 97) % 220);
  const x = sx + p * 170;
  const y = 40 + ((n * 53) % 90) + p * 70;
  const g = ctx.createLinearGradient(x - 48, y - 20, x, y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(255,255,255,${(1 - p).toFixed(2)})`);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - 48, y - 20);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function satellite(ctx: Ctx, t: number): void {
  const cyc = (t % 40) / 40;
  const x = 420 - cyc * 480;
  const y = 236 + Math.sin(cyc * 6) * 8;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25 + t * 0.05);
  ctx.fillStyle = '#3B5BA8';
  ctx.fillRect(-15, -3, 9, 6);
  ctx.fillRect(6, -3, 9, 6);
  ctx.fillStyle = '#C9D1E6';
  roundRect(ctx, -5, -4, 10, 8, 2);
  ctx.fill();
  ctx.fillStyle = (t % 1) < 0.2 ? '#FF4D5E' : '#6A2A3A';
  circle(ctx, 0, -5.5, 1.3);
  ctx.fill();
  ctx.restore();
}

export const MOON: WorldArt = {
  sky: [[0, '#01020B'], [0.5, '#060C2C'], [0.85, '#14204E'], [1, '#27346B']],
  skyTo: GROUND_Y - 10,
  tiles: [BRIGHT_STARS],
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    blit(ctx, sprites.get('w3earth', 112, 112, 56, 56, earthSprite), EARTH_X, EARTH_Y + Math.sin(t * 0.4) * 2);
  },
  front(ctx: Ctx, _v: View, t: number) {
    twinkle(ctx, t);
    shootingStar(ctx, t);
    satellite(ctx, t);
    const on = (t % 1.6) < 0.8;
    ctx.fillStyle = on ? '#FF4D5E' : '#6A2A3A';
    circle(ctx, ANTENNA_X, ANTENNA_TOP + 2, on ? 2.6 : 2);
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,77,94,0.25)';
      circle(ctx, ANTENNA_X, ANTENNA_TOP + 2, 7);
      ctx.fill();
    }
  },
};
