// World 0 — 놀이터 (oblique top-down): sunny sky band, hills on the horizon,
// mowed lawn, a sandy 3-lane path, trees / slide / swings / flowers along the sides.
import { blit, type SpriteCache } from './sprites';
import { HORIZON_Y } from './projection';
import {
  billboard, cloud, groundBands, groundFill, groundOval, groundQuad, horizonHaze, laneDashes,
  sideProps, TRACK_HALF, wrapped, Z_FAR, Z_NEAR, type TileSpec, type WorldArt,
} from './scenery';
import { circle, radGrad, roundRect, seeded, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

function hills(ctx: Ctx, v: View): void {
  const layers: readonly (readonly [number, number, string, string])[] = [
    [HORIZON_Y - 22, 10, '#B9E6B0', '#A2D99A'],
    [HORIZON_Y - 10, 7, '#8FD27F', '#76C26C'],
  ];
  for (const [base, amp, c0, c1] of layers) {
    ctx.beginPath();
    ctx.moveTo(v.x0, HORIZON_Y + 1);
    for (let x = v.x0; x <= v.x0 + v.w + 8; x += 8) {
      ctx.lineTo(x, base - amp * (0.6 * Math.sin(x * 0.03 + base) + 0.4 * Math.sin(x * 0.071)));
    }
    ctx.lineTo(v.x0 + v.w + 8, HORIZON_Y + 1);
    ctx.closePath();
    ctx.fillStyle = vGrad(ctx, base - amp, HORIZON_Y, [[0, c0], [1, c1]]);
    ctx.fill();
  }
  const rnd = seeded(12);
  for (let x = v.x0 + 6; x < v.x0 + v.w; x += 9 + rnd() * 16) {
    const r = 3 + rnd() * 4;
    ctx.fillStyle = rnd() < 0.5 ? '#5DB35E' : '#4A9E52';
    circle(ctx, x, HORIZON_Y - r * 0.6, r);
    ctx.fill();
  }
}

function tree(ctx: Ctx, s: number): void {
  ctx.fillStyle = 'rgba(30,70,20,0.28)';
  ctx.beginPath();
  ctx.ellipse(4, 0, 26 * s, 8 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8A5A3B';
  roundRect(ctx, -4 * s, -26 * s, 8 * s, 27 * s, 3 * s);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -10 * s, -58 * s, 4 * s, 40 * s, [[0, '#B4F08F'], [0.55, '#62C35A'], [1, '#3A9447']]);
  ctx.beginPath();
  ctx.arc(-12 * s, -38 * s, 17 * s, 0, TAU);
  ctx.arc(12 * s, -40 * s, 16 * s, 0, TAU);
  ctx.moveTo(20 * s, -54 * s);
  ctx.arc(0, -54 * s, 20 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  circle(ctx, -7 * s, -63 * s, 5 * s);
  ctx.fill();
}

function bush(ctx: Ctx, s: number): void {
  ctx.fillStyle = 'rgba(30,70,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 0, 20 * s, 6 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -6 * s, -16 * s, 2 * s, 22 * s, [[0, '#9EE57E'], [1, '#43A04A']]);
  ctx.beginPath();
  ctx.arc(-9 * s, -8 * s, 10 * s, 0, TAU);
  ctx.arc(9 * s, -8 * s, 10 * s, 0, TAU);
  ctx.moveTo(12 * s, -14 * s);
  ctx.arc(0, -14 * s, 12 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FF8FB1';
  for (const [x, y] of [[-8, -14], [6, -20], [10, -8]] as const) {
    circle(ctx, x * s, y * s, 2 * s);
    ctx.fill();
  }
}

function slide(ctx: Ctx): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6E9BD0';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (const x of [-30, -16]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, -52);
  }
  for (let i = 1; i < 5; i++) {
    ctx.moveTo(-30, -i * 10);
    ctx.lineTo(-16, -i * 10);
  }
  ctx.stroke();
  ctx.fillStyle = '#FFC93C';
  roundRect(ctx, -34, -58, 24, 7, 3);
  ctx.fill();
  ctx.strokeStyle = '#FF7A6B';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.bezierCurveTo(4, -48, 8, -6, 34, -3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function swings(ctx: Ctx): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7C6CE0';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(-34, -56);
  ctx.lineTo(-28, 0);
  ctx.moveTo(28, 0);
  ctx.lineTo(34, -56);
  ctx.lineTo(40, 0);
  ctx.moveTo(-36, -56);
  ctx.lineTo(36, -56);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,70,100,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const x of [-14, 14]) {
    ctx.moveTo(x - 5, -55);
    ctx.lineTo(x - 5, -16);
    ctx.moveTo(x + 5, -55);
    ctx.lineTo(x + 5, -16);
  }
  ctx.stroke();
  ctx.fillStyle = '#FFB627';
  for (const x of [-14, 14]) {
    roundRect(ctx, x - 7, -18, 14, 4, 2);
    ctx.fill();
  }
}

function flowers(ctx: Ctx, rnd: () => number): void {
  const petals = ['#FFFFFF', '#FFE066', '#FF9EC4'];
  for (let i = 0; i < 110; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (TRACK_HALF + 14 + rnd() * 260);
    const z = -120 + rnd() * rnd() * 1400;
    ctx.fillStyle = petals[i % 3];
    groundOval(ctx, x, z, 3.2, 3.2);
    ctx.fill();
  }
}

function track(ctx: Ctx): void {
  ctx.fillStyle = '#E6C084';
  groundQuad(ctx, -TRACK_HALF - 6, TRACK_HALF + 6, Z_NEAR, Z_FAR);
  ctx.fill();
  ctx.fillStyle = '#F6DDAA';
  groundQuad(ctx, -TRACK_HALF, TRACK_HALF, Z_NEAR, Z_FAR);
  ctx.fill();
  groundBands(ctx, -TRACK_HALF, TRACK_HALF, 60, 'rgba(255,255,255,0.13)');
  laneDashes(ctx, 'rgba(255,255,255,0.85)', 3, 34, 30, false);
  ctx.fillStyle = 'rgba(205,160,95,0.55)';
  const rnd = seeded(5);
  for (let i = 0; i < 140; i++) {
    groundOval(ctx, (rnd() - 0.5) * TRACK_HALF * 2, -200 + rnd() * rnd() * 2000, 1.4, 1.4);
    ctx.fill();
  }
}

function props(ctx: Ctx): void {
  const list = sideProps(seeded(3), 3, -260, 2600, 120, TRACK_HALF + 50, TRACK_HALF + 230);
  for (const p of list) {
    billboard(ctx, p.x, p.z, p.size);
    if (p.kind === 0) bush(ctx, 1);
    else tree(ctx, 1);
    ctx.restore();
  }
  billboard(ctx, -250, 520, 1);
  slide(ctx);
  ctx.restore();
  billboard(ctx, 260, 360, 1);
  swings(ctx);
  ctx.restore();
}

function drawScene(ctx: Ctx, v: View): void {
  hills(ctx, v);
  groundFill(ctx, v, [[0, '#A9E38B'], [0.25, '#7ED15E'], [1, '#4EA43F']]);
  groundBands(ctx, -3000, 3000, 70, 'rgba(255,255,255,0.08)');
  flowers(ctx, seeded(8));
  track(ctx);
  horizonHaze(ctx, v, 'rgba(235,248,255,0.55)', 36);
  props(ctx);
}

const CLOUDS: TileSpec = {
  y: -90,
  h: 190,
  w: 560,
  speed: 7,
  draw(ctx, w) {
    const rnd = seeded(11);
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w;
      const y = -50 + rnd() * 120;
      const s = 12 + rnd() * 14;
      wrapped(x, w, (xx) => cloud(ctx, xx, y, s, '#FFFFFF', '#CFE6FA'));
    }
  },
};

function sunSprite(ctx: Ctx): void {
  ctx.fillStyle = radGrad(ctx, 0, 0, 8, 70, [[0, 'rgba(255,250,210,0.95)'], [0.35, 'rgba(255,240,170,0.35)'], [1, 'rgba(255,240,170,0)']]);
  circle(ctx, 0, 0, 70);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, -5, -6, 2, 22, [[0, '#FFFDE8'], [0.6, '#FFE57A'], [1, '#FFC93C']]);
  circle(ctx, 0, 0, 20);
  ctx.fill();
}

export const PLAYGROUND: WorldArt = {
  sky: [[0, '#3E9FF0'], [0.6, '#8ED3FF'], [1, '#E2F5FF']],
  skyTo: HORIZON_Y,
  tiles: [CLOUDS],
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    blit(ctx, sprites.get('w0sun', 140, 140, 70, 70, sunSprite), 296, 22 + Math.sin(t * 0.5) * 1.5);
  },
  front() {
    /* static world — everything lives in the pre-rendered scene */
  },
};
