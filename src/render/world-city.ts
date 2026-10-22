// World 2 — 네온 시티 (oblique top-down): night skyline on the horizon, wet asphalt
// avenue with glowing neon lane lines, street lamps and neon boards along the curb.
import { blit, type SpriteCache } from './sprites';
import { depthScale, groundY, HORIZON_Y, screenX } from './projection';
import {
  billboard, groundFill, groundOval, groundQuad, horizonHaze, sideProps, starField,
  TRACK_HALF, Z_FAR, Z_NEAR, type WorldArt,
} from './scenery';
import { circle, FONT, roundRect, seeded, vGrad, type Ctx } from './util';
import type { View } from './view';

const WINDOW_COLORS = ['#FFD27A', '#7FF3FF', '#FF9BE0'];
const NEON_PINK = '#FF4FD8';
const NEON_CYAN = '#3BF4FF';

interface Win {
  readonly x: number;
  readonly y: number;
}
/** windows chosen to twinkle; filled while the scene is built */
let twinkles: Win[] = [];

function skyline(ctx: Ctx, v: View, seed: number, maxH: number, body: string, lit: number, out: Win[] | null): void {
  const rnd = seeded(seed);
  let x = v.x0 - 6;
  while (x < v.x0 + v.w) {
    const w = 10 + rnd() * 18;
    const h = 14 + rnd() * maxH;
    const top = HORIZON_Y - h;
    ctx.fillStyle = body;
    ctx.fillRect(x, top, w, h + 1);
    if (rnd() < 0.3) {
      ctx.fillRect(x + w * 0.45, top - 7, 1.5, 7);
      ctx.fillStyle = '#FF5E7A';
      circle(ctx, x + w * 0.45 + 0.7, top - 7.5, 1.1);
      ctx.fill();
    }
    for (let wy = top + 4; wy < HORIZON_Y - 3; wy += 5) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if (rnd() > lit) continue;
        ctx.fillStyle = WINDOW_COLORS[Math.floor(rnd() * 3)];
        ctx.globalAlpha = 0.5 + rnd() * 0.4;
        ctx.fillRect(wx, wy, 1.8, 2.4);
        if (out && rnd() < 0.08 && out.length < 18) out.push({ x: wx, y: wy });
      }
    }
    ctx.globalAlpha = 1;
    x += w + rnd() * 3;
  }
}

function neonLine(ctx: Ctx, x: number, color: string, width: number): void {
  ctx.fillStyle = color;
  groundQuad(ctx, x - width / 2, x + width / 2, Z_NEAR, Z_FAR);
  ctx.fill();
}

function avenue(ctx: Ctx, v: View): void {
  groundFill(ctx, v, [[0, '#4A2470'], [0.15, '#2A1A52'], [1, '#100A26']]);
  ctx.fillStyle = '#2C2456';
  groundQuad(ctx, -3000, -TRACK_HALF - 30, Z_NEAR, Z_FAR);
  ctx.fill();
  groundQuad(ctx, TRACK_HALF + 30, 3000, Z_NEAR, Z_FAR);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,120,255,0.12)';
  for (let z = Z_NEAR; z < 2400; z += 70) {
    groundQuad(ctx, -3000, -TRACK_HALF - 30, z, z + 3);
    ctx.fill();
    groundQuad(ctx, TRACK_HALF + 30, 3000, z, z + 3);
    ctx.fill();
  }
  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = NEON_PINK;
  neonLine(ctx, -TRACK_HALF, NEON_PINK, 4);
  neonLine(ctx, TRACK_HALF, NEON_PINK, 4);
  ctx.shadowColor = NEON_CYAN;
  ctx.globalAlpha = 0.85;
  for (const k of [-0.5, 0.5]) {
    ctx.fillStyle = NEON_CYAN;
    for (let z = Z_NEAR; z < 2600; z += 64) {
      groundQuad(ctx, k * 72 - 1.6, k * 72 + 1.6, z, z + 34);
      ctx.fill();
    }
  }
  ctx.restore();
  puddles(ctx);
}

function puddles(ctx: Ctx): void {
  const rnd = seeded(31);
  for (let i = 0; i < 9; i++) {
    const x = (rnd() - 0.5) * 2 * (TRACK_HALF - 20);
    const z = 80 + rnd() * 1300;
    ctx.fillStyle = 'rgba(120,200,255,0.10)';
    groundOval(ctx, x, z, 26 + rnd() * 20, 14 + rnd() * 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,220,0.18)';
    groundOval(ctx, x + 6, z - 3, 8, 2);
    ctx.fill();
  }
}

function lamp(ctx: Ctx, side: number): void {
  ctx.fillStyle = 'rgba(255,220,140,0.16)';
  ctx.beginPath();
  ctx.ellipse(-side * 22, 0, 40, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3C3470';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -84);
  ctx.quadraticCurveTo(0, -92, -side * 14, -92);
  ctx.stroke();
  ctx.fillStyle = '#FFE6A8';
  ctx.shadowColor = '#FFD27A';
  ctx.shadowBlur = 14;
  roundRect(ctx, -side * 14 - 6, -93, 12, 4, 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function board(ctx: Ctx, color: string, text: string): void {
  ctx.fillStyle = '#1A1238';
  ctx.fillRect(-2, -40, 4, 40);
  ctx.fillStyle = 'rgba(10,6,30,0.9)';
  roundRect(ctx, -26, -64, 52, 24, 6);
  ctx.fill();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, -24, -62, 48, 20, 5);
  ctx.stroke();
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, 0, -51);
  ctx.shadowBlur = 0;
}

const BOARDS: readonly (readonly [string, string])[] = [[NEON_PINK, 'ROPE'], [NEON_CYAN, 'JUMP'], ['#FFD27A', '★★★'], ['#B98CFF', 'TAP!']];

function props(ctx: Ctx): void {
  const list = sideProps(seeded(23), 2, 220, 2400, 170, TRACK_HALF + 50, TRACK_HALF + 120);
  let b = 0;
  for (const p of list) {
    billboard(ctx, p.x, p.z, 1);
    if (p.kind === 0) lamp(ctx, p.x < 0 ? -1 : 1);
    else board(ctx, BOARDS[b % BOARDS.length][0], BOARDS[b++ % BOARDS.length][1]);
    ctx.restore();
  }
}

function drawScene(ctx: Ctx, v: View): void {
  starField(ctx, seeded(4), v.x0, v.y0, v.w, HORIZON_Y - 40 - v.y0, 60, 1.2);
  ctx.save();
  ctx.shadowColor = '#FFF2C9';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#FFF2C9';
  circle(ctx, 66, 8, 12);
  ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'destination-out';
  circle(ctx, 72, 3, 10.5);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = vGrad(ctx, HORIZON_Y - 60, HORIZON_Y, [[0, 'rgba(255,80,200,0)'], [1, 'rgba(255,80,200,0.35)']]);
  ctx.fillRect(v.x0, HORIZON_Y - 60, v.w, 60);
  skyline(ctx, v, 21, 50, '#33246A', 0.25, null);
  const wins: Win[] = [];
  skyline(ctx, v, 33, 30, '#1B1240', 0.32, wins);
  twinkles = wins;
  avenue(ctx, v);
  horizonHaze(ctx, v, 'rgba(255,90,210,0.4)', 50);
  props(ctx);
}

function airplane(ctx: Ctx, t: number): void {
  const cyc = (t % 24) / 24;
  const x = -40 + cyc * 460;
  const y = 30 - cyc * 30;
  ctx.fillStyle = 'rgba(200,190,255,0.5)';
  ctx.fillRect(x - 6, y - 0.7, 12, 1.4);
  const blink = (t % 1.2) < 0.15;
  ctx.fillStyle = blink ? '#FFFFFF' : '#FF4D6A';
  circle(ctx, x + 6, y, blink ? 1.7 : 1.1);
  ctx.fill();
}

/** Neon lane chevrons pulsing toward the player. */
function pulses(ctx: Ctx, t: number): void {
  ctx.fillStyle = NEON_CYAN;
  for (let i = 0; i < 4; i++) {
    const z = 1400 - ((t * 420 + i * 350) % 1400);
    const s = depthScale(z);
    ctx.globalAlpha = Math.min(1, s * 1.4) * 0.35;
    const y = groundY(z);
    for (const k of [-1, 1]) {
      ctx.fillRect(screenX(k * TRACK_HALF, z) - 3 * s, y - 1.5 * s, 6 * s, 3 * s);
    }
  }
  ctx.globalAlpha = 1;
}

function ropeSign(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(10,6,30,0.85)';
  roundRect(ctx, 0, 0, 56, 22, 6);
  ctx.fill();
  ctx.shadowColor = NEON_PINK;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = NEON_PINK;
  ctx.lineWidth = 2;
  roundRect(ctx, 2, 2, 52, 18, 5);
  ctx.stroke();
  ctx.font = `800 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('NEON', 28, 12);
  ctx.shadowBlur = 0;
}

export const CITY: WorldArt = {
  sky: [[0, '#05051A'], [0.5, '#170C40'], [1, '#5E1A6E']],
  skyTo: HORIZON_Y,
  tiles: [],
  drawScene,
  backdrop() {
    /* stars and moon are static */
  },
  front(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < twinkles.length; i++) {
      const w = twinkles[i];
      const a = 0.5 + 0.5 * Math.sin(t * (0.8 + (i % 4) * 0.45) + i * 2.3);
      ctx.globalAlpha = a < 0.3 ? 0 : a;
      ctx.fillRect(w.x, w.y, 1.8, 2.4);
    }
    ctx.globalAlpha = 1;
    airplane(ctx, t);
    pulses(ctx, t);
    const f = Math.sin(t * 13.1) * Math.sin(t * 7.7) * Math.sin(t * 2.3);
    ctx.globalAlpha = f > 0.55 ? 0.25 : 1;
    blit(ctx, sprites.get('w2neon', 84, 50, 14, 14, ropeSign), 250, HORIZON_Y - 52);
    ctx.globalAlpha = 1;
  },
};
