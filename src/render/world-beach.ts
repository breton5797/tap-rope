// World 1 — 노을 해변 (oblique top-down): sunset sky band, banded sun sinking into a
// shimmering sea, foam on the shore, warm sand with palms, parasols and a sandcastle.
import type { Variant } from '../types';
import { blit, type SpriteCache } from './sprites';
import { groundY, HORIZON_Y } from './projection';
import {
  billboard, groundFill, groundOval, groundQuad, horizonHaze, laneDashes, sideProps,
  TRACK_HALF, wrapped, Z_NEAR, type Anchor, type TileSpec, type WorldArt,
} from './scenery';
import { circle, oval, radGrad, roundRect, seeded, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

const SHORE_Z = 1500;
const SHORE_Y = groundY(SHORE_Z);

function sea(ctx: Ctx, v: View): void {
  ctx.fillStyle = vGrad(ctx, HORIZON_Y, SHORE_Y, [[0, '#FFB089'], [0.15, '#E0708A'], [0.6, '#8C3D8A'], [1, '#5B3384']]);
  ctx.fillRect(v.x0, HORIZON_Y, v.w, SHORE_Y - HORIZON_Y + 2);
  ctx.fillStyle = 'rgba(255,232,180,0.9)';
  ctx.fillRect(v.x0, HORIZON_Y - 0.5, v.w, 1.5);
  const rnd = seeded(41);
  for (let i = 0; i < 90; i++) {
    const y = HORIZON_Y + 3 + rnd() * (SHORE_Y - HORIZON_Y - 6);
    const len = 3 + (y - HORIZON_Y) * 0.25 * rnd();
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,200,170,0.28)' : 'rgba(60,20,90,0.25)';
    ctx.fillRect(v.x0 + rnd() * v.w, y, len, 1);
  }
  ctx.fillStyle = '#5A2C6E';
  ctx.beginPath();
  ctx.moveTo(v.x0 - 10, HORIZON_Y + 1);
  ctx.quadraticCurveTo(v.x0 + 26, HORIZON_Y - 11, v.x0 + 60, HORIZON_Y - 5);
  ctx.quadraticCurveTo(v.x0 + 86, HORIZON_Y - 9, v.x0 + 112, HORIZON_Y + 1);
  ctx.fill();
}

function palm(ctx: Ctx, lean: number): void {
  ctx.fillStyle = 'rgba(90,40,40,0.25)';
  oval(ctx, 30 * lean, 2, 34, 9);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8A5A44';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 4, -50, lean * 22, -92);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,120,0.55)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const tx = lean * 22;
  const ty = -92;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3;
    const ex = tx + Math.cos(a) * 44;
    const ey = ty + Math.sin(a) * 20 + 10;
    ctx.fillStyle = i % 2 ? '#3E9A6A' : '#2E7A58';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2 - Math.sin(a) * 8, (ty + ey) / 2 - 12, ex, ey);
    ctx.quadraticCurveTo((tx + ex) / 2 + Math.sin(a) * 4, (ty + ey) / 2 - 2, tx, ty);
    ctx.fill();
  }
  ctx.fillStyle = '#6B3B2A';
  circle(ctx, tx - 4, ty + 4, 4);
  ctx.fill();
  circle(ctx, tx + 4, ty + 5, 4);
  ctx.fill();
}

function parasol(ctx: Ctx, hue: number): void {
  ctx.fillStyle = 'rgba(90,40,40,0.22)';
  oval(ctx, 8, 2, 30, 9);
  ctx.fill();
  ctx.strokeStyle = '#F4EDE4';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -48);
  ctx.stroke();
  const cols = hue === 0 ? ['#FF5E7A', '#FFFFFF'] : ['#3BC4E8', '#FFF1A8'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = cols[i % 2];
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(-30 + i * 10, -44);
    ctx.lineTo(-20 + i * 10, -44);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(ctx, -30, -46, 60, 3, 1.5);
  ctx.fill();
}

function castle(ctx: Ctx): void {
  ctx.fillStyle = '#E9B074';
  roundRect(ctx, -18, -16, 36, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#F5C690';
  for (const x of [-16, 6]) {
    roundRect(ctx, x, -30, 10, 16, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FF5E7A';
  ctx.beginPath();
  ctx.moveTo(11, -30);
  ctx.lineTo(11, -42);
  ctx.lineTo(19, -38);
  ctx.closePath();
  ctx.fill();
}

function sand(ctx: Ctx, v: View): void {
  groundFill(ctx, v, [[0, '#F7C995'], [0.3, '#F2B985'], [1, '#D68E62']]);
  ctx.fillStyle = 'rgba(160,90,90,0.25)';
  groundQuad(ctx, -3000, 3000, SHORE_Z - 160, SHORE_Z);
  ctx.fill();
  ctx.fillStyle = '#FBE2BC';
  groundQuad(ctx, -TRACK_HALF, TRACK_HALF, Z_NEAR, SHORE_Z - 160);
  ctx.fill();
  laneDashes(ctx, 'rgba(232,150,105,0.75)', 3, 26, 22, true);
  const rnd = seeded(8);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,240,215,0.6)' : 'rgba(190,110,70,0.35)';
    groundOval(ctx, (rnd() - 0.5) * 900, -200 + rnd() * rnd() * 1500, 1.5, 1.5);
    ctx.fill();
  }
  for (const [x, z, c] of [[-200, 120, '#FF7A6B'], [190, 420, '#FFB627'], [-170, 760, '#FF8FB1'], [230, -60, '#FF7A6B']] as const) {
    ctx.fillStyle = c;
    groundOval(ctx, x, z, 9, 9);
    ctx.fill();
  }
}

const PROPS = sideProps(seeded(17), 4, -200, SHORE_Z - 200, 150, TRACK_HALF + 50, TRACK_HALF + 220);
/** palm crowns (lean puts the crown ~22px toward the outside) */
const ANCHORS: readonly Anchor[] = PROPS.filter((p) => p.kind >= 2 && p.z > 60)
  .map((p) => ({ x: p.x + (p.x < 0 ? -22 : 22) * p.size, z: p.z, h: 92 * p.size, r: 26 * p.size }));

function props(ctx: Ctx): void {
  for (const p of PROPS) {
    billboard(ctx, p.x, p.z, p.size);
    if (p.kind === 0) castle(ctx);
    else if (p.kind === 1) parasol(ctx, p.x < 0 ? 0 : 1);
    else palm(ctx, p.x < 0 ? -1 : 1);
    ctx.restore();
  }
}

function drawScene(ctx: Ctx, v: View): void {
  sand(ctx, v);
  sea(ctx, v);
  horizonHaze(ctx, v, 'rgba(255,190,150,0.35)', 40);
  props(ctx);
}

const STREAKS: TileSpec = {
  y: -100,
  h: 200,
  w: 620,
  speed: 6,
  draw(ctx, w) {
    const rnd = seeded(19);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w;
      const y = -60 + rnd() * 140;
      const rx = 40 + rnd() * 60;
      const ry = 3 + rnd() * 4;
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
  ctx.fillStyle = radGrad(ctx, 0, 0, 20, 130, [[0, 'rgba(255,220,140,0.75)'], [0.4, 'rgba(255,150,110,0.3)'], [1, 'rgba(255,120,120,0)']]);
  circle(ctx, 0, 0, 130);
  ctx.fill();
  ctx.fillStyle = vGrad(ctx, -38, 38, [[0, '#FFF4B8'], [0.5, '#FFC56A'], [1, '#FF7E57']]);
  circle(ctx, 0, 0, 38);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 4; i++) ctx.fillRect(-40, 4 + i * 7, 80, 1.2 + i * 0.6);
  ctx.globalCompositeOperation = 'source-over';
}

function shimmer(ctx: Ctx, t: number, color: string): void {
  ctx.fillStyle = color;
  const rows = 22;
  for (let i = 0; i < rows; i++) {
    const y = HORIZON_Y + 2 + i * ((SHORE_Y - HORIZON_Y - 6) / rows);
    const spread = 10 + i * 2.2;
    for (let j = 0; j < 2; j++) {
      const off = Math.sin(t * 1.7 + i * 1.9 + j * 2.4) * spread * 0.55;
      ctx.globalAlpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3.6 + i * 2.2 + j));
      ctx.fillRect(180 + off - (5 + i * 0.4), y, 10 + i * 0.8, 1.1);
    }
  }
  ctx.globalAlpha = 1;
}

function foam(ctx: Ctx, v: View, t: number): void {
  const x1 = v.x0 + v.w + 12;
  for (let k = 0; k < 2; k++) {
    const base = SHORE_Y + 1 + k * 5 + Math.sin(t * 1.2 + k * 2) * 2;
    ctx.beginPath();
    for (let x = v.x0; x <= x1; x += 12) {
      const y = base + 1.6 * Math.sin(x * 0.05 + t * 1.6 + k) + Math.sin(x * 0.13 - t * 2.2) * 0.8;
      if (x === v.x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = k === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,240,230,0.5)';
    ctx.lineWidth = k === 0 ? 2 : 1.3;
    ctx.stroke();
  }
}

export const BEACH: WorldArt = {
  sky: [[0, '#2A1858'], [0.35, '#6B2C7E'], [0.7, '#E0507A'], [1, '#FFB070']],
  skyTo: HORIZON_Y,
  tiles: [STREAKS],
  anchors: ANCHORS,
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    ctx.globalAlpha = 0.94 + 0.06 * Math.sin(t * 1.3);
    blit(ctx, sprites.get('w1sun', 260, 260, 130, 130, sunSprite), 180, HORIZON_Y + 4);
    ctx.globalAlpha = 1;
  },
  front(ctx: Ctx, v: View, t: number, _sprites: SpriteCache, variant: Variant) {
    shimmer(ctx, t, variant === 'night' || variant === 'eclipse' ? '#E6F0FF' : '#FFE6A8');
    foam(ctx, v, t);
  },
};
