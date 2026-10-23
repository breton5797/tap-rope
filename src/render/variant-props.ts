// Static variant extras baked into the scene canvas after the colour grade:
// street lamps, fairy lights, fallen leaves, a bonfire base, a light pool around the
// jumper (keeps shadows and characters readable at night) and wet neon smears.
import { depthScale, groundRy, groundY, screenX } from './projection';
import { billboard, groundOval, groundQuad, TRACK_HALF, type Anchor } from './scenery';
import { circle, roundRect, seeded, TAU, type Ctx } from './util';

export const BONFIRE_X = -205;
export const BONFIRE_Z = 260;

/** Soft additive pool of light on the ground at (x, z). */
export function lightPool(ctx: Ctx, x: number, z: number, rx: number, rz: number, color: string): void {
  const sx = screenX(x, z);
  const sy = groundY(z);
  const r = rx * depthScale(z);
  const ry = groundRy(z, rz);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(sx, sy);
  ctx.scale(1, ry / r);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, r);
  ctx.fill();
  ctx.restore();
}

function lampPost(ctx: Ctx): void {
  ctx.strokeStyle = '#2E2A4E';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -70);
  ctx.stroke();
  ctx.fillStyle = '#3A355E';
  roundRect(ctx, -6, -82, 12, 13, 4);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#FFD27A';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFF0C0';
  roundRect(ctx, -4, -79, 8, 8, 3);
  ctx.fill();
  ctx.restore();
}

/** Warm street lamps down both sides of the track. */
export function lamps(ctx: Ctx): void {
  const zs = [1700, 1300, 980, 700, 420, 160];
  for (const z of zs) {
    for (const side of [-1, 1]) lightPool(ctx, side * (TRACK_HALF + 30), z, 70, 50, 'rgba(255,200,120,0.28)');
  }
  for (const z of zs) {
    for (const side of [-1, 1]) {
      billboard(ctx, side * (TRACK_HALF + 30), z, 1);
      lampPost(ctx);
      ctx.restore();
    }
  }
}

const BULBS = ['#FFE27A', '#FF8FB1', '#9AF0FF', '#B8FF9A', '#FFB86B'];

/** Strings of glowing bulbs draped over tall props. */
export function fairyLights(ctx: Ctx, anchors: readonly Anchor[]): void {
  anchors.forEach((a, k) => {
    billboard(ctx, a.x, a.z, 1);
    const y0 = -a.h;
    ctx.strokeStyle = 'rgba(40,30,60,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-a.r, y0);
    ctx.quadraticCurveTo(0, y0 + a.r * 0.7, a.r, y0);
    ctx.stroke();
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const x = -a.r + 2 * a.r * u;
      const y = y0 + 2 * u * (1 - u) * a.r * 0.7;
      const c = BULBS[(i + k) % BULBS.length];
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = c;
      ctx.globalAlpha = 0.35;
      circle(ctx, x, y, 4.5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      circle(ctx, x, y, 1.8);
      ctx.fill();
    }
    ctx.restore();
  });
}

const LEAF_COLS = ['#F59E2B', '#E5533A', '#F2C230', '#C9661A', '#FFB08A'];

/** Fallen leaves scattered over the lawn (sparser on the track). */
export function fallenLeaves(ctx: Ctx): void {
  const rnd = seeded(404);
  for (let i = 0; i < 420; i++) {
    const x = (rnd() - 0.5) * 1000;
    const z = -160 + rnd() * rnd() * 1800;
    if (Math.abs(x) < TRACK_HALF && rnd() < 0.75) continue;
    const s = depthScale(z);
    ctx.fillStyle = LEAF_COLS[i % LEAF_COLS.length];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(screenX(x, z), groundY(z), 3.4 * s, 1.6 * s, rnd() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Stones + logs of the beach bonfire (flames are animated separately). */
export function bonfireBase(ctx: Ctx): void {
  lightPool(ctx, BONFIRE_X, BONFIRE_Z, 150, 110, 'rgba(255,150,60,0.45)');
  billboard(ctx, BONFIRE_X, BONFIRE_Z, 1);
  ctx.fillStyle = '#7A6A70';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    circle(ctx, Math.cos(a) * 15, Math.sin(a) * 5, 4);
    ctx.fill();
  }
  ctx.strokeStyle = '#5A3A2A';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-11, 2);
  ctx.lineTo(9, -4);
  ctx.moveTo(-9, -4);
  ctx.lineTo(11, 2);
  ctx.stroke();
  ctx.restore();
}

/** Rain: neon colours smeared down the wet road + glossy puddles. */
export function neonSmears(ctx: Ctx): void {
  const lanes: readonly (readonly [number, string])[] = [
    [-TRACK_HALF, 'rgba(255,79,216,0.16)'], [TRACK_HALF, 'rgba(255,79,216,0.16)'],
    [-36, 'rgba(59,244,255,0.12)'], [36, 'rgba(59,244,255,0.12)'],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, c] of lanes) {
    ctx.fillStyle = c;
    for (let z = -200; z < 1600; z += 90) {
      groundQuad(ctx, x - 9, x + 9, z, z + 60);
      ctx.fill();
    }
  }
  const rnd = seeded(808);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,90,210,0.12)' : 'rgba(90,220,255,0.12)';
    groundOval(ctx, (rnd() - 0.5) * 2 * TRACK_HALF, 60 + rnd() * 1200, 24 + rnd() * 20, 12 + rnd() * 10);
    ctx.fill();
  }
  ctx.restore();
}
