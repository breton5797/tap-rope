// World 3 — 달 기지 (oblique top-down): starfield + Earth, jagged ridge on the horizon,
// cratered grey regolith, a metal runway with chasing edge lights, domes and antennas.
import { blit, type SpriteCache } from './sprites';
import { depthScale, groundY, HORIZON_Y, screenX } from './projection';
import {
  billboard, groundFill, groundOval, groundQuad, horizonHaze, laneDashes, sideProps, starField,
  TRACK_HALF, Z_FAR, Z_NEAR, type Anchor, type TileSpec, type WorldArt,
} from './scenery';
import { circle, oval, radGrad, roundRect, seeded, starPath, TAU, vGrad, type Ctx } from './util';
import type { View } from './view';

const EARTH_X = 74;
const EARTH_Y = 30;
const LIGHT_STEP = 90;

function ridge(ctx: Ctx, v: View): void {
  const rnd = seeded(14);
  ctx.beginPath();
  ctx.moveTo(v.x0, HORIZON_Y + 1);
  let x = v.x0;
  while (x < v.x0 + v.w + 14) {
    ctx.lineTo(x, HORIZON_Y - 4 - rnd() * 20);
    x += 10 + rnd() * 16;
  }
  ctx.lineTo(x, HORIZON_Y + 1);
  ctx.closePath();
  ctx.fillStyle = vGrad(ctx, HORIZON_Y - 24, HORIZON_Y, [[0, '#4A5482'], [1, '#323A63']]);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,205,255,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

function crater(ctx: Ctx, x: number, z: number, r: number): void {
  ctx.fillStyle = 'rgba(235,240,255,0.5)';
  groundOval(ctx, x, z + r * 0.12, r * 1.06, r * 1.06);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,76,104,0.6)';
  groundOval(ctx, x, z, r, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,146,172,0.9)';
  groundOval(ctx, x, z - r * 0.18, r * 0.8, r * 0.7);
  ctx.fill();
}

function regolith(ctx: Ctx, v: View): void {
  groundFill(ctx, v, [[0, '#9AA0BC'], [0.25, '#B3B8CC'], [1, '#7A809C']]);
  const rnd = seeded(23);
  for (let i = 0; i < 40; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (TRACK_HALF + 20 + rnd() * 340);
    crater(ctx, x, -150 + rnd() * rnd() * 2200, 14 + rnd() * 40);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(60,66,92,0.45)' : 'rgba(235,240,255,0.45)';
    groundOval(ctx, (rnd() - 0.5) * 1000, -200 + rnd() * rnd() * 2400, 1.6, 1.6);
    ctx.fill();
  }
}

function runway(ctx: Ctx): void {
  ctx.fillStyle = '#2A3052';
  groundQuad(ctx, -TRACK_HALF - 8, TRACK_HALF + 8, Z_NEAR, Z_FAR);
  ctx.fill();
  ctx.fillStyle = '#454E78';
  groundQuad(ctx, -TRACK_HALF, TRACK_HALF, Z_NEAR, Z_FAR);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,180,255,0.14)';
  for (let z = Z_NEAR; z < 2800; z += 60) {
    groundQuad(ctx, -TRACK_HALF, TRACK_HALF, z, z + 2);
    ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = '#7FF3FF';
  ctx.shadowBlur = 6;
  laneDashes(ctx, 'rgba(127,243,255,0.85)', 3, 30, 26, false);
  ctx.restore();
}

function dome(ctx: Ctx, r: number): void {
  ctx.fillStyle = 'rgba(30,30,60,0.3)';
  oval(ctx, 4, 2, r * 1.2, r * 0.35);
  ctx.fill();
  ctx.fillStyle = '#B9C2DA';
  roundRect(ctx, -r - 4, -4, r * 2 + 8, 7, 3);
  ctx.fill();
  ctx.fillStyle = radGrad(ctx, 0, 0, 2, r, [[0, 'rgba(255,214,140,0.8)'], [0.6, 'rgba(140,200,255,0.4)'], [1, 'rgba(170,220,255,0.6)']]);
  ctx.beginPath();
  ctx.arc(0, -3, r, Math.PI, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,235,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    ctx.moveTo(-r, -3);
    ctx.quadraticCurveTo(-r + (i * r) / 2, -3 - r * 1.3, r * (i / 2 - 1) + r, -3);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -3, r - 4, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
}

function antenna(ctx: Ctx): void {
  ctx.strokeStyle = '#8E98B8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(0, -66);
  ctx.lineTo(8, 0);
  for (let y = -10; y > -60; y -= 10) {
    const hw = (1 + y / 66) * 8;
    ctx.moveTo(-hw, y);
    ctx.lineTo(hw, y - 5);
  }
  ctx.stroke();
  ctx.fillStyle = '#C7CFE6';
  ctx.beginPath();
  ctx.ellipse(-2, -58, 9, 4, -0.5, 0, Math.PI);
  ctx.fill();
}

const PROPS = sideProps(seeded(29), 3, -100, 2400, 190, TRACK_HALF + 60, TRACK_HALF + 220);
const ANCHORS: readonly Anchor[] = PROPS.filter((p) => p.kind !== 2 && p.z > 60)
  .map((p) => ({ x: p.x, z: p.z, h: (p.kind === 0 ? 18 : 12) * p.size, r: (p.kind === 0 ? 30 : 20) * p.size }));

function props(ctx: Ctx): void {
  for (const p of PROPS) {
    billboard(ctx, p.x, p.z, p.size);
    if (p.kind === 2) antenna(ctx);
    else dome(ctx, p.kind === 0 ? 30 : 20);
    ctx.restore();
  }
}

function drawScene(ctx: Ctx, v: View): void {
  starField(ctx, seeded(2), v.x0, v.y0, v.w, HORIZON_Y - v.y0, 150, 1.1);
  ctx.fillStyle = radGrad(ctx, 250, 10, 0, 120, [[0, 'rgba(150,90,255,0.22)'], [1, 'rgba(150,90,255,0)']]);
  ctx.fillRect(v.x0, v.y0, v.w, HORIZON_Y - v.y0);
  ridge(ctx, v);
  regolith(ctx, v);
  runway(ctx);
  horizonHaze(ctx, v, 'rgba(120,140,220,0.45)', 46);
  props(ctx);
}

function earthSprite(ctx: Ctx): void {
  const r = 24;
  ctx.fillStyle = radGrad(ctx, 0, 0, r * 0.9, r * 1.8, [[0, 'rgba(120,190,255,0.5)'], [1, 'rgba(120,190,255,0)']]);
  circle(ctx, 0, 0, r * 1.8);
  ctx.fill();
  ctx.save();
  circle(ctx, 0, 0, r);
  ctx.clip();
  ctx.fillStyle = radGrad(ctx, -6, -8, 2, r * 1.2, [[0, '#7CC8FF'], [1, '#1D57B8']]);
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.fillStyle = '#4CC46A';
  for (const [x, y, rx, ry, a] of [[-8, -6, 9, 6, 0.5], [7, 5, 7, 10, -0.3], [-11, 11, 5, 3, 0.2]] as const) {
    oval(ctx, x, y, rx, ry, a);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, rx] of [[-3, -14, 10], [8, 0, 8], [2, 16, 10]] as const) {
    oval(ctx, x, y, rx, 2.2, -0.2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(5,10,40,0.55)';
  circle(ctx, 13, 8, r * 1.05);
  ctx.fill();
  ctx.restore();
}

const BRIGHT_STARS: TileSpec = {
  y: -140,
  h: 250,
  w: 620,
  speed: 2.5,
  draw(ctx, w) {
    starField(ctx, seeded(31), 0, -140, w, 240, 34, 1.8);
  },
};

function twinkle(ctx: Ctx, t: number): void {
  const rnd = seeded(66);
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 7; i++) {
    const x = 20 + rnd() * 320;
    const y = -40 + rnd() * 120;
    const a = 0.5 + 0.5 * Math.sin(t * (1.2 + rnd()) + i * 1.7);
    ctx.globalAlpha = a;
    starPath(ctx, x, y, 2 + a * 2.5, 0.6, 4);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Runway edge lights chasing toward the player. */
function lights(ctx: Ctx, t: number): void {
  const head = (t * 6) % 8;
  for (let i = 0; i < 26; i++) {
    const z = -60 + i * LIGHT_STEP;
    const s = depthScale(z);
    const on = Math.abs(((26 - i) % 8) - head) < 1;
    ctx.fillStyle = on ? '#7FF3FF' : 'rgba(60,90,160,0.8)';
    const y = groundY(z);
    for (const k of [-1, 1]) {
      const x = screenX(k * (TRACK_HALF + 4), z);
      circle(ctx, x, y, (on ? 2.6 : 1.6) * s);
      ctx.fill();
      if (on) {
        ctx.fillStyle = 'rgba(127,243,255,0.25)';
        circle(ctx, x, y, 7 * s);
        ctx.fill();
        ctx.fillStyle = '#7FF3FF';
      }
    }
  }
}

export const MOON: WorldArt = {
  sky: [[0, '#01020B'], [0.6, '#08102F'], [1, '#26336A']],
  skyTo: HORIZON_Y,
  tiles: [BRIGHT_STARS],
  anchors: ANCHORS,
  drawScene,
  backdrop(ctx: Ctx, _v: View, t: number, sprites: SpriteCache) {
    blit(ctx, sprites.get('w3earth', 90, 90, 45, 45, earthSprite), EARTH_X, EARTH_Y + Math.sin(t * 0.4) * 2);
  },
  front(ctx: Ctx, _v: View, t: number) {
    twinkle(ctx, t);
    lights(ctx, t);
  },
};
